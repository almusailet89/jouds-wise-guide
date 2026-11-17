# JOOD Voice Lab (local, free)

A fully local voice for Jood: no API keys, no per-minute cost. Runs on this Mac today; the same code
moves to a GPU server before launch.

```
mic ─▶ Whisper large-v3-turbo ─▶ ALLaM 7B (HUMAIN) ─▶ NAMAA Saudi TTS ─▶ speaker
        (speech → text)           (Jood's brain)       (Saudi female voice)
```

| Part | Model | License | Size |
|---|---|---|---|
| Brain | `humain-ai/ALLaM-7B-Instruct-preview` (GGUF Q4_K_M via Ollama) | Apache-2.0 | 4.3 GB |
| Hearing | `mlx-community/whisper-large-v3-turbo` | MIT | 1.6 GB |
| Voice | `NAMAA-Space/NAMAA-Saudi-TTS` (Chatterbox multilingual fine-tune) | MIT | ~3 GB |

All three allow commercial use. **Do not** swap in `NAMAA-Saudi-TTS-V2`, Habibi-TTS or the other
F5-based Saudi voices for the product: they are CC-BY-NC (non-commercial).

## Run

```bash
cd local-voice
.venv/bin/python server.py      # first start downloads ~5 GB of models
```

Open http://localhost:8765 in Chrome or Safari, press **ابدأ المحادثة** and talk, or type.
The timings line shows speech-to-text, first word, first audio and total time for each turn.

Quick checks:

```bash
curl -s localhost:8765/api/health
curl -s "localhost:8765/api/chat?text=صباح الخير"
curl -s "localhost:8765/api/say?text=هلا والله، وش أقدر أساعدك فيه؟" -o say.wav && afplay say.wav
```

## The voice

The voice is cloned on the fly from `voices/jood_reference.wav` (kept out of git). To change it,
replace that file with 10–20 seconds of clean speech, mono, no music, then restart.

Before launch, the reference must be a voice JOOD has the rights to: a contracted voice actress
recording made for JOOD. Never a real person's voice without their written consent.

## Settings (environment variables)

| Variable | Default |
|---|---|
| `JOOD_LLM_MODEL` | `hf.co/bartowski/ALLaM-AI_ALLaM-7B-Instruct-preview-GGUF:Q4_K_M` |
| `OLLAMA_URL` | `http://localhost:11434` |
| `JOOD_VOICE_REF` | `voices/jood_reference.wav` |
| `JOOD_DEVICE` | auto (`cuda` → `mps` → `cpu`) |
| `JOOD_PORT` | `8765` |

## Path to a GPU server (before going live)

1. **Hardware:** one NVIDIA L4/A10 (24 GB) handles the three models; an L40S/A100 handles many
   more concurrent calls.
2. **Hearing:** replace `mlx-whisper` (Apple only) with `faster-whisper` on CUDA.
3. **Brain:** serve ALLaM with vLLM (batched, OpenAI-compatible) instead of Ollama.
4. **Voice:** same code with `JOOD_DEVICE=cuda`; add batching and audio streaming per chunk.
5. **App:** add a third Majlis engine ("JOOD Own") next to Gemini and ElevenLabs that talks to this
   server's `/ws` with the user's JWT, reusing the voice-minute tracking already in Supabase.
6. **Quality:** fine-tune ALLaM on JOOD-style Saudi conversations and train the voice on the
   contracted actress's recordings.
