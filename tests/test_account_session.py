import httpx
import pytest

from scripts.account_session import session_cookie


@pytest.mark.asyncio
async def test_tooling_requires_credentials_and_uses_login_cookie(monkeypatch):
    monkeypatch.delenv("LOCALVOICE_EMAIL", raising=False)
    monkeypatch.delenv("LOCALVOICE_PASSWORD", raising=False)
    with pytest.raises(RuntimeError, match="Set LOCALVOICE_EMAIL"):
        await session_cookie()
    monkeypatch.setenv("LOCALVOICE_EMAIL", "mira@example.com")
    monkeypatch.setenv("LOCALVOICE_PASSWORD", "local test password")

    def handler(request):
        assert request.url.path == "/api/auth/login"
        assert request.headers["origin"] == "http://127.0.0.1:8000"
        return httpx.Response(200, headers={"set-cookie": "localvoice_session=test-session"})

    client = httpx.AsyncClient(
        base_url="http://127.0.0.1:8000", transport=httpx.MockTransport(handler)
    )
    monkeypatch.setattr("scripts.account_session.httpx.AsyncClient", lambda **kwargs: client)
    assert await session_cookie() == "localvoice_session=test-session"
