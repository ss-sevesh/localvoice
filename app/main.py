import asyncio
import json
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.auth import COOKIE, LOCAL_ORIGINS, Accounts
from app.auth import router as auth_router
from app.conversation import Conversation
from app.core import decode_audio
from app.models import MODEL_NAME, ROOT, Models


def create_app(models=None, accounts_path=None):
    @asynccontextmanager
    async def lifespan(app):
        app.state.accounts = Accounts(accounts_path or ROOT / "data/accounts.sqlite3")
        app.state.models = models or Models()
        loading = asyncio.create_task(app.state.models.load())
        yield
        loading.cancel()
        with suppress(asyncio.CancelledError):
            await loading
        await app.state.models.close()

    app = FastAPI(title="Local Voice", lifespan=lifespan)
    app.include_router(auth_router)

    @app.get("/api/health")
    async def health():
        engine = app.state.models
        return {
            "ready": engine.ready, "error": engine.error,
            "load_seconds": engine.load_seconds,
            "stt_device": getattr(engine, "stt_device", "unknown"),
            "tts_device": getattr(engine, "tts_device", "unknown"),
            "stt_compute_type": getattr(engine, "stt_compute_type", "unknown"),
            "warning": getattr(engine, "warning", None),
            "models": {
                "stt": f"{getattr(engine, 'stt_model', 'medium')} · multilingual",
                "llm": MODEL_NAME,
                "tts": "Kokoro · Omega (same speaker for EN / HI)",
            },
        }

    @app.websocket("/ws/conversation")
    async def conversation(ws: WebSocket):
        # Local-only application: deny cross-site WebSocket connections.
        origin = ws.headers.get("origin", "")
        if origin not in LOCAL_ORIGINS or not app.state.accounts.user(ws.cookies.get(COOKIE)):
            await ws.close(code=1008)
            return
        await ws.accept()
        session = Conversation(app.state.models, ws.send_json)
        last_turn = -1
        try:
            while True:
                raw = await ws.receive_text()
                if not app.state.accounts.user(ws.cookies.get(COOKIE)):
                    await ws.close(code=1008)
                    break
                try:
                    if len(raw) > 1_300_000:
                        raise ValueError("Recording exceeds 30 seconds.")
                    event = json.loads(raw)
                    if not isinstance(event, dict):
                        raise ValueError("Expected an event object.")
                    kind = event.get("type")
                    turn = event.get("turn_id")
                    if kind in {"speech", "played"} and (
                        type(turn) is not int or not 0 <= turn <= 2**31 - 1
                    ):
                        raise ValueError("Invalid turn identifier.")
                    if kind == "speech":
                        if turn <= last_turn:
                            raise ValueError("Turn identifiers must increase.")
                        if not app.state.models.ready:
                            raise ValueError("Models are not ready. Check setup and Ollama.")
                        if not isinstance(event.get("pcm"), str):
                            raise ValueError("Missing PCM audio.")
                        input_language = event.get("input_language", "auto")
                        if input_language not in ("auto", "en", "hi"):
                            raise ValueError("Input language must be auto, en or hi.")
                        audio = decode_audio(event["pcm"])
                        last_turn = turn
                        if audio is None:
                            await session.cancel()
                            await ws.send_json({"type": "empty", "turn_id": turn})
                        else:
                            await session.start(turn, audio, input_language)
                    elif kind == "cancel":
                        await session.cancel()
                    elif kind == "reset":
                        await session.cancel()
                        session.history.clear()
                        await ws.send_json({"type": "reset"})
                    elif kind == "played":
                        index = event.get("index")
                        if type(index) is not int or index < 0:
                            raise ValueError("Invalid audio chunk index.")
                        session.ack(turn, index)
                    else:
                        raise ValueError("Unknown event type.")
                except (ValueError, TypeError) as exc:
                    await ws.send_json({"type": "error", "message": str(exc)})
        except WebSocketDisconnect:
            pass
        finally:
            await session.cancel()

    dist = ROOT / "frontend/dist"
    if dist.is_dir():
        app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
    else:
        @app.get("/")
        async def index():
            return FileResponse(ROOT / "docs/not-built.html")

    return app


app = create_app()
