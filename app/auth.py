"""Local accounts and revocable sessions; no external identity service."""

import hashlib
import re
import secrets
import sqlite3
import threading
import time
from contextlib import contextmanager
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator

COOKIE = "localvoice_session"
SESSION_SECONDS = 7 * 24 * 60 * 60
LOCAL_ORIGINS = {
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
}


class Credentials(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address.")
        return value


class Registration(Credentials):
    name: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=12, max_length=128)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Enter your name.")
        return value


def password_hash(password, salt):
    return hashlib.scrypt(password.encode(), salt=salt, n=2**15, r=8, p=3, maxmem=64 * 1024**2)


class Accounts:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        self.attempts = {}
        self.lock = threading.Lock()
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS users (
                    email TEXT PRIMARY KEY, name TEXT NOT NULL,
                    password_hash BLOB NOT NULL, salt BLOB NOT NULL
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires REAL NOT NULL
                );
            """)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path)
        try:
            with db:
                yield db
        finally:
            db.close()

    def user(self, token):
        if not token or len(token) > 128:
            return None
        with self.connect() as db:
            row = db.execute(
                "SELECT users.name, users.email FROM sessions JOIN users USING(email) "
                "WHERE token_hash = ? AND expires > ?",
                (hashlib.sha256(token.encode()).hexdigest(), time.time()),
            ).fetchone()
        return {"name": row[0], "email": row[1]} if row else None

    def limit(self, request):
        if request.headers.get("origin") not in LOCAL_ORIGINS:
            raise HTTPException(403, "This action must come from Local Voice.")
        if request.url.path.endswith("/logout"):
            return
        now = time.monotonic()
        address = request.client.host
        with self.lock:
            self.attempts = {
                key: [t for t in times if t > now - 60]
                for key, times in self.attempts.items()
                if times[-1] > now - 60
            }
            attempts = self.attempts.setdefault(address, [])
            if len(attempts) >= 10:
                raise HTTPException(
                    429, "Too many attempts. Please wait a minute.", headers={"Retry-After": "60"}
                )
            attempts.append(now)

    def session(self, email, response, secure):
        response.headers["Cache-Control"] = "no-store"
        token = secrets.token_urlsafe(32)
        with self.connect() as db:
            db.execute("DELETE FROM sessions WHERE expires <= ?", (time.time(),))
            db.execute(
                "INSERT INTO sessions VALUES (?, ?, ?)",
                (
                    hashlib.sha256(token.encode()).hexdigest(),
                    email,
                    time.time() + SESSION_SECONDS,
                ),
            )
        response.set_cookie(
            COOKIE, token, max_age=SESSION_SECONDS, httponly=True, samesite="strict", secure=secure
        )
        return {"user": self.user(token)}


router = APIRouter(prefix="/api/auth")


@router.get("/session")
def session(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return {"user": request.app.state.accounts.user(request.cookies.get(COOKIE))}


@router.post("/signup", status_code=201)
def signup(data: Registration, request: Request, response: Response):
    accounts = request.app.state.accounts
    accounts.limit(request)
    salt = secrets.token_bytes(16)
    hashed = password_hash(data.password, salt)
    try:
        with accounts.connect() as db:
            db.execute(
                "INSERT INTO users VALUES (?, ?, ?, ?)", (data.email, data.name, hashed, salt)
            )
    except sqlite3.IntegrityError:
        raise HTTPException(
            409, "An account with this email already exists. Log in instead."
        ) from None
    return accounts.session(data.email, response, request.url.scheme == "https")


@router.post("/login")
def login(data: Credentials, request: Request, response: Response):
    accounts = request.app.state.accounts
    accounts.limit(request)
    with accounts.connect() as db:
        row = db.execute(
            "SELECT password_hash, salt FROM users WHERE email = ?", (data.email,)
        ).fetchone()
    hashed = password_hash(data.password, row[1] if row else bytes(16))
    if not row or not secrets.compare_digest(hashed, row[0]):
        raise HTTPException(401, "Email or password is incorrect.")
    return accounts.session(data.email, response, request.url.scheme == "https")


@router.post("/logout")
def logout(request: Request, response: Response):
    accounts = request.app.state.accounts
    accounts.limit(request)
    token = request.cookies.get(COOKIE, "")
    with accounts.connect() as db:
        db.execute(
            "DELETE FROM sessions WHERE token_hash = ?",
            (hashlib.sha256(token.encode()).hexdigest(),),
        )
    response.delete_cookie(COOKIE, httponly=True, samesite="strict")
    return {"user": None}
