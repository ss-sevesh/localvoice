# Review and verification

An independent read-only reviewer examined the specification, backend orchestration,
React resource ownership, audio cancellation, history handling, and related tests.

Two required findings were addressed:

1. **VAD startup cleanup:** vad-web 0.0.31 cannot destroy an incompletely initialized
   microphone instance using its public destroy method. Added a narrowly typed,
   version-specific cleanup adapter. It releases the loaded ONNX model after permission
   denial, stops acquired tracks after worklet failure, and closes owned audio contexts.
   Cancellation waits for pending startup to settle before releasing its model; opening
   tracks stop immediately. All callbacks reject stale startup epochs.
2. **False interrupted labels:** completed turns were retired in the browser client but
   not its reducer. Added an explicit completion action so the next utterance or End
   conversation does not mark a fully played answer as interrupted.

The follow-up reviewer confirmed both fixes and reported no further high-confidence
required findings. That review inspected tests; execution results below were produced
by the implementing agent.

## Executed verification

Final counts: 13 backend tests, 11 frontend unit/component tests, and 5 Chrome integration
tests passed. Production npm audit reported zero vulnerabilities.

- Backend behavior/integration tests: audio validation, silence, sentence buffering,
  bounded history, sequential playback acknowledgements, model failure, backpressure,
  synthesis failure, cancellation and stream cleanup, origin rejection and reset.
- Frontend unit/component tests: stale events, audio decode cancellation, completed
  playback acknowledgements, readiness/error controls, reset, completed-turn state,
  and partial-initialization cleanup.
- TypeScript/Vite production build, ESLint, Ruff.
- Real Chrome with local models and a synthetic microphone: VAD → STT → LLM → TTS →
  playback; spoken interruption and no old-turn playback acknowledgements; no external
  runtime asset requests; responsive screenshots at 320, 768, 1024 and 1440 pixels;
  automated WCAG A/AA accessibility checks.
- Additional Chrome checks: denied microphone permission can be retried; cancelling
  during delayed VAD asset loading does not reactivate the microphone.

No skipped tests or lint suppressions were introduced. Generated demo output is explicitly
labelled synthetic; it is not a claim of human microphone testing. Real accent/noise,
speaker echo, and acoustic output timing remain manual checks.

Mutation check: inverted the audio player's stale-decode generation guard. Two targeted
audio tests failed, confirming they detect that regression. Restored the source
byte-for-byte afterward.
