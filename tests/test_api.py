import base64

from fastapi.testclient import TestClient

from app.main import create_app


class ReadyModels:
    ready = True
    error = None
    load_seconds = 0.1

    async def load(self):
        pass

    async def close(self):
        pass


def test_health_and_websocket_audio_validation(tmp_path):
    with TestClient(create_app(ReadyModels(), accounts_path=tmp_path / "accounts.db")) as client:
        client.post(
            "/api/auth/signup",
            json={
                "name": "Test User",
                "email": "test@example.com",
                "password": "local test password",
            },
            headers={"origin": "http://127.0.0.1:8000"},
        )
        assert client.get("/api/health").json()["ready"]
        with client.websocket_connect(
            "/ws/conversation", headers={"origin": "http://127.0.0.1:8000"}
        ) as ws:
            for message in [
                [],
                {"type": "unknown"},
                {"type": "speech", "turn_id": True},
                {"type": "speech", "turn_id": 1, "input_language": "ta", "pcm": "x"},
            ]:
                ws.send_json(message)
                assert ws.receive_json()["type"] == "error"
            ws.send_json({"type": "speech", "turn_id": 1, "pcm": "bad!"})
            assert ws.receive_json()["type"] == "error"
            ws.send_json(
                {
                    "type": "speech",
                    "turn_id": 2,
                    "pcm": base64.b64encode(bytes(3200)).decode(),
                }
            )
            assert ws.receive_json()["type"] == "empty"
            ws.send_json({"type": "reset"})
            assert ws.receive_json()["type"] == "reset"


def test_cross_site_socket_is_rejected(tmp_path):
    from starlette.websockets import WebSocketDisconnect

    with TestClient(create_app(ReadyModels(), accounts_path=tmp_path / "accounts.db")) as client:
        try:
            with client.websocket_connect(
                "/ws/conversation", headers={"origin": "https://untrusted.example"}
            ):
                raise AssertionError("Cross-site socket was accepted")
        except WebSocketDisconnect as exc:
            assert exc.code == 1008
