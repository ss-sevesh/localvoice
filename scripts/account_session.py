"""Authenticate local tooling without putting credentials in source or command arguments."""

import os

import httpx


async def session_cookie():
    email = os.getenv("LOCALVOICE_EMAIL")
    password = os.getenv("LOCALVOICE_PASSWORD")
    if not email or not password:
        raise RuntimeError(
            "Set LOCALVOICE_EMAIL and LOCALVOICE_PASSWORD to an existing local account."
        )
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as client:
        response = await client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
            headers={"origin": "http://127.0.0.1:8000"},
        )
        response.raise_for_status()
        return f"localvoice_session={response.cookies['localvoice_session']}"
