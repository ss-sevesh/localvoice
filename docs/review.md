# Review and verification

## Assignment audit: 2026-10-19

Mapped every required capability, technical expectation, bonus feature, and deliverable
in the [submission checklist](submission-checklist.md). Inspected the real STT/LLM/TTS
implementation, bounded spoken history, local model setup, browser asset copying,
and recording assertions. Core inference has a fixed local Ollama endpoint and local
speech weights; model download services are used during setup, not hosted inference.
Checked the upstream Whisper, Qwen and Kokoro model sources and existing notices.

Fresh checks: **54 backend tests, 20 frontend tests, all 12 Chrome scenarios**, Ruff,
ESLint, TypeScript and Vite production build passed. Browser scenarios include actual
English/Hindi/Hinglish inference/playback, English/Hindi spoken interruptions, account
flows, microphone recovery, responsive layouts and accessibility. The network check
for the real voice flow detected no offsite application HTTP requests.

The controlled 30-turn repeat measured **3,499 ms median / 5,406 ms p95**. It failed
the existing 3s/5s internal budget, without any assertions or thresholds being weakened.
Published [raw results](benchmark-current.json), refreshed the README's headline
timings, and retained historical baselines separately. A four-input follow-up probe
showed contributions from STT, sentence completion, and synthesis; it did not isolate
the historical regression. It also exposed answer-quality limitations in Hindi and
Hinglish. The assessment should distinguish working multilingual speech from robust
factual accuracy and human-rated naturalness.

Verified both MP4s have H.264 video and 48 kHz AAC audio: 151.0 seconds original,
120.8 seconds at 1.25×. The published README uses a native GitHub attachment player,
previously checked with unmuted playback. Both encoded exports were checked for
recognizable English and Hindi questions and actual replies. Synthetic input and
speed adjustment are disclosed; original-speed timing values are unchanged.

Fixed an outdated architecture paragraph that denied database storage after local
account support was added. Clarified the short-clip beam policy in the README.
No application logic changed. A clean installation on a different machine and human
headset/accent/noise listening were not performed during this audit. Assignment
receipt date and deadline are not available; no submission was sent to the company.

## Interruption transcription hardening

User confirmed the incorrect "Thank you" appeared in the transcript. Inspection found
that playback continued until VAD's 250ms confirmation and decoder confidence was ignored.
New regression tests first reproduced acceptance of uncertain guesses. Playback now
cancels on speech onset while preserving the full buffered clip. VAD misfires send no
utterance. Deterministic short-clip beam search and segment-confidence gates prevent
uncertain text from entering history or triggering generation; recovery keeps the mic open.
Genuine thanks remain accepted. Punctuation/emoji-only sentence fragments are excluded
from synthesis, fixing a separate short-reply failure seen during verification.

45 backend tests and 15 frontend tests pass, alongside Ruff, ESLint and production build.
All ten Chrome scenarios pass, including original full English interruption, short
"No, wait" and Hindi "नहीं, सुनो" interruptions, with no old-turn playback acknowledgements.
Synthetic checks retain correct "No, wait", "Change the topic", Hindi "नहीं, सुनो" and
genuine "Thank you"; noise/clipped or ambiguous one-word samples can require a repeat.
The exact user's headset recording was unavailable; live microphone/echo remains a
manual check. No real microphone recordings are retained by the application.

## Same speaker across English, Hindi and Hinglish

Speaking animation follows the existing teal wave mark and toolbar design. Staggered
bar transforms and a subtle halo identify assistant playback without moving the layout.
Only the current reply animates; mic speech and interruption stop it. Existing reduced
motion rules keep the indicator static. Unit coverage checks generating vs speaking,
historical replies, user speech and interruption; Chrome checks actual playback,
computed animation styles, reduced motion and return to listening.
The visual finish check also corrected the stop button's hover background, which
inherited the start button's green treatment and reduced its text contrast.

Replaced two reply-speaker models with one local Kokoro model and fixed
`hm_omega` style. Language-specific phonemes are joined before synthesis instead of
joining audio from different speakers. Hindi danda is normalized for the phonemizer.
Reviewed model loading, offline assets, worker serialization, PCM conversion and
unchanged cancellation/backpressure. Setup verifies SHA-256 before replacing assets.

40 backend tests pass, including fixed speaker routing, pronunciation order, 24 kHz
WAV encoding, unsupported-script/empty-phoneme rejection, corrupt-download handling,
CUDA warmup, silent provider fallback and CPU recovery without losing STT warnings.
Frontend unit tests: 14 pass; production build and ESLint pass. Final 30-turn GPU
playback benchmark passed at 2.465s median / 3.781s p95, preserving the latency budget.
All eight real Chrome scenarios pass, including Hindi, Hinglish and spoken interruption
with the original five-second gap. Ruff passes. Synthetic checks cannot establish
perceived speaker similarity, pronunciation quality or human headset performance.

## Recovery and light-workspace redesign

Local code review covered script boundaries, explicit recognition modes, failure
recovery, native resource ownership, async cancellation, GPU/CPU profiles, stage
timing definitions and accessible UI states. Review findings addressed:

- CTranslate2's native loader needs the NVIDIA DLL directories in the current
  process PATH as well as Python DLL search handles. No system PATH is changed.
- Script checks run before transcript/history and before generated text or audio;
  unsupported content is never silently stripped or labelled Hindi.
- Recoverable recognition errors stop stale playback without closing the microphone
  or WebSocket. The next utterance clears the error and snapshots the selected mode.
- GPU fallback is warmed, tested and reported explicitly instead of claiming GPU speed.
- Compact-height layouts leave room for the microphone bar; controls retain pressed
  states, accessible names and visible keyboard focus.

Backend: 34 tests passed. Frontend: 13 tests, production build, ESLint and Ruff passed.
All eight Chrome scenarios passed in a single run: real speech/playback, responsive
accessibility, recoverable language error with a manual mode change, Hindi, Hinglish,
interruption at the original five-second gap, microphone denial and cancelled startup.
The 30-turn Chrome playback benchmark passed at 2.384s median / 3.702s p95. No failing
assertions, tests or performance budgets were removed or relaxed. Manual headset and
accent/noise checks remain necessary; synthetic checks do not establish speech accuracy.

## Hindi and Hinglish extension

The multilingual extension adds Whisper medium, Qwen 3 4B, structured per-turn language
selection, Hindi/English phrase synthesis, and Hindi sentence boundaries. Backend
verification now includes 22 tests, including original-language recognition settings,
voice/PCM ordering, language policy validation, and unchanged session history. Tests
also verify mixed-language repair before playback and rejection of a failed repair.
Frontend unit tests (11), production build, ESLint, and Ruff passed. New browser checks exercise
Hindi and Hinglish input through VAD, recognition, reply generation, and audio playback.
All seven browser scenarios passed across the initial run and targeted reruns after
fixing the two synthetic fixtures; no assertions were removed or weakened.

The synthetic language-check script covers English → Hindi → Hinglish → English and
an explicit English reply request spoken in Hindi. Its script checks test the presence
of Hindi/English letters, not fluency or factual quality. English loanwords in the
Hinglish fixture are spelled phonetically in Devanagari for the Hindi synthetic voice;
this is not evidence of recognition accuracy across human accents. The two voices
can sound different within a mixed sentence. Real headset/accent testing remains manual.

The existing playback-interruption fixture now waits 12 seconds instead of five before
the second utterance so it reaches playback after the slower medium recognizer.
Interruption assertions still require an interrupted response and no stale acknowledgements.

## Original English-only implementation

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
