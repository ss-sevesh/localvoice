# Implementation plan

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
