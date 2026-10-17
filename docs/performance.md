# Observed performance

Measured on the development laptop during implementation: Intel Core i7-13620H,
16 GB RAM, Windows, CPU inference. No GPU acceleration was used. This is one
ten-turn warm run, not a controlled cross-machine benchmark.

| Metric | Median | p95 |
|---|---:|---:|
| Speech-to-text | 1,740.8 ms | 2,452.2 ms |
| Upload to first LLM text | 2,480.6 ms | 4,381.3 ms |
| Upload to first audio received | 4,237.3 ms | 6,785.6 ms |
| Server pipeline completion | 5,658.5 ms | 7,382.9 ms |

Model initialization and warmup took 8.15 seconds in the observed server startup.
The sample count is only ten, so nearest-rank p95 equals the largest observation.
See [raw prompts, transcripts and outputs](benchmark-initial.json).

## Method and interpretation

`scripts/benchmark.py` synthesizes ten English prompts with Piper, resamples to 16 kHz,
and sends them through the actual FastAPI WebSocket → Whisper → Ollama → Piper pipeline.
It acknowledges output chunks immediately, without waiting for an audio device.

The table excludes microphone capture, VAD endpoint delay, browser audio decode and
playback. It measures first audio *availability*, not perceived or acoustic response time.
Stage metrics are cumulative from upload where specified, not additive independent costs.
Server completion includes synthesis and any playback backpressure in interactive use;
the headless benchmark avoids that backpressure with immediate acknowledgements.

The browser timing panel additionally measures first playback from the last positive
VAD frame and complete turn duration. That frame is an estimated speech endpoint,
not a manually annotated acoustic boundary. Playback stop dispatch measures the duration
of the browser stop call; acoustic interruption latency has not been measured.

One real-browser synthetic-microphone run observed 570 ms endpoint detection, 799 ms STT,
and 2,413 ms from estimated speech end to first playback. This is a single integration
sample shown in the interface screenshot, not the median of the benchmark above.

## Quality findings

All ten synthetic prompts were transcribed intelligibly. The follow-up correctly recalled
the name Mira from the previous turn. Synthetic clean speech does not validate accents,
room noise, or human English recognition accuracy.

The small quantized LLM generated an incorrect space fact in the initial run, claiming some
stars are closer than the Moon. That is false. Some answers also included unnecessary
social follow-ups. This baseline demonstrates the tradeoff of a small local model; the
assistant is not a factual authority. A larger model or additional evaluation would be
needed before trusting answer quality in a specialized application.

## Optimizations implemented

- INT8 STT, beam size one, six CPU threads, English model.
- Persistent model instances, startup warmup, Ollama keep-alive, thinking disabled.
- Short system prompt, bounded history, 128-token response cap.
- Concurrent LLM streaming and sentence synthesis, bounded queues and playback window.
- Local VAD and static runtime assets; no inference network round trips outside localhost.
- Serialized native workers: cancellation discards results without running overlapping
  model calls against the same engine.

## Remaining checks

Measure at least ten real human turns with the actual headset in the intended room.
Report accent/noise failures, perceived first-audio latency, and acoustic interruption
delay separately. Targets are five-second median first audible reply and 300 ms acoustic
interruption response; these targets are not established by the headless benchmark.
