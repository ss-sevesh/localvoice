# Tasks

Session saved 2026-10-19. Resume from [SESSION_HANDOFF.md](SESSION_HANDOFF.md).

## Interruption transcription

- [x] Confirm transcript vs reply error and inspect capture/recognition boundaries.
- [x] Cancel at speech onset, preserve audio, reject VAD misfires and uncertain decoding.
- [x] Recover without adding a guessed turn; preserve genuine thanks and valid short speech.
- [x] Backend/frontend regression tests, lint and production build.
- [x] All ten Chrome scenarios pass, including the original interruption timing and
  short English/Hindi interruptions with correct transcripts and no stale playback.

## One speaker across languages

- [x] Replace separate reply voices with fixed Kokoro Omega speaker.
- [x] Preserve script-specific pronunciation and combine phonemes before synthesis.
- [x] Pin/checksum assets and dependencies; prefer CUDA FP32 with CPU INT8 fallback.
- [x] Report TTS device and fallback warning; preserve microphone and interruption behavior.
- [x] Review and verify: 40 backend tests, 14 frontend tests, eight Chrome scenarios,
  Ruff, ESLint and production build. Real CPU fallback and five-case switching checks pass.
- [x] Final GPU playback benchmark: 2,465ms median / 3,781ms p95 across 30 turns.
- [x] Speaking waveform and halo, limited to current playback, with reduced-motion support.

## Recovery and redesign

- [x] Baseline/spec and regression tests.
- [x] Supported-language STT, script guards and recoverable protocol errors.
- [x] CUDA setup, GPU recognition, explicit CPU fallback and stage timings.
- [x] Light chat UI, input modes, detected language and recoverable errors.
- [x] Code review, backend/frontend checks and Chrome regression scenarios.
- [x] 30-turn warm playback benchmark, results and running local link.

Final verification: 34 backend tests, 13 frontend tests, eight Chrome scenarios,
Ruff, ESLint, TypeScript/Vite production build. Thirty warm browser turns passed
the latency budget: 2384ms median, 3702ms p95. Server ready on CUDA at port 8000.

Manual release check: user microphone/accent/headphones in the intended room.

## Historical implementation

Hindi/Hinglish extension: multilingual recognition, per-turn language selection,
phrase-level Hindi/English voices, setup, documentation, unit tests, and synthetic
switching checks implemented. Browser verification includes two additional language
flows. Human microphone/accent testing remains a user check.
Verified: 22 backend tests, 11 frontend tests, seven Chrome scenarios (including targeted
reruns after fixture fixes), production build, ESLint and Ruff. Language switching is
also checked with synthetic audio and actual local inference.

- [x] 1. Setup and health: reproducible dependencies, model readiness; verify health/build.
- [x] 2. Real local pipeline: WAV -> STT -> LLM -> TTS; verify actual inference.
- [x] 3. Browser conversation: capture -> response -> playback; verify Chrome permissions.
- [x] 4. Stream and remember: sentence queue, context, playback acknowledgements; test order/reset.
- [x] 5. Automatic endpointing: local VAD, silence/misfire handling; verify real audio fixtures.
- [x] 6. Interruptions: cancel old work, stop playback, reject stale results; test all stages.
- [x] 7. React finish: accessible responsive UI and timings; verify build/tests/Chrome.
- [x] 8. Submission: benchmarks, README, architecture, demo material; document remaining manual work.

Dependencies: each task depends on its predecessor. Review and run relevant tests after each slice.

Executed: 13 backend tests, 11 frontend tests, 5 real Chrome integration tests; production
build, ESLint, Ruff, automated accessibility checks and production npm audit pass.
Two review findings fixed and independently re-reviewed. Stale-audio mutation was detected.

Remaining user submission steps: verify the real microphone/headphones in the intended room,
choose a GitHub remote and push, upload the labelled 2:06 automated demo (or record a human
version using docs/demo.md). No repository or video was externally published.
## Landing page and local accounts — 2026-10-19

- [x] Design the landing, signup/login and workspace flow using the supplied desert assets.
- [x] Store local accounts securely and protect voice sessions; preserve voice behavior.
- [x] Verify signup/login/logout, session expiry/revocation, origin checks and rate limiting.
- [x] Adapt benchmark/demo tools and existing voice tests to authenticate.
- [x] Pass 51 backend tests, 20 frontend tests, 12 Chrome scenarios, lint/build and audit.
- [x] Verify WCAG A/AA and responsive layouts; preserve reduced-motion behavior.
- [x] Create the private GitHub repository `ss-sevesh/localvoice`.
