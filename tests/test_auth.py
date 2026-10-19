import sqlite3
import time

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import create_app
from tests.test_api import ReadyModels

ORIGIN = {"origin": "http://127.0.0.1:8000"}
ACCOUNT = {"name": "Mira", "email": "mira@example.com", "password": "a long local password"}


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(ReadyModels(), accounts_path=tmp_path / "accounts.db")) as client:
        yield client


def test_account_session_login_logout_and_password_storage(client, tmp_path):
    assert client.get("/api/auth/session").json() == {"user": None}
    response = client.post("/api/auth/signup", json=ACCOUNT, headers=ORIGIN)
    assert response.status_code == 201
    assert response.json() == {"user": {"name": "Mira", "email": "mira@example.com"}}
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie
    assert client.get("/api/auth/session").json()["user"]["name"] == "Mira"
    with sqlite3.connect(tmp_path / "accounts.db") as db:
        row = db.execute("SELECT password_hash, salt FROM users").fetchone()
        assert ACCOUNT["password"].encode() not in row
        assert len(row[0]) == 64 and len(row[1]) == 16
        assert client.cookies.get("localvoice_session") not in str(
            db.execute("SELECT * FROM sessions").fetchall()
        )
    token = client.cookies.get("localvoice_session")
    assert client.post("/api/auth/logout", headers=ORIGIN).status_code == 200
    client.cookies.set("localvoice_session", token)
    assert client.get("/api/auth/session").json()["user"] is None
    client.cookies.clear()
    assert client.post("/api/auth/login", json=ACCOUNT, headers=ORIGIN).status_code == 200
    assert client.get("/api/auth/session").json()["user"]["name"] == "Mira"


def test_invalid_credentials_duplicate_and_origin_checks(client):
    assert client.post("/api/auth/signup", json=ACCOUNT, headers=ORIGIN).status_code == 201
    assert client.post("/api/auth/signup", json=ACCOUNT, headers=ORIGIN).status_code == 409
    for email in ["missing@example.com", ACCOUNT["email"]]:
        response = client.post(
            "/api/auth/login",
            json={**ACCOUNT, "email": email, "password": "incorrect password"},
            headers=ORIGIN,
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Email or password is incorrect."
    assert (
        client.post("/api/auth/logout", headers={"origin": "https://evil.example"}).status_code
        == 403
    )
    assert (
        client.post(
            "/api/auth/signup", json={**ACCOUNT, "password": "short"}, headers=ORIGIN
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/auth/signup", json={**ACCOUNT, "email": "invalid"}, headers=ORIGIN
        ).status_code
        == 422
    )


def test_expiry_persistence_and_login_rate_limit(client, tmp_path):
    client.post("/api/auth/signup", json=ACCOUNT, headers=ORIGIN)
    token = client.cookies.get("localvoice_session")
    with TestClient(create_app(ReadyModels(), accounts_path=tmp_path / "accounts.db")) as other:
        other.cookies.set("localvoice_session", token)
        assert other.get("/api/auth/session").json()["user"]["name"] == "Mira"
    with sqlite3.connect(tmp_path / "accounts.db") as db:
        db.execute("UPDATE sessions SET expires = ?", (time.time() - 1,))
    assert client.get("/api/auth/session").json()["user"] is None
    for _ in range(10):
        response = client.post(
            "/api/auth/login", json={**ACCOUNT, "password": "wrong password"}, headers=ORIGIN
        )
    assert response.status_code == 429


def test_voice_socket_requires_session(client):
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/ws/conversation", headers=ORIGIN):
            pass
    assert exc.value.code == 1008


def test_logout_revokes_an_existing_voice_socket(client):
    client.post("/api/auth/signup", json=ACCOUNT, headers=ORIGIN)
    with client.websocket_connect("/ws/conversation", headers=ORIGIN) as ws:
        client.post("/api/auth/logout", headers=ORIGIN)
        ws.send_json({"type": "reset"})
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
        assert exc.value.code == 1008
