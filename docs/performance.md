# Observed performance

## Published English + Hindi demo

The demonstration in GitHub Release `demo-v1` (2:31 original, 2:01 at 1.25×) shows **1,833 ms** to first voice
for its last recorded turn, from the final detected speech frame to browser playback
start. The synthetic take verifies six turns, English/Hindi replies, streamed text
and audio, and a spoken interruption. This is one observed turn; it does not replace
or rerun the controlled 30-turn benchmark below. Both input and reply audio are
present in both exported MP4s. Playback speed does not change the original measured
latency; see `docs/demo.md` for chapters and the recording method.

## One speaker: Kokoro Omega on CUDA

Final same-speaker run: 30 synthetic Chrome microphone turns (10 per language), with
three excluded warmups and the same fixed input recordings as the Piper recovery run.
Whisper medium, Qwen and Kokoro FP32 used the RTX 4060; Kokoro retained `hm_omega`
for all languages. Speech end to browser playback start, not acoustic latency:

| Language | Median | p95 |
|---|---:|---:|
| All 30 turns | **2,465 ms** | **3,781 ms** |
| English (10) | 1,960 ms | 2,398 ms |
| Hindi (10) | 3,292 ms | 3,999 ms |
| Hinglish (10) | 2,693 ms | 3,314 ms |

The overall <=3s median / <=5s p95 budget passed. Current startup was 4.758s.
Results: `artifacts/latency/playback-results.json`. No other inference ran concurrently.
This run predates the subsequent short-interruption confidence checks and beam-3 policy
for <=2-second clips. The full latency benchmark was not repeated for that change.

The initial Kokoro CPU run missed the budget (3,411ms median / 6,060ms p95), archived
in `artifacts/latency/playback-results-kokoro-cpu.json`. CUDA FP32 restored the target;
the quantized export is retained only as a slower CPU fallback. A controlled thread
check observed six CPU threads at 1,118–1,187ms for the same Hindi passage versus
1,226–1,245ms with four; this tuning alone did not explain the GPU improvement.

Short fixed English/Hindi/Hinglish output samples synthesized in 173–246ms on CUDA.
English and Hindi were accurately retranscribed by the local small recognizer; the
mixed sample included recognition/pronunciation ambiguities. This does not establish
perceived speaker similarity or human pronunciation quality. Samples and results are
under `artifacts/same-voice/`; listening with the intended headphones remains necessary.

## Previous recovery baseline: Piper output

Before the same-speaker Kokoro change: **30 warm turns**, ten each English/Hindi/Hinglish, plus three
excluded warmups. Real local recognition, generation, synthesis, VAD and browser audio
playback ran on the development laptop. Medium STT used CUDA int8_float16; Qwen used
the GPU concurrently; Piper used four CPU intra-op threads.

| First playback after estimated speech end | Median | p95 |
|---|---:|---:|
| All 30 turns | **2,384 ms** | **3,702 ms** |
| English (10) | 1,765 ms | 2,104 ms |
| Hindi (10) | 2,968 ms | 3,494 ms |
| Hinglish (10) | 2,605 ms | 3,861 ms |

The overall <=3s median / <=5s p95 target passed. Inputs are synthetic 2–8-second
utterances. The metric is the last positive browser VAD frame to AudioBufferSource.start,
not acoustic latency or proof of human accent accuracy. New isolated Chrome instances
used a warm resident backend. No other inference tests ran during measurement.
Archived results: `artifacts/latency/playback-results-piper.json`; reproduce with the README's
browser benchmark commands. Current startup was approximately 9.2 seconds, separate
from warm response measurements. CPU fallback does not carry this latency target.

### Measured changes

- Before recovery, the saved five-case check recorded recognition at 5.79–7.45s on
  CPU. The first GPU check recorded 1.19–2.26s. Those are matched prompts from smoke
  tests, not a controlled acoustic comparison of bit-identical recordings.
- A four-repeat Hindi synthesis experiment compared identical text with default,
  one, two and four ONNX threads. Default warm runs were 985–1,083ms; four threads
  were 265–299ms. Four threads were retained; no output stage was removed.
- The original five-second interruption fixture timing is restored. It is no longer
  lengthened to accommodate CPU recognition.

## Historical baselines

The table below is the original English-only baseline (`base.en` and Qwen 3.5 2B).
It is not a measurement of the current Hindi/Hinglish pipeline, which uses Whisper
medium and Qwen 3 4B. The final five-turn synthetic language-switching check on the current
pipeline observed 6.36–9.34 seconds from upload to first audio, with all five language
script checks passing. This is smoke-test timing, not a controlled benchmark.
The five-second target is not established for this multilingual setup. In the final
check, speech recognition/synthesis used CPU and Ollama reported 100% GPU for Qwen.
The final check includes Hindi, English, Hinglish, switching back to English, and an
explicit English-language override spoken in Hindi; see `artifacts/language-check.json`.

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
- Short system prompt and bounded history; the original response cap was 128 tokens,
  now 192 to allow Hindi subword tokens. Language selection adds a small local model call.
- Concurrent LLM streaming and sentence synthesis, bounded queues and playback window.
- Local VAD and static runtime assets; no inference network round trips outside localhost.
- Serialized native workers: cancellation discards results without running overlapping
  model calls against the same engine.

## Remaining checks

Measure at least ten real human turns with the actual headset in the intended room.
Report accent/noise failures, perceived first-audio latency, and acoustic interruption
delay separately. Targets are five-second median first audible reply and 300 ms acoustic
interruption response; these targets are not established by the headless benchmark.
