# Tasks

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
