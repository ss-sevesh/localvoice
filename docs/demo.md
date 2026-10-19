# Demonstration guide

## Generated showcase

The [English + Hindi demonstration](https://github.com/ss-sevesh/localvoice/releases/tag/demo-v1)
is available in the README's inline player at **1.25× speed (2:01)**, with pitch-preserved
audio. The **original-speed recording (2:31)** remains available in the same release.
Both the synthetic user's questions and the
actual assistant replies are audible, along with a short English narration.

The local exports are `artifacts/local-voice-demo.mp4` and
`artifacts/local-voice-demo-1.25x.mp4`. The faster version labels the playback speed;
all displayed response latencies are measurements at original speed.

Published recording: **2:31**, 1440×1000 H.264 video with AAC audio at 48 kHz.
The six-turn take produced 138 streamed text updates and 13 browser playback
buffers, with one buffer stopped by spoken interruption. The last turn measured
**1,833 ms to first voice**; this is one observed turn, not a new benchmark.
Verification decoded the final MP4's English and Hindi questions **and** assistant
replies back into recognizable speech. Three mixer tests cover bounds, interrupted
audio truncation, and frame-based synchronization; all 54 backend tests pass.
It uses synthetic microphone speech, real browser VAD, the real local inference pipeline,
and the actual generated audio buffers scheduled for browser playback. Audio is aligned
to browser timestamps during export; it is not recorded from the physical speakers.

The video is visibly labelled as an automated synthetic-microphone demonstration.
It shows a simple English introduction, name recall, two Hindi turns, and a spoken
interruption, followed by the live timing panel, architecture, models and hardware.
No assistant response is hardcoded into the application or the capture script.

| Original | 1.25× | What the reviewer sees and hears |
|---|---|---|
| 00:00 | 00:00 | Landing page, introduction and synthetic-input disclosure |
| 00:18 | 00:14 | “Hello. My name is Sam. Please remember it.” — VAD sends the turn after a pause |
| 00:32 | 00:26 | “What is my name?” — English follow-up and session memory |
| 00:46 | 00:37 | “नमस्ते। आप कैसे हैं?” — Hindi input and a Hindi spoken reply |
| 01:02 | 00:50 | “मेरा नाम क्या है? हिंदी में बताइए।” — Hindi recall, streamed text and sentence audio |
| 01:19 | 01:03 | A short cat story, interrupted by “No, wait. Just say hello.” |
| 01:38 | 01:18 | First-voice delay from the recorded turn and the app's timing panel |
| 01:51 | 01:29 | STT → LLM → TTS architecture and local VAD/WebSocket flow |
| 02:05 | 01:40 | Actual models/devices, laptop hardware and measured first-voice delay |
| 02:19 | 01:51 | Feature recap and repository link |

Hinglish is supported by the application and covered by its browser tests. This
particular demonstration focuses on simple English and Hindi conversation.

To reproduce, keep the backend running and install FFmpeg on PATH:

Create an account in the UI first. Set `LOCALVOICE_EMAIL` and `LOCALVOICE_PASSWORD`
in the recording terminal's environment; the capture script uses these to log in
before opening the voice workspace. Do not put credentials in source or recordings.

```powershell
.venv/Scripts/python scripts/make_demo.py
cd frontend
npx playwright install ffmpeg
node scripts/record-demo.mjs
cd ..
.venv/Scripts/python scripts/mix_demo.py
```

For the faster release, speed up video timestamps and use FFmpeg's `atempo=1.25`
audio filter, which preserves pitch. The 0.08-second trim removes a blank capture
frame before the introduction. Both tracks use the same trim and speed:

```powershell
ffmpeg -y -i artifacts/local-voice-demo.mp4 -filter_complex "[0:v]trim=start=0.08,setpts=(PTS-STARTPTS)/1.25,drawtext=fontfile='C\:/Windows/Fonts/segoeui.ttf':text='1.25x playback - timings recorded at 1x':fontsize=14:fontcolor=white:x=w-tw-20:y=12:box=1:boxcolor=0x100d1e@0.85:boxborderw=6[v];[0:a]atrim=start=0.08,asetpts=PTS-STARTPTS,atempo=1.25[a]" -map "[v]" -map "[a]" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -ar 48000 -movflags +faststart artifacts/local-voice-demo-1.25x.mp4
```

The capture takes about 2½ minutes and uses installed Google Chrome. The recorder
checks six real speech submissions/transcripts, text streaming, completed playback,
and a source stop during interruption. It refuses to export a failed take.

The mixer uses a small visual sync marker (removed from the export) to align audio
to the actual video frames. It includes both microphone and assistant
audio, truncates stopped buffers, adds non-overlapping narration, and normalizes
the export to -16 LUFS with a -1.5 dB true-peak target. `artifacts/demo/audio-check.json`
records voice activity for all three tracks. Models and hardware in the overview
match the development laptop; update the hardware text when recording elsewhere.

Generated files are excluded from Git. The final MP4 is published as a GitHub
Release asset so the source repository stays small. Architecture/hardware cards
and chapter captions are demonstration overlays, not extra application screens.

## Recommended human demonstration

For a stronger submission, also record the same flow with your real microphone and headphones:

1. **0:00–0:20:** Explain the local-only constraint and show the running application.
2. **0:20–0:50:** Say your name and a preference; ask a follow-up that requires memory.
3. **0:50–1:20:** Ask a question; interrupt the spoken answer with a correction.
4. **1:20–1:50:** Expand timings and explain the STT → LLM → TTS architecture.
5. **1:50–2:20:** Show the selected models, observed CPU latency, and one limitation.

Before recording, verify permission, correct microphone selection, no false interruptions,
intelligible transcription of your accent, and audible output. Discuss the small model's
factual reliability honestly. Include repository and video links in the submission.
