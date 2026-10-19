# Local Voice

## Approved recovery and redesign (2026-10-18)

This section supersedes older device, UI and performance defaults below.
- English, Hindi and Hinglish only; Hindi display uses Devanagari. No Tamil support.
- Auto input chooses only en/hi from Whisper scores; explicit English or Hindi/Hinglish
  modes bypass detection. Reject unsupported script before transcript emission, history,
  generated text emission or synthesis. Auto retries once with the other language;
  recognition errors remain recoverable without disconnecting the microphone.
- Default STT: medium CUDA int8_float16. Install pinned CUDA 12 / cuDNN 9 Windows
  wheels in .venv and register process-local DLL directories. GPU failures use small
  CPU INT8 with a visible degraded-profile warning. Keep Ollama and STT resident.
- Warm short-turn first playback target: median <=3s and p95 <=5s, including endpoint
  detection. Measure all stages; benchmark 30 turns (10 per language, 2-8s utterances).
- Full light chat workspace redesign: cool white/slate/teal, centered transcript,
  language controls, detected-language label, persistent voice toolbar, explicit states,
  recoverable errors and collapsible technical details. Accessible down to 320px.
- Speaking animates the current assistant avatar and toolbar wave mark, using the
  actual playback phase. Stop on interruption, mic speech, completion or disconnect;
  historical avatars remain still. Respect reduced-motion preferences.
- Cancel playback on the first VAD speech-start event; keep the complete buffered
  utterance and submit only after VAD confirms speech. Misfires never become turns.
- Decode deterministically; use beam 3 for clips up to two seconds, beam 1 otherwise.
  Reject segments with average log probability below -1 or no-speech probability >=0.6,
  retry the other supported language once in Auto, and return recoverable `unclear_speech`
  rather than inserting uncertain guesses into chat/history. Genuine thanks remain valid.
- Backward-compatible protocol: optional input_language auto/en/hi on speech;
  language on transcript; recoverable error/code fields; actual STT model/device and
  fallback warning in health; additional stage timings. No persistent conversations.
- Review each slice with the installed review skill and real Chrome. Do not weaken
  assertions or lengthen interruption fixtures to accommodate regressions.

Approved objective: a Hindi, English, and Hinglish voice companion running locally on Windows,
with React/TypeScript/Vite, FastAPI, multilingual Faster-Whisper medium INT8, Ollama
qwen3:4b-instruct-2507-q4_K_M, Kokoro with one Omega speaker, and browser Silero VAD.

## Experience
- Automatic speech endpointing, streamed text and sentence audio, session memory.
- Interrupt with speech; immediately stop playback and reject stale turn results.
- Keep history of acknowledged spoken chunks, not unheard generated answers.
- Expandable panel for actual timings; no invented performance results.
- Headphones; single-user localhost; Hindi, English, and Hinglish; no timeline constraint.
- Match the latest utterance: Hindi replies to Hindi, English to English, and natural
  mixed Hindi/English to Hinglish. Explicit reply-language requests take priority.
- Transcribe original speech rather than translating it. Write Hindi in Devanagari
  so local Hindi synthesis can pronounce it; English words may remain in Latin script.
- Infer reply language in a separate structured local-model call, validate its enum,
  and apply a clear language instruction to the streamed reply for each turn.
- Use the same Kokoro Omega speaker for English, Hindi and Hinglish. Select pronunciation
  by script, then synthesize the combined phonemes into one 24 kHz sentence WAV.
  Prefer CUDA FP32 with bounded workspace; CPU INT8 remains a slower fallback. Warm
  actual synthesis before reporting readiness, and report the actual TTS device.
  Preserve sentence streaming, interruption, bounded history, and local-only inference.
- Verify Hindi punctuation boundaries and voice selection with unit tests; exercise
  English, Hindi, Hinglish, switching, and explicit overrides with local inference.
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
Cool light workspace, slate text and teal controls; transcript is the primary content.
Persistent voice controls, explicit activity states, expandable timing details.
Input mode pills and detected-language labels; recoverable errors keep the mic connected.
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
