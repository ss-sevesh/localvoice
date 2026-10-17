# Model and dependency notices

Weights and third-party assets retain their original licenses. The project downloads
weights separately and does not include them in Git.

| Component | Source | License / notice |
|---|---|---|
| Faster-Whisper implementation | https://github.com/SYSTRAN/faster-whisper | MIT |
| Whisper base.en converted weights | https://huggingface.co/Systran/faster-whisper-base.en | See model card; original Whisper MIT |
| Ollama | https://github.com/ollama/ollama | MIT |
| Qwen 3.5 | https://ollama.com/library/qwen3.5 | Apache-2.0; keep model-specific notices |
| Piper engine | https://github.com/OHF-Voice/piper1-gpl | GPL-3.0; includes eSpeak NG components |
| Lessac English voice | https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/lessac/medium | Dataset-specific license linked in MODEL_CARD |
| Silero VAD | https://github.com/snakers4/silero-vad | MIT |
| vad-web | https://github.com/ricky0123/vad | ISC; ships Silero assets |
| ONNX Runtime | https://github.com/microsoft/onnxruntime | MIT |
| React | https://github.com/facebook/react | MIT |
| Vite | https://github.com/vitejs/vite | MIT |
| FastAPI | https://github.com/fastapi/fastapi | MIT |

The downloaded Lessac model card points to
https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html
for its dataset license. Do not assume that an engine license grants unrestricted rights
to every voice dataset. Read the supplied model card and linked terms before redistribution.

Setup pins the speech model revisions:

- Whisper: `3d3d5dee26484f91867d81cb899cfcf72b96be6c`.
- Piper voice repository: `c10ece1aade47bb51c153c893d14e5bf8e5b7117`.

The observed installed Ollama tag was `qwen3.5:2b-q4_K_M`, digest prefix `1e2d21a4f03a`,
size approximately 1.9 GB. Ollama tags can change upstream; record `ollama list` when
reproducing results. Other model substitutions require fresh measurements.

Exact tested Python dependencies are in requirements.lock, frontend dependencies in
frontend/package-lock.json. The VAD disposal workaround is specific to vad-web 0.0.31;
retest its internal initialization fields before upgrading that package.
