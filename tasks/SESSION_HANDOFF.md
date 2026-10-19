# Session handoff — 2026-10-19

Work resumed: added the desert background, fixed Vite's ONNX runtime URL, restarted
Ollama, and delivered a landing page plus real local accounts and a protected voice
workspace. User authorized creating a new GitHub repository and committing/pushing.
Repository: https://github.com/ss-sevesh/localvoice (private).
Branch before delivery: `feature/hindi-hinglish`; original base: `fcc330a`.

## Latest account experience

- Root is the landing page; `#/signup`, `#/login`, `#/app` use hash routing.
- Accounts and hashed expiring sessions live in ignored `data/accounts.sqlite3`.
  Email is a local identifier. Password recovery and email verification are not included.
- Real voice WebSockets require a session. Logout stops the microphone and revokes it.
- Tooling that connects directly now logs in with LOCALVOICE_EMAIL/LOCALVOICE_PASSWORD
  from the terminal environment; browser tests create an isolated test account.
- Latest checks: 51 backend tests, 20 frontend tests, 12 Chrome scenarios pass;
  Ruff, ESLint, build, production dependency audit and responsive accessibility checks pass.
- The background is a user-supplied GetLayers asset with separate rights; attribution is
  in frontend/public/background. Original upload is preserved locally and ignored.
- App runs at http://127.0.0.1:8000; dev preview at http://127.0.0.1:5173.

The notes below describe the earlier voice-pipeline work and historical measurements.

## Current behavior

- Local English, Hindi and Hinglish voice conversation. Pure Hindi gets Hindi replies;
  mixed speech gets mixed replies; explicit language requests take priority. No Tamil support.
- English/Hindi-constrained multilingual Whisper recognition, manual input-language modes,
  unsupported-script guards, and recoverable errors that keep the microphone connected.
- One fixed Kokoro `hm_omega` speaker across English/Hindi/mixed replies. Pronunciation
  changes by script, then phonemes are joined before synthesis. Piper is for test inputs only.
- Whisper medium CUDA INT8-FP16; Kokoro FP32 CUDA; Qwen 3 4B through local Ollama.
  CPU fallbacks are visible. Project-local NVIDIA runtimes; no global PATH changes.
- Redesigned light chat UI, streaming text/sentence audio, VAD, bounded memory, spoken
  interruptions, and animated current-speaker wave bars/halo with reduced-motion support.

## Latest fix: interruptions transcribed as “Thank you”

User confirmed the wrong words appeared in the transcript, rather than the assistant reply.
Playback now cancels at `onSpeechStart`, before the 250ms `onSpeechRealStart` confirmation.
The complete VAD buffer is preserved; misfires never submit speech. Timer cleanup remains safe.

Recognition uses deterministic temperature 0, beam 3 for <=2-second inputs, otherwise beam 1.
Segments with average log probability below -1 or no-speech probability >=0.6 are rejected.
Auto tries the other supported language at most once. Uncertain results raise `RecognitionError`
and emit recoverable `unclear_speech`, before transcript/history/generation. Genuine thanks are
accepted; there is no phrase blacklist. Accepted confidence values are included in metrics.
Punctuation/emoji-only sentence fragments are excluded from synthesis, addressing a separate
short-reply failure discovered during verification.

Important limitation: the user's actual headset recording was unavailable. Synthetic tests
verify the new behavior, not that every real microphone/echo case is resolved. Ambiguous or
clipped one-word samples can require repetition. Next session should first ask whether the
same interruption works after refreshing the page, and investigate any remaining failure.

## Verification and measurements

- Latest: **45 backend tests, 15 frontend tests, 10 real Chrome scenarios pass**.
- Ruff, ESLint, production TypeScript/Vite build and Git whitespace checks pass.
- Browser scenarios include full English interruption at the original five-second gap,
  short English “No, wait” and Hindi “नहीं, सुनो”, correct transcripts, no old-turn playback
  acknowledgements, language recovery, animations/reduced motion and microphone lifecycle.
- Real-model synthetic checks also preserve “Change the topic” and genuine “Thank you”.
- Same-speaker GPU benchmark: 30 turns, **2465ms median / 3781ms p95**, excluding 3 warmups.
  This benchmark predates the latest interruption confidence/short-clip beam changes;
  it was not rerun afterward. Do not present it as a new measurement of those changes.
- Initial Kokoro CPU benchmark missed the target: 3411ms median / 6060ms p95.
- Human accent quality, perceived speaker consistency, room noise/echo and acoustic
  interruption timing remain listening/headset checks.

## Running and checking

App: http://127.0.0.1:8000. Ollama: http://127.0.0.1:11434.
At handoff the server is ready and both recognition and synthesis report CUDA.
Processes may not survive a new session/reboot; check `/api/health` before starting another.

```powershell
.\scripts\start.ps1
.venv/Scripts/python.exe -m pytest -q
.venv/Scripts/ruff.exe check app tests scripts
cd frontend
npm run test -- --run
npm run build
npm run lint
npx playwright test
```

For controlled latency runs, keep other inference idle and run
`node scripts/benchmark-playback.mjs` from `frontend` (requires CUDA STT and TTS).
Do not lengthen the original interruption gap, remove assertions, or weaken latency budgets.

## Dependencies, ownership and references

- Python `.venv`, models and artifacts are local/ignored; do not commit weights or runtime DLLs.
- Base ONNX Runtime and optional GPU distribution are both pinned to **1.26.0**, matching
  CUDA 12. Setup reinstalls CPU files first and matching GPU files last because the
  distributions share a namespace. Do not independently upgrade either package.
- Kokoro assets have SHA-256 verification in `scripts/setup_models.py`; optional GPU
  dependencies are in `requirements-gpu.in` / `.lock`. CPU-only setup remains supported.
- Source changes are saved but **not committed or pushed**. Preserve all existing changes;
  they include work from this conversation. No external review MCP was installed: the
  installed code-review skill was used. Context7 provided library documentation.
- Requirements/preferences: local-only inference, one consistent voice, automatic matching
  of English/Hindi/Hinglish, responsive accessible UI, reliable fast interruptions.
- Detailed contracts/results: `SPEC.md`, `tasks/todo.md`, `docs/architecture.md`,
  `docs/models.md`, `docs/performance.md`, `docs/review.md`.
- Ignored evidence: `artifacts/latency/playback-results.json`, archived Piper/CPU results,
  `artifacts/same-voice/`, `artifacts/interruptions-before.json`,
  `artifacts/interruptions-after.json`, Chrome screenshots and server logs.
- The exact user microphone audio is not stored. Synthetic interruption probes are smoke
  tests, not a controlled comparison of identical recordings between every run.
- Before restarting, verify the actual process owning port 8000 and its uvicorn command.
  Windows `.venv/Scripts/python.exe` launches a child; killing only its wrapper may leave
  the server running. Use hidden windows for background server starts.
