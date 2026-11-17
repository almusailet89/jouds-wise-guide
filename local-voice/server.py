"""
JOOD Voice Lab — a fully local, free voice assistant pipeline.

    mic (16 kHz PCM) ─▶ Whisper large-v3-turbo (MLX) ─▶ ALLaM 7B (Ollama)
                                                          │ streamed tokens
                         browser ◀─ WAV per sentence ◀── NAMAA Saudi TTS (Chatterbox)

Everything runs on this machine. The same code runs on a CUDA GPU server later:
set JOOD_DEVICE=cuda and point OLLAMA_URL at the GPU box (or swap Ollama for vLLM).

Run:  .venv/bin/python server.py      then open http://localhost:8765
"""
from __future__ import annotations

import asyncio
import base64
import io
import logging
import os
import re
import threading
import time
from pathlib import Path

import httpx
import numpy as np
import soundfile as sf
import torch
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from arabic_numbers import spell_numbers

ROOT = Path(__file__).parent
LLM_MODEL = os.getenv("JOOD_LLM_MODEL", "hf.co/bartowski/ALLaM-AI_ALLaM-7B-Instruct-preview-GGUF:Q4_K_M")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
WHISPER_MODEL = os.getenv("JOOD_WHISPER_MODEL", "mlx-community/whisper-large-v3-turbo")
TTS_REPO = os.getenv("JOOD_TTS_REPO", "NAMAA-Space/NAMAA-Saudi-TTS")
VOICE_REF = Path(os.getenv("JOOD_VOICE_REF", ROOT / "voices" / "jood_reference.wav"))
PORT = int(os.getenv("JOOD_PORT", "8765"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("jood")


def pick_device() -> str:
    forced = os.getenv("JOOD_DEVICE")
    if forced:
        return forced
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


DEVICE = pick_device()

PERSONA = """أنتِ "جود"، مساعدة شخصية سعودية أنيقة وهادئة وواثقة، تتكلمين بصوت امرأة سعودية.
- تكلمي باللهجة السعودية النجدية البيضاء الراقية: دافئة وطبيعية، مو فصحى ثقيلة.
- إذا كلمك المستخدم بالإنجليزي ردي بإنجليزي دافئ ومختصر.
- هذه مكالمة صوتية: ردك جملة أو جملتين قصيرة فقط، بدون قوائم أو رموز أو إيموجي.
- اكتبي الأرقام بالكلمات العربية (مثلاً: ألفين وخمسمية ريال) لأن ردك يتحول لصوت.
- ابدئي بالمضمون مباشرة، وعبارات طبيعية مثل: سم، أبشر، تم، الله يعطيك العافية.
- أنتِ جود فقط، لا تدّعين أنك شخص حقيقي معروف."""

# ─── Models ──────────────────────────────────────────────────────────────────
class Models:
    def __init__(self) -> None:
        self.ready = False
        self.error: str | None = None
        self.tts = None
        self.tts_lock = threading.Lock()   # torch on MPS: one generation at a time
        self.whisper = None

    def load(self) -> None:
        try:
            t0 = time.time()
            import mlx_whisper  # noqa: F401  (Apple Silicon only; swap for faster-whisper on CUDA)
            self.whisper = mlx_whisper
            log.info("Warming Whisper (%s)…", WHISPER_MODEL)
            self.transcribe(np.zeros(16000, dtype=np.float32))

            log.info("Loading Chatterbox multilingual + NAMAA Saudi weights on %s…", DEVICE)
            from chatterbox import mtl_tts
            from huggingface_hub import snapshot_download
            from safetensors.torch import load_file

            tts = mtl_tts.ChatterboxMultilingualTTS.from_pretrained(device=DEVICE)
            ckpt = snapshot_download(repo_id=TTS_REPO, allow_patterns=["t3_mtl23ls_v2.safetensors"])
            tts.t3.load_state_dict(load_file(f"{ckpt}/t3_mtl23ls_v2.safetensors", device="cpu"))
            tts.t3.to(DEVICE).eval()
            if VOICE_REF.exists():
                tts.prepare_conditionals(str(VOICE_REF), exaggeration=0.45)
                log.info("Voice reference: %s", VOICE_REF.name)
            else:
                log.warning("No voice reference at %s — using the model's built-in voice", VOICE_REF)
            self.tts = tts
            log.info("Warming TTS…")
            self.speak("أهلاً", "ar")
            self.ready = True
            log.info("All models ready in %.1fs", time.time() - t0)
        except Exception as exc:  # surface the reason on /api/health
            log.exception("Model loading failed")
            self.error = str(exc)

    def transcribe(self, audio16k: np.ndarray) -> tuple[str, str]:
        out = self.whisper.transcribe(
            audio16k, path_or_hf_repo=WHISPER_MODEL, task="transcribe",
            condition_on_previous_text=False, temperature=0.0,
        )
        return out.get("text", "").strip(), out.get("language", "ar")

    def speak(self, text: str, lang: str) -> tuple[np.ndarray, int]:
        with self.tts_lock, torch.inference_mode():
            wav = self.tts.generate(
                text, language_id="en" if lang == "en" else "ar",
                exaggeration=0.45, cfg_weight=0.5, temperature=0.7,
            )
        return wav.squeeze(0).float().cpu().numpy(), self.tts.sr


models = Models()

# ─── Helpers ─────────────────────────────────────────────────────────────────
SENTENCE_END = re.compile(r"([.!?؟\n]+)")
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿]")


def wav_b64(samples: np.ndarray, sr: int) -> str:
    buf = io.BytesIO()
    sf.write(buf, np.clip(samples, -1, 1), sr, format="WAV", subtype="PCM_16")
    return base64.b64encode(buf.getvalue()).decode()


def clean_for_speech(text: str, lang: str = "ar") -> str:
    text = EMOJI.sub("", text)
    if lang != "en":
        text = spell_numbers(text)
    text = re.sub(r"[*_#`>\[\]]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def split_ready(buffer: str) -> tuple[list[str], str]:
    """Pull complete sentences off the front of the buffer; long clauses split on '،' or ','."""
    parts = SENTENCE_END.split(buffer)
    out: list[str] = []
    i = 0
    while i + 1 < len(parts):
        sentence = (parts[i] + parts[i + 1]).strip()
        if sentence:
            out.append(sentence)
        i += 2
    rest = parts[i] if i < len(parts) else ""
    if len(rest) > 90:
        cut = max(rest.rfind("،"), rest.rfind(","))
        if cut > 30:
            out.append(rest[: cut + 1].strip())
            rest = rest[cut + 1 :]
    return out, rest


async def stream_llm(history: list[dict]):
    payload = {
        "model": LLM_MODEL,
        "messages": [{"role": "system", "content": PERSONA}, *history],
        "stream": True,
        "options": {"temperature": 0.6, "top_p": 0.9, "num_ctx": 4096, "num_predict": 160},
        "keep_alive": "30m",
    }
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("POST", f"{OLLAMA_URL}/api/chat", json=payload) as r:
            r.raise_for_status()
            import json
            async for line in r.aiter_lines():
                if not line:
                    continue
                chunk = json.loads(line)
                delta = chunk.get("message", {}).get("content", "")
                if delta:
                    yield delta
                if chunk.get("done"):
                    break


# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(title="JOOD Voice Lab")
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


@app.on_event("startup")
async def startup() -> None:
    threading.Thread(target=models.load, daemon=True).start()


@app.get("/")
async def index():
    return FileResponse(ROOT / "static" / "index.html")


@app.get("/api/health")
async def health():
    return JSONResponse({
        "ready": models.ready, "error": models.error, "device": DEVICE,
        "llm": LLM_MODEL, "llm_short": "ALLaM-7B" if "ALLaM" in LLM_MODEL else LLM_MODEL.split("/")[-1],
        "whisper": WHISPER_MODEL, "tts": TTS_REPO, "voice_ref": VOICE_REF.name if VOICE_REF.exists() else None,
    })


@app.get("/api/say")
async def say(text: str = Query(..., max_length=400), lang: str = "ar"):
    """Quick TTS check: returns a WAV of Jood saying `text`."""
    if not models.ready:
        return JSONResponse({"error": "models loading"}, status_code=503)
    t0 = time.time()
    samples, sr = await asyncio.to_thread(models.speak, clean_for_speech(text, lang), lang)
    buf = io.BytesIO()
    sf.write(buf, samples, sr, format="WAV", subtype="PCM_16")
    return Response(buf.getvalue(), media_type="audio/wav",
                    headers={"X-Gen-Ms": str(int((time.time() - t0) * 1000)),
                             "X-Audio-Ms": str(int(len(samples) / sr * 1000))})


@app.get("/api/chat")
async def chat_text(text: str = Query(..., max_length=500)):
    """Quick LLM check without audio."""
    t0 = time.time()
    reply = "".join([d async for d in stream_llm([{"role": "user", "content": text}])])
    return {"reply": reply.strip(), "ms": int((time.time() - t0) * 1000)}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    history: list[dict] = []
    current: asyncio.Task | None = None

    async def run_turn(user_text: str, lang: str, t_start: float, stt_ms: int | None) -> None:
        timings: dict[str, int] = {}
        if stt_ms is not None:
            timings["stt"] = stt_ms
        history.append({"role": "user", "content": user_text})
        reply, buffer = "", ""
        tts_queue: asyncio.Queue[str | None] = asyncio.Queue()

        async def tts_worker() -> None:
            index = 0
            while (sentence := await tts_queue.get()) is not None:
                text = clean_for_speech(sentence, lang)
                if not text:
                    continue
                samples, sr = await asyncio.to_thread(models.speak, text, lang)
                if "first_audio" not in timings:
                    timings["first_audio"] = int((time.time() - t_start) * 1000)
                await ws.send_json({"type": "audio", "index": index, "wav_b64": wav_b64(samples, sr)})
                index += 1

        worker = asyncio.create_task(tts_worker())
        try:
            async for delta in stream_llm(history[-12:]):
                if "first_token" not in timings:
                    timings["first_token"] = int((time.time() - t_start) * 1000)
                reply += delta
                buffer += delta
                await ws.send_json({"type": "reply_delta", "text": delta})
                ready, buffer = split_ready(buffer)
                for s in ready:
                    await tts_queue.put(s)
            if buffer.strip():
                await tts_queue.put(buffer)
            await tts_queue.put(None)
            await worker
            history.append({"role": "assistant", "content": reply.strip()})
            timings["total"] = int((time.time() - t_start) * 1000)
            await ws.send_json({"type": "done", "timings": timings})
        except asyncio.CancelledError:
            worker.cancel()
            if reply.strip():
                history.append({"role": "assistant", "content": reply.strip() + " …"})
            raise

    try:
        while True:
            msg = await ws.receive_json()
            kind = msg.get("type")
            if kind in ("stop", "reset", "audio", "text") and current and not current.done():
                current.cancel()
            if kind == "reset":
                history.clear()
                continue
            if kind == "stop":
                continue
            if not models.ready:
                await ws.send_json({"type": "error", "message": "النماذج لسا تتحمل، لحظات…"})
                continue

            t_start = time.time()
            if kind == "audio":
                pcm = np.frombuffer(base64.b64decode(msg["pcm16_b64"]), dtype=np.int16).astype(np.float32) / 32768.0
                text, lang = await asyncio.to_thread(models.transcribe, pcm)
                stt_ms = int((time.time() - t_start) * 1000)
                if not text:
                    await ws.send_json({"type": "done", "timings": {"stt": stt_ms}})
                    continue
                await ws.send_json({"type": "transcript", "text": text, "lang": lang})
                current = asyncio.create_task(run_turn(text, lang, t_start, stt_ms))
            elif kind == "text":
                text = str(msg.get("text", "")).strip()[:500]
                if text:
                    lang = "en" if re.fullmatch(r"[\x00-\x7F]+", text) else "ar"
                    current = asyncio.create_task(run_turn(text, lang, t_start, None))
    except WebSocketDisconnect:
        if current and not current.done():
            current.cancel()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="info")
