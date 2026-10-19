# Implementation plan

## Same speaker across languages (2026-10-18)

Replace the two reply voices with local Kokoro and fixed `hm_omega` style.
Phonemize Hindi/English by script, join phonemes, and synthesize each sentence once.
Pin dependencies/assets; verify voice identity routing, WAV output, language switching,
interruption and latency. Retain Piper for stable synthetic microphone fixtures only.

## Approved recovery plan (supersedes the historical plan below)

1. Preserve baseline; add regression tests and supported-language/script guards.
2. Install process-local GPU runtime; medium CUDA, visible small CPU fallback and timings.
3. Redesign light chat UI, language controls and recoverable errors.
4. Review each slice; run unit/build/lint/Chrome checks and 30 warm playback measurements.
5. Document actual results and real-headset checks; leave the application running.

Keep cancellation, bounded memory, localhost origins and local-only inference.

## Historical implementation

Hindi/Hinglish extension: replace English-only recognition with multilingual speech
recognition, select reply language in a separate validated local-model call, synthesize
Hindi and English phrases with the corresponding local voices, then verify switching
and interruption in the real browser. Keep the local-only boundary and existing protocol.

Build a local English voice companion using the approved SPEC.md.
Model pipeline first, browser integration second, streaming/context third,
then VAD and interruption cancellation, followed by UI verification and benchmarks.

Main risks: CPU latency, native inference cancellation, playback/history races,
microphone permissions, offline VAD assets, Windows dependency compatibility.
Mitigate with warm models, short responses, serialized native workers, turn IDs,
playback acknowledgements, explicit cleanup, pinned tested dependencies, and fixtures.

UI: React/TypeScript/Vite, system fonts, neutral surfaces and teal accents. The conversation
and microphone are central; technical details are initially collapsed. Verify in Chrome.

Acceptance, verification and dependencies are tracked in todo.md. Each slice is reviewed
and tested before proceeding. Actual latency and remaining manual checks belong in docs/.
## Landing page and local accounts — 2026-10-19

Delivered the sequence in `docs/account-experience.md`: desert landing, local signup/login,
session-protected workspace, logout, authenticated tools, then browser and security checks.
User approved local accounts and creation of a new GitHub repository. Delivery uses the
private `ss-sevesh/localvoice` repository. Existing multilingual voice work is preserved.
