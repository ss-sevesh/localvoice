# Tasks

- [ ] 1. Setup and health: reproducible dependencies, model readiness; verify health/build.
- [ ] 2. Real local pipeline: WAV -> STT -> LLM -> TTS; verify actual inference.
- [ ] 3. Browser conversation: capture -> response -> playback; verify Chrome permissions.
- [ ] 4. Stream and remember: sentence queue, context, playback acknowledgements; test order/reset.
- [ ] 5. Automatic endpointing: local VAD, silence/misfire handling; verify real audio fixtures.
- [ ] 6. Interruptions: cancel old work, stop playback, reject stale results; test all stages.
- [ ] 7. React finish: accessible responsive UI and timings; verify build/tests/Chrome.
- [ ] 8. Submission: benchmarks, README, architecture, demo material; document remaining manual work.

Dependencies: each task depends on its predecessor. Review and run relevant tests after each slice.
