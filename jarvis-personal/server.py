#!/usr/bin/env python3
"""
Jarvis (Arabic) — local voice bridge.

    python3 server.py                 # serve the dashboard at http://localhost:8765
    python3 server.py speak "نص"      # render text to jarvis_brief.mp3
    python3 server.py speak --file brief.txt

What it does:
  GET  /            -> dashboard.html (and any static file next to it)
  POST /ask   {text}  -> runs the request through `claude -p` (your skills +
                        connectors) and returns {"reply": "..."}
  POST /tts   {text}  -> Arabic speech (audio/mpeg) via ElevenLabs or Fish Audio

Standard library only. Binds to 127.0.0.1 and rejects cross-origin requests, so
a random web page cannot drive your Claude Code through it.

Config (env vars or a .env file next to this script):
  TTS_PROVIDER         elevenlabs | fish            (default: whichever key is set)
  ELEVENLABS_API_KEY   ELEVENLABS_VOICE_ID          (default voice: Jood's clone)
  ELEVENLABS_MODEL     default eleven_multilingual_v2 (best Arabic)
  FISH_API_KEY         FISH_REFERENCE_ID            FISH_MODEL (default s1)
  JARVIS_PORT          default 8765
  CLAUDE_BIN           default "claude"
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent


def load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.exists():
        return
    for raw in env.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_dotenv()

PORT = int(os.environ.get("JARVIS_PORT", "8765"))
CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "claude")
ALLOWED_ORIGINS = {f"http://localhost:{PORT}", f"http://127.0.0.1:{PORT}"}

# Spoken replies must be short and clean; the persona itself lives in CLAUDE.md.
VOICE_RULES = (
    "You are answering out loud through a voice interface. "
    "Reply in natural Saudi Arabic unless I spoke English. "
    "Max 3 short sentences, no markdown, no lists, no emojis. "
    "Draft, never send: do not send email, post, delete, or spend money. "
    "If a connector fails or a source is empty, say so plainly; never guess."
)


# ─── Brain: Claude Code ───────────────────────────────────────────────────────
def ask_claude(text: str) -> str:
    cmd = [CLAUDE_BIN, "-p", text, "--append-system-prompt", VOICE_RULES]
    try:
        out = subprocess.run(
            cmd, cwd=ROOT, capture_output=True, text=True, timeout=240, check=False
        )
    except FileNotFoundError:
        return "ما لقيت Claude Code على جهازك. ثبّته بـ npm install -g @anthropic-ai/claude-code"
    except subprocess.TimeoutExpired:
        return "الطلب أخذ وقت أطول من اللازم، جرّب مرة ثانية أو اختصره."
    if out.returncode != 0:
        err = (out.stderr or out.stdout).strip().splitlines()[-1:] or ["unknown error"]
        return f"صار خطأ في Claude Code: {err[0]}"
    return out.stdout.strip()


# ─── Voice: Arabic TTS ────────────────────────────────────────────────────────
def clean_for_speech(text: str) -> str:
    text = re.sub(r"[*_`#>]+", "", text)
    text = re.sub(r"\[(.+?)\]\(.+?\)", r"\1", text)
    text = re.sub(r"^\s*[-•\d]+[.)]?\s+", "", text, flags=re.M)
    text = re.sub(r"(\d)\s*%", r"\1 بالمئة", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:2500]


def tts_provider() -> str | None:
    forced = os.environ.get("TTS_PROVIDER", "").lower()
    if forced in ("elevenlabs", "fish"):
        return forced
    if os.environ.get("ELEVENLABS_API_KEY"):
        return "elevenlabs"
    if os.environ.get("FISH_API_KEY"):
        return "fish"
    return None


def synthesize(text: str) -> bytes:
    text = clean_for_speech(text)
    provider = tts_provider()
    if provider == "elevenlabs":
        voice = os.environ.get("ELEVENLABS_VOICE_ID", "rxI4CzWiL77Roff1cjW6")
        req = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice}",
            data=json.dumps({
                "text": text,
                "model_id": os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2"),
                # Lower stability = more natural Arabic melody (same tuning as the app)
                "voice_settings": {"stability": 0.55, "similarity_boost": 0.85,
                                   "style": 0.35, "use_speaker_boost": True},
            }).encode(),
            headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"],
                     "Content-Type": "application/json", "Accept": "audio/mpeg"},
        )
    elif provider == "fish":
        body = {"text": text, "format": "mp3"}
        if os.environ.get("FISH_REFERENCE_ID"):
            body["reference_id"] = os.environ["FISH_REFERENCE_ID"]
        req = urllib.request.Request(
            "https://api.fish.audio/v1/tts",
            data=json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {os.environ['FISH_API_KEY']}",
                     "Content-Type": "application/json",
                     "model": os.environ.get("FISH_MODEL", "s1")},
        )
    else:
        raise RuntimeError("no TTS key: set ELEVENLABS_API_KEY or FISH_API_KEY in .env")

    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:300]
        raise RuntimeError(f"{provider} TTS {e.code}: {detail}") from e


# ─── HTTP ─────────────────────────────────────────────────────────────────────
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def do_GET(self):
        if self.path in ("/", ""):
            self.path = "/dashboard.html"
        # never serve dotfiles (.env, .claude/…), however the path is encoded
        if any(part.startswith(".") for part in unquote(self.path.split("?")[0]).split("/")):
            self.send_error(404)
            return
        super().do_GET()

    def _reject_cross_origin(self) -> bool:
        origin = self.headers.get("Origin")
        if origin and origin not in ALLOWED_ORIGINS:
            self.send_error(403, "cross-origin request blocked")
            return True
        if "application/json" not in (self.headers.get("Content-Type") or ""):
            self.send_error(415, "send application/json")
            return True
        return False

    def _json_body(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def _send_json(self, code: int, payload: dict) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if self._reject_cross_origin():
            return
        try:
            body = self._json_body()
        except json.JSONDecodeError:
            self._send_json(400, {"error": "bad json"})
            return
        text = str(body.get("text", "")).strip()
        if not text:
            self._send_json(400, {"error": "text is required"})
            return

        if self.path == "/ask":
            self._send_json(200, {"reply": ask_claude(text)})
        elif self.path == "/tts":
            try:
                audio = synthesize(text)
            except Exception as e:  # browser falls back to its own Arabic voice
                self._send_json(503, {"error": str(e)})
                return
            self.send_response(200)
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Content-Length", str(len(audio)))
            self.end_headers()
            self.wfile.write(audio)
        else:
            self._send_json(404, {"error": "unknown endpoint"})

    def log_message(self, fmt, *args):
        sys.stderr.write("[jarvis] " + fmt % args + "\n")


def main() -> None:
    if len(sys.argv) >= 2 and sys.argv[1] == "speak":
        if len(sys.argv) >= 4 and sys.argv[2] == "--file":
            text = Path(sys.argv[3]).read_text(encoding="utf-8")
        else:
            text = " ".join(sys.argv[2:])
        out = ROOT / "jarvis_brief.mp3"
        out.write_bytes(synthesize(text))
        print(f"saved {out}")
        return

    print(f"Jarvis on http://localhost:{PORT}  (TTS: {tts_provider() or 'browser fallback'})")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
