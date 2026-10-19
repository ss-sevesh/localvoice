# Demonstration guide

## Generated showcase

`artifacts/local-voice-demo.mp4` is a 2-minute automated recording when generated locally.
It uses synthetic microphone speech, real browser VAD, the real local inference pipeline,
and the actual generated audio buffers scheduled for browser playback. Audio is aligned
to browser timestamps during export; it is not recorded from the physical speakers.

The video is visibly labelled as an automated synthetic-microphone demonstration.
It shows a remembered name/hobby, a follow-up, a spoken interruption, and model/timing
details. No model response is hardcoded into the application or the capture script.

To reproduce, keep the backend running and install FFmpeg on PATH:

Create an account in the UI first. Set `LOCALVOICE_EMAIL` and `LOCALVOICE_PASSWORD`
in the recording terminal's environment; the capture script uses these to log in
before opening the voice workspace. Do not put credentials in source or recordings.

```powershell
.venv/Scripts/python scripts/make_fixtures.py
cd frontend
npx playwright install ffmpeg
node scripts/record-demo.mjs
cd ..
.venv/Scripts/python scripts/mix_demo.py
```

The capture takes a little over two minutes and uses installed Google Chrome.
Generated files are excluded from Git; upload the MP4 separately for submission.

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
