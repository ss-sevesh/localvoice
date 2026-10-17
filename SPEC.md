# Local Voice

Approved objective: an English general voice companion running locally on Windows,
with React/TypeScript/Vite, FastAPI, Faster-Whisper base.en INT8, Ollama
qwen3.5:2b-q4_K_M, Piper en_US-lessac-medium, and browser Silero VAD.

## Experience
- Automatic speech endpointing, streamed text and sentence audio, session memory.
- Interrupt with speech; immediately stop playback and reject stale turn results.
- Keep history of acknowledged spoken chunks, not unheard generated answers.
- Expandable panel for actual timings; no invented performance results.
- Headphones; single-user localhost; English first; no timeline constraint.
- Downloads allowed during setup; no hosted core inference or runtime CDN assets.

## Architecture
Backend: app/. React: frontend/. Tests: tests/ and colocated frontend tests.
Model setup and benchmarks: scripts/. Submission material: docs/.
GET /api/health provides readiness; /ws/conversation carries versioned turn events.
Models load once. Blocking CPU work runs off the event loop. Resources and history
are bounded. Clear cancels work and resets memory; disconnect destroys the session.

## Verification
Use pytest and Ruff for backend; Vitest, ESLint, TypeScript and Vite build for frontend.
Inspect actual Chrome rendering, accessibility, networking and audio flows.
Test silence, invalid audio, failed dependencies, context, reset, and cancellation.
Benchmark ten warm turns and cold startup separately, with median and p95.
Targets: median first audible reply <=5s; confirmed interruption to silence <=300ms.
These are goals, never a substitute for observed results.

## Boundaries
Always validate input and escape transcript output; never persist personal recordings
by default or commit model binaries/secrets. Ask before external publication or changing
the agreed local-only inference scope. No accounts, cloud hosting, or persistent memory.

## UI contract
Warm neutral page, dark text, teal controls; transcript is the primary content.
Persistent voice controls, explicit activity states, expandable timing details.
Keyboard-operable labelled controls, contrast, reduced motion, responsive at 320–1440px.
No external fonts, generic card dashboard, or animated decoration.

## Commands
Setup: uv venv --python 3.11 .venv; uv pip install --python .venv/Scripts/python.exe -r requirements.lock
Dev backend: python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
Dev frontend (frontend/): npm run dev
Backend checks: python -m pytest -q; python -m ruff check .
Frontend checks (frontend/): npm run test -- --run; npm run lint; npm run build

Use typed Python snake_case functions, TypeScript strict mode, and small focused components.
Review completed increments for correctness, security, architecture, and performance.
