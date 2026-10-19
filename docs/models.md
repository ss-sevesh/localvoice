# Model and dependency notices

Weights and third-party assets retain their original licenses. The project downloads
weights separately and does not include them in Git.

| Component | Source | License / notice |
|---|---|---|
| Faster-Whisper implementation | https://github.com/SYSTRAN/faster-whisper | MIT |
| Whisper multilingual medium converted weights | https://huggingface.co/Systran/faster-whisper-medium | See model card; original Whisper MIT |
| Ollama | https://github.com/ollama/ollama | MIT |
| Qwen 3 4B Instruct 2507 | https://ollama.com/library/qwen3:4b-instruct-2507-q4_K_M | Apache-2.0; keep model-specific notices |
| Piper engine | https://github.com/OHF-Voice/piper1-gpl | GPL-3.0; includes eSpeak NG components |
| Lessac English voice | https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/lessac/medium | Dataset-specific license linked in MODEL_CARD |
| Pratham Hindi voice | https://huggingface.co/rhasspy/piper-voices/tree/main/hi/hi_IN/pratham/medium | MODEL_CARD lists dataset license CC BY-NC-SA 4.0 (noncommercial) |
| Silero VAD | https://github.com/snakers4/silero-vad | MIT |
| vad-web | https://github.com/ricky0123/vad | ISC; ships Silero assets |
| ONNX Runtime | https://github.com/microsoft/onnxruntime | MIT |
| Kokoro 82M v1.0 / Omega speaker | https://huggingface.co/hexgrad/Kokoro-82M | Apache-2.0 |
| kokoro-onnx 0.5.0 / FP32 and INT8 exports | https://github.com/thewh1teagle/kokoro-onnx | MIT wrapper; Apache-2.0 weights; bundled eSpeak NG GPL-3.0 |
| React | https://github.com/facebook/react | MIT |
| Vite | https://github.com/vitejs/vite | MIT |
| FastAPI | https://github.com/fastapi/fastapi | MIT |

The downloaded Lessac model card points to
https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html
for its dataset license. Do not assume that an engine license grants unrestricted rights
to every voice dataset. Read the supplied model card and linked terms before redistribution.

Setup pins the speech model revisions:

- Whisper medium: `08e178d48790749d25932bbc082711ddcfdfbc4f`.
- Whisper small (CPU fallback): `536b0662742c02347bc0e980a01041f333bce120`.
- Piper voice repository: `c10ece1aade47bb51c153c893d14e5bf8e5b7117`.
- Kokoro assets: upstream `model-files-v1.0` release, SHA-256 verified during setup.
  INT8: `6e742170d309016e5891a994e1ce1559c702a2ccd0075e67ef7157974f6406cb`;
  FP32: `7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5`;
  voices: `bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d`.

Assistant output uses only Kokoro `hm_omega`, across English, Hindi and Hinglish.
Piper voices remain for reproducible synthetic microphone fixtures, not reply speech.

The Hindi model card is saved separately as `models/hi_IN-pratham-MODEL_CARD`.
Its dataset license is https://creativecommons.org/licenses/by-nc-sa/4.0/;
check suitability before commercial distribution or use.

The current installed Ollama tag is `qwen3:4b-instruct-2507-q4_K_M`, digest prefix
`0edcdef34593`, approximately 2.5 GB. The original English-only benchmark used
`qwen3.5:2b-q4_K_M` (`1e2d21a4f03a`, 1.9 GB). Ollama tags can change upstream; record `ollama list` when
reproducing results. Other model substitutions require fresh measurements.

Exact tested Python dependencies are in requirements.lock, frontend dependencies in
frontend/package-lock.json. The VAD disposal workaround is specific to vad-web 0.0.31;
retest its internal initialization fields before upgrading that package.

Optional Windows GPU runtimes are separately pinned in requirements-gpu.lock:
cuBLAS 12.9.2.10, CUDA NVRTC 12.9.86 and cuDNN 9.27.0.42. They are NVIDIA packages
downloaded into the project environment and retain their vendor licenses. The source
repository does not contain these binaries. Loading paths are scoped to the process.

Kokoro CUDA uses ONNX Runtime GPU 1.26.0 (CUDA 12 build), CUDA Runtime 12.9.79 and
cuFFT 11.4.1.4 plus their pinned dependencies. CPU and GPU ONNX Runtime distributions
are pinned to the same version because upstream dependencies request the CPU package
even with CUDA extras. Setup reinstalls CPU files first, then GPU files last; the
`-CpuOnly` path also repairs the shared namespace when switching from a GPU install.
The selected provider is checked and warmed, not inferred from installed metadata.
See the [ONNX Runtime CUDA requirements](https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html#requirements):
1.26 uses CUDA 12; newer default GPU packages use CUDA 13, so upgrades need compatibility checks.
