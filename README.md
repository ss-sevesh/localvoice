<p align="center">
  <img src="docs/assets/hero.svg" width="100%" alt="Local Voice — think out loud, keep it local. English, Hindi and Hinglish." />
</p>

<h1 align="center">Your voice. Your language. Your own device.</h1>

<p align="center">
  A private voice companion that listens, remembers and speaks back.<br />
  Built for natural conversations in <strong>English, Hindi and Hinglish</strong>.
</p>

<p align="center">
  <a href="#how-it-works"><img src="https://img.shields.io/badge/inference-100%25_local-d6baff?style=flat-square&amp;labelColor=161123" alt="All inference runs locally" /></a>
  <a href="docs/models.md"><img src="https://img.shields.io/badge/pipeline-Whisper_%E2%86%92_Qwen_%E2%86%92_Kokoro-d6baff?style=flat-square&amp;labelColor=161123" alt="Whisper, Qwen and Kokoro" /></a>
  <a href="#development-and-tests"><img src="https://img.shields.io/badge/verified_locally-54_backend_%C2%B7_20_frontend_%C2%B7_12_Chrome-b8ddcb?style=flat-square&amp;labelColor=161123" alt="Verified locally: 54 backend tests, 20 frontend tests and 12 Chrome scenarios" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/ss-sevesh/localvoice?style=flat-square&amp;labelColor=161123&amp;color=c1b7d2" alt="GPL source license" /></a>
</p>

<p align="center">
  <a href="#watch-the-demo"><strong>Watch the demo</strong></a> ·
  <a href="#the-experience">Features</a> ·
  <a href="#run-on-windows">Quick start</a> ·
  <a href="#how-it-works">Architecture</a> ·
  <a href="docs/models.md">Models</a> ·
  <a href="docs/performance.md">Measurements</a>
</p>

---

## Watch the demo

[![Local Voice demo — AI that talks back in English, Hindi and Hinglish](docs/assets/demo-thumbnail.png)](https://github.com/user-attachments/assets/3bb6e61a-1cca-450a-a1ea-0792584dde63)

**English + Hindi · 2:01 · 1.25× playback · sound on**

https://github.com/user-attachments/assets/3bb6e61a-1cca-450a-a1ea-0792584dde63

<p align="center">
  <a href="https://github.com/ss-sevesh/localvoice/releases/download/demo-v1/local-voice-demo-1.25x.mp4">Download the 1.25× version</a> ·
  <a href="https://github.com/ss-sevesh/localvoice/releases/download/demo-v1/local-voice-demo.mp4">Original-speed video · 2:31</a> ·
  <a href="docs/demo.md">Chapters &amp; recording method</a>
</p>

Simple questions, real spoken replies, a remembered name, and a cat story interrupted
by “just say hello.” Both sides are audible. Input and narration are synthetic;
assistant replies come from the running local models. **Playback is sped up;
on-screen latency values were measured at original speed.**

## The experience

| Speak naturally | Keep the conversation flowing | Keep it yours |
|---|---|---|
| **English, Hindi & Hinglish**<br />Automatic language matching, plus manual recognition modes. | **Streamed text & sentence audio**<br />Read the reply as it arrives and hear it sentence by sentence. | **Local inference**<br />Whisper, Qwen, Kokoro and VAD run on your machine. |
| **Hands-free VAD**<br />Pause to send your words; no push-to-talk button for each turn. | **Spoken interruptions**<br />Start speaking to stop the current reply and begin a new turn. | **Session-only conversations**<br />Bounded spoken memory, no saved conversation history. |

<p align="center">
  <img src="docs/assets/conversation.gif" width="800" alt="Silent animated preview of the real English and Hindi voice workspace. Use the video above to hear both speakers." />
  <br /><sub>Silent interface preview · the full video above includes audio.</sub>
</p>

<details>
<summary><strong>Explore the landing page and local account experience</strong></summary>

![Local Voice landing page](docs/interface.png)

![Create a local account](docs/signup.png)

Accounts stay in an ignored local SQLite database. Sign in, open your voice
workspace, and log out to stop the microphone and revoke the session.
[Design and account flow](docs/account-experience.md).

</details>

## Submission deliverables

[Requirement-by-requirement verification](docs/submission-checklist.md) maps the
assignment to implementation, tests, and demonstration evidence.

| Deliverable | Jump to |
|---|---|
| Complete source code | [This repository](https://github.com/ss-sevesh/localvoice) |
| Installation and setup | [Quick start](#run-on-windows) |
| 2–3 minute demonstration | [Inline player](#watch-the-demo) · [release files](https://github.com/ss-sevesh/localvoice/releases/tag/demo-v1) |
| STT → LLM → TTS diagram | [Architecture](#how-it-works) · [protocol details](docs/architecture.md) |
| Models and hardware | [Models](docs/models.md) · [hardware profile](#run-on-windows) |
| Observed response latency | [Measurements and limitations](docs/performance.md) |

## Run on Windows

Tested with Windows, an Intel i7-13620H, 16 GB RAM, and Node 24.
Speech recognition and synthesis use the NVIDIA GPU when available, with CPU fallbacks.
Ollama selects an available accelerator. The tested GPU is an RTX 4060 Laptop (8 GB).
Use headphones and a microphone. Reserve several GB of disk space for dependencies
and model downloads. No API keys or paid inference services are needed.

Prerequisites: [uv](https://docs.astral.sh/uv/getting-started/installation/),
[Node.js 24 LTS](https://nodejs.org/), [Ollama](https://ollama.com/download), and Chrome/Edge.
Keep the Ollama application running. FFmpeg is needed only to export the automated demo.

From PowerShell:

```powershell
git clone https://github.com/ss-sevesh/localvoice.git
cd localvoice
.\scripts\setup.ps1
.\scripts\start.ps1
```

Open **http://127.0.0.1:8000**. Choose **Get started** to create a local account, or
**Log in** to return to your workspace. Use a password of at least 12 characters.
Wait for “All models local,” then click **Start conversation**
and allow microphone access. Pause to send a turn; speak again to interrupt. End conversation
releases the microphone. Clear conversation resets the transcript and context.
Interruption stops playback at the first speech detection while keeping the full
recording. Uncertain recognition asks you to repeat instead of accepting a low-confidence
guess as a new message; genuine "thank you" is still accepted.

Accounts are stored only in `data/accounts.sqlite3` (ignored by Git). Passwords use
salted scrypt hashes; seven-day sessions use revocable HttpOnly/SameSite cookies.
Email is a local identifier: there is no verification, email delivery or password
recovery. Conversations remain in the current session and are not saved to accounts.
Keep `data/` if you want to retain accounts when moving or backing up the project.
The server binds to loopback; this account system is intended for this local app.

The landing page, sign-up, login and voice workspace share the supplied purple desert
background. Pause/play controls and reduced-motion support are available throughout.
See [the account experience plan](docs/account-experience.md) for the flow and checks.

For authenticated benchmark, language-check and demo scripts, first create an account
in the UI, then set `LOCALVOICE_EMAIL` and `LOCALVOICE_PASSWORD` in your terminal's
environment. Scripts log in with that account; credentials are not written to files.
Clear those environment variables after use. Browser tests create their own test account.

Speak Hindi for Hindi replies, English for English replies, or mix both for Hinglish.
You can also ask explicitly to answer in a particular language. Hindi appears in
Devanagari in the transcript and replies; English words can appear alongside it.
The assistant infers reply language from your latest utterance and conversation context.
Use **Auto**, **English**, or **Hindi / Hinglish** above the transcript to choose the
recognition mode. Auto considers English and Hindi only. Unsupported scripts are
rejected before display or memory; recognition errors let you retry without restarting
the microphone. Detected Hindi is displayed in Devanagari, not Tamil or Roman Hindi.
For Hinglish, it checks that a reply contains both scripts before starting speech;
a single-language draft gets one short, relevant continuation in the missing language,
or a retry error is shown. This fallback mixes languages between sentences.

Setup creates `.venv` with Python 3.11, installs locked dependencies, downloads speech models,
ensures the Ollama model exists, and builds React. Normal startup does not download assets.
The first setup requires internet; the application works offline after setup.
On Windows with an NVIDIA GPU, setup also installs the pinned CUDA 12/cuDNN 9 runtime
from `requirements-gpu.lock` into `.venv` (approximately 1.8 GB download). DLL discovery
changes only the application process. No system-wide CUDA or PATH modification is needed.
For CPU-only installation, use `scripts/setup.ps1 -CpuOnly`. To force CPU recognition,
set `$env:STT_DEVICE='cpu'` before starting; the interface reports the slower small-model
fallback explicitly. This profile does not carry the GPU latency target.

If PowerShell blocks local scripts, run the equivalent manual commands below rather than
changing your machine's execution policy.

<details>
<summary>Manual installation</summary>

```powershell
uv venv --python 3.11 .venv
uv pip sync --python .venv/Scripts/python.exe --reinstall-package onnxruntime requirements.lock
uv pip install --python .venv/Scripts/python.exe --reinstall-package onnxruntime-gpu -r requirements-gpu.lock
.venv/Scripts/python scripts/setup_models.py
ollama pull qwen3:4b-instruct-2507-q4_K_M
cd frontend
npm ci
npm run build
cd ..
.venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --ws-max-size 1300000
```

</details>

## How it works

```mermaid
flowchart LR
  Mic[Browser microphone] --> VAD[Silero VAD / local WASM]
  VAD --> STT[Faster-Whisper / CUDA INT8-FP16]
  STT --> LLM[Ollama / Qwen + history]
  LLM --> TTS[Kokoro / one multilingual speaker]
  TTS --> Audio[Browser playback]
  VAD --> Cancel[Interrupt / cancel old turn]
  Audio --> Memory[Playback acknowledgement]
  Memory --> LLM
  classDef inference fill:#23182f,stroke:#aa8acb,color:#f4f0fc
  classDef browser fill:#102522,stroke:#6fa59b,color:#e4fbf7
  classDef control fill:#282132,stroke:#8b7a9f,color:#e5d9ef
  class STT,LLM,TTS inference
  class Mic,VAD,Audio browser
  class Cancel,Memory control
```

The browser sends 16 kHz mono PCM after 600 ms of silence. FastAPI transcribes it,
streams LLM text, and synthesizes completed sentences concurrently. At most two speech
chunks can run ahead of playback. Turn IDs prevent stale results from playing after an
interruption. History includes completed spoken chunks rather than unheard generated text.

Native STT/TTS calls run in separate single-worker executors. Python cancellation cannot
preempt a native call, so it may finish in the background, but its result is discarded.
Six recent turn pairs are retained with an additional conservative character budget;
the model context is capped at 4,096 tokens. No conversation is stored on disk.

See [architecture and protocol](docs/architecture.md), [measurements](docs/performance.md),
and [review findings and verification](docs/review.md).

## Models and measurements

The latest same-speaker, 30-turn Chrome benchmark (2026-10-19) measured
**3.50s median / 5.41s p95** from estimated speech end to browser playback on this
laptop. It used synthetic microphone speech and real local inference. This run
**missed the internal ≤3s median / ≤5s p95 target**; Hindi was slower than English.
[Raw current results](docs/benchmark-current.json) retain the failed target status.
The demo's last turn separately measured **1,833 ms** at original speed.
See [method, per-language results and historical baselines](docs/performance.md).

| Stage | Model / configuration | Reason |
|---|---|---|
| STT | Multilingual `medium`, CUDA INT8-FP16, beam 3 for clips ≤2s and beam 1 otherwise; `small` CPU INT8 fallback | English/Hindi-only language selection and explicit manual input modes |
| LLM | `qwen3:4b-instruct-2507-q4_K_M`, 192-token reply cap | Separate structured language selection followed by a streamed reply |
| TTS | Kokoro / Omega, 24,000 Hz, CUDA FP32 or CPU INT8 | One fixed speaker for English, Hindi and Hinglish; pronunciation changes by script |
| VAD | Silero v5 via `vad-web` 0.0.31 / local ONNX WASM | Automatic endpointing and spoken interruptions |

Initial English-only (`base.en`) ten-turn synthetic-speech benchmark on this laptop:
**4.24 s median / 6.79 s p95 to first audio received**, excluding VAD and playback. Model initialization and warmup
took **8.15 s**. These are observations from one run, not guarantees. The browser's
timing panel measures first playback separately. The small LLM can give incorrect answers;
the benchmark includes an example, documented in the results.

Those initial measurements predate Hindi support. The multilingual model is larger
(about 1.53 GB of weights) and takes longer on CPU. Recognition of accents, short
utterances, and code-switching is imperfect; language matching is model-guided, not a guarantee.
English, Hindi and mixed replies now use the same Kokoro Omega speaker. Language-specific
pronunciation is combined before synthesis, so mixed sentences retain one speaker.
Piper remains only for synthetic test inputs; its Hindi dataset has noncommercial terms
(see [model notices](docs/models.md)). Human listening remains necessary to judge accent quality.

## Development and tests

Backend:

```powershell
.venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
.venv/Scripts/python -m pytest -q
.venv/Scripts/python -m ruff check .
```

Frontend, in another terminal:

```powershell
cd frontend
npm run dev
npm run test -- --run
npm run lint
npm run build
```

Vite serves http://127.0.0.1:5173 and proxies the backend. Production uses port 8000 only.
After rebuilding the frontend, reload the browser. Restart the backend if it was launched
before the first frontend build.

Integration tests use **real local inference and synthetic microphone fixtures**:

```powershell
.venv/Scripts/python scripts/make_fixtures.py
cd frontend
npm run test:e2e
```

Keep the backend running for E2E tests; Google Chrome must be installed. Tests cover the
complete speech pipeline, spoken interruptions, responsive layouts, and automated
accessibility checks. Real accent/noise/headphone testing is still a manual check.

For a synthetic English → Hindi → Hinglish → English language-switching check,
including an explicit English override spoken in Hindi:

```powershell
.venv/Scripts/python scripts/check_languages.py
```

This uses real local STT/LLM/TTS and writes transcripts, replies, timings, and script
checks to `artifacts/language-check.json`, plus generated audio. It does not test a human accent.

## Benchmark and demo

Browser first-playback benchmark for the GPU profile (30 synthetic turns, ten per
language style, three additional warmups excluded):

```powershell
.venv/Scripts/python scripts/make_latency_fixtures.py
cd frontend
node scripts/benchmark-playback.mjs
```

Results are written to `artifacts/latency/playback-results.json`. This includes VAD,
actual browser decode and playback start; it does not measure acoustic output from
the headset. The app estimates speech end from the last positive VAD frame. Fixtures
are synthetic and do not establish human accent/noise accuracy. The script exits
with failure if median first playback exceeds 3 seconds or p95 exceeds 5 seconds.
Keep other inference tests idle while measuring. CPU fallback has a separate profile.

```powershell
.venv/Scripts/python scripts/benchmark.py
```

Raw results go to `artifacts/benchmark.json`. Prompts are synthesized by Piper; this is
reproducible integration evidence, not a representative human-speech accuracy evaluation.

The current demo shows the desert workspace and real English/Hindi conversations.
The **2:01 version plays at 1.25×**; the **2:31 original** is also available in the
[same GitHub Release](https://github.com/ss-sevesh/localvoice/releases/tag/demo-v1).
Both include audible user input, real replies and narration. The local source export
is `artifacts/local-voice-demo.mp4`; [recording and export instructions](docs/demo.md)
explain the synthetic input, audio checks and speed adjustment.

## Troubleshooting and limits

- **Setup needed:** read the error on screen, run model setup, ensure Ollama is running,
  then restart the backend. Check http://127.0.0.1:8000/api/health.
- **No microphone:** allow access in the browser, check Windows privacy settings, and
  close other apps holding the device. Use localhost rather than a LAN IP.
- **False interruptions:** wear headphones; speaker echo suppression is not guaranteed.
- **Slow answers:** close memory/CPU-heavy applications. The timing panel shows whether
  STT, generation, or synthesis is responsible. Models must be warm for warm comparisons.
- **Long speech:** recordings are capped at 30 seconds; restart with a shorter utterance.
- **Model change:** set `OLLAMA_MODEL` before startup. Changing models requires rechecking
  supported thinking settings, latency, memory and response quality.
- Intended for one active local conversation at a time; Hindi/English/Hinglish and session memory. No tool use, RAG, speaker identification,
  or true streaming STT. Interruptions discard the currently playing partial sentence from
  memory; complete acknowledged chunks remain.

## Source and model licenses

Project source is GPL-3.0-or-later; see [LICENSE](LICENSE). Third-party packages and model
weights retain their own licenses. See [model and dependency notices](docs/models.md),
including the Lessac voice dataset license linked from its model card. Model weights are
downloaded separately and are not included in Git.

Built for the Trikon Software Labs AI internship assignment. Setup does not publish
accounts, model weights, recordings or credentials. Background artwork has separate
rights; see [its attribution](frontend/public/background/ATTRIBUTION.txt).
