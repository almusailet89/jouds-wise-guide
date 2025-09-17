# modules/avatar_controller.py
from __future__ import annotations
import streamlit as st
from pathlib import Path
import threading, time, base64, os
from modules.planner_engine import add_from_text

ASSETS = Path(__file__).resolve().parents[1] / "assets"

# ---------- session state ----------
def _init_state() -> None:
    ss = st.session_state
    ss.setdefault("avatar_style", "Calm")             # Calm | Dark
    ss.setdefault("avatar_css_injected", False)
    # Derive speaking from a timestamp to avoid mutating state from threads
    ss.setdefault("avatar_speaking_until", 0.0)

# ---------- visuals ----------
def _inject_css_once() -> None:
    if st.session_state.get("avatar_css_injected"):
        return
    st.markdown(
        """
        <style>
          .avatar-card {
            border-radius: 16px;
            padding: 0;
            overflow: hidden;
            position: relative;
            background: #0e0f11;
            border: 1px solid rgba(255,255,255,0.06);
            transition: box-shadow 400ms ease;
          }
          .avatar-card.speaking {
            box-shadow: 0 0 0 0 rgba(97, 149, 255, 0.5),
                        0 0 24px 6px rgba(97, 149, 255, 0.35),
                        0 0 64px 18px rgba(97, 149, 255, 0.20);
          }
          .avatar-img {
            width: 100%;
            display: block;
            aspect-ratio: 16/9;
            object-fit: cover;
            filter: saturate(1.05) contrast(1.05);
          }
          .wave-wrap {
            position: absolute; left: 0; right: 0; bottom: 8px;
            display: flex; justify-content: center; gap: 6px;
            height: 22px; pointer-events: none;
            opacity: 0; transition: opacity 200ms ease;
          }
          .avatar-card.speaking .wave-wrap { opacity: 1; }
          .wave-bar {
            width: 4px; background: white; border-radius: 2px;
            animation: wave 900ms infinite ease-in-out;
          }
          .wave-bar:nth-child(1){animation-delay:0ms;height: 30%;}
          .wave-bar:nth-child(2){animation-delay:120ms;height: 45%;}
          .wave-bar:nth-child(3){animation-delay:240ms;height: 80%;}
          .wave-bar:nth-child(4){animation-delay:120ms;height: 45%;}
          .wave-bar:nth-child(5){animation-delay:0ms; height: 30%;}
          @keyframes wave { 0%,100%{ transform: scaleY(0.6);} 50%{ transform: scaleY(1.8);} }
        </style>
        """,
        unsafe_allow_html=True,
    )
    st.session_state["avatar_css_injected"] = True

# ---------- media helpers ----------
_MIME_MAP = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}

def _b64_data(path: Path) -> tuple[str, str]:
    """Return (data_uri, mime) for inline <img>."""
    ext = path.suffix.lower()
    mime = _MIME_MAP.get(ext, "image/jpeg")
    data = path.read_bytes()
    uri = f"data:{mime};base64," + base64.b64encode(data).decode("ascii")
    return uri, mime

_DEF_NAMES = {
    "Calm": ["joud_ameera_calm.jpg", "joud_ameera_calm.png"],
    "Dark": ["joud_ameera_dark.jpg", "joud_ameera_dark.png"],
}

def _pick_image(style: str) -> Path | None:
    for name in _DEF_NAMES.get(style, []):
        p = ASSETS / name
        if p.exists():
            return p
    for name in _DEF_NAMES["Calm"]:  # fallback
        p = ASSETS / name
        if p.exists():
            return p
    return None

# ---------- public render ----------
def render_avatar(width: int = 560) -> None:
    """Render the avatar card. Glow/wave toggled by speaking timestamp."""
    _init_state(); _inject_css_once()

    style = st.session_state.get("avatar_style", "Calm")
    img_path = _pick_image(style)
    if img_path is None:
        st.info("Avatar image not found. Put images in /assets: joud_ameera_calm.(jpg|png), joud_ameera_dark.(jpg|png)")
        return

    data_uri, _ = _b64_data(img_path)

    is_speaking = time.time() < float(st.session_state.get("avatar_speaking_until", 0))
    st.session_state["avatar_is_speaking"] = bool(is_speaking)  # read-only mirror if others check it

    speaking_class = "speaking" if is_speaking else ""
    html = f"""
      <div class="avatar-card {speaking_class}" style="max-width:{width}px;margin:0 auto;">
        <img class="avatar-img" src="{data_uri}" alt="Joud avatar" />
        <div class="wave-wrap">
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
        </div>
      </div>
    """
    st.markdown(html, unsafe_allow_html=True)

# ---------- speaking (local TTS with pyttsx3 or 'say') ----------

def _estimate_seconds(text: str, wpm: int = 165) -> float:
    words = max(1, len(text.split()))
    return max(1.2, (words / max(100, wpm)) * 60.0)


def _tts_pyttsx3(text: str, rate: int = 180) -> None:
    import pyttsx3
    e = pyttsx3.init()
    try:
        e.setProperty("rate", rate)
    except Exception:
        pass
    try:
        e.say(text)
        e.runAndWait()
    finally:
        try:
            e.stop()
        except Exception:
            pass


def _tts_say(text: str) -> None:
    safe = text.replace('"', r'\\"')
    os.system(f'say "{safe}"')  # macOS fallback


def _bg_speak(text: str, rate: int) -> None:
    try:
        _tts_pyttsx3(text, rate=rate)
    except Exception:
        _tts_say(text)


def speak(text: str, persona: str = "Calm") -> None:
    """Speaks locally and animates the avatar; no paid keys needed."""
    if not text or not isinstance(text, str):
        return
    _init_state()

    rate = 170 if persona == "Calm" else 185
    seconds = _estimate_seconds(text, wpm=165 if persona == "Calm" else 175)

    # Set speaking window (main thread only)
    now = time.time()
    until = now + seconds + 0.35
    st.session_state["avatar_speaking_until"] = max(
        float(st.session_state.get("avatar_speaking_until", 0)), until
    )

    # Fire TTS in background (non-blocking for UI)
    threading.Thread(target=_bg_speak, args=(text, rate), daemon=True).start()


# --- planner quick-add helper ---
def add_to_planner_from_transcript(transcript_text: str, *, confirm: bool = True) -> dict | None:
    """Quickly parse a spoken sentence and add it to the planner (task/event).
    Returns the created item dict or None if parsing failed.
    Example phrases:
      - "task buy milk 2025-08-15 remind 30min"
      - "event team sync 2025-08-20 14:00-15:00 at HQ remind 2h"
    """
    if not transcript_text or not isinstance(transcript_text, str):
        return None
    item = add_from_text(transcript_text)
    if confirm:
        persona = st.session_state.get("avatar_style", "Calm")
        if item:
            title = item.get("title", "your item")
            when = item.get("date", "soon")
            speak(f"Added {item.get('type','item')} — {title} on {when}.", persona=persona)
        else:
            speak("I couldn't parse that. Try saying: task buy milk tomorrow remind 30 minutes.", persona=persona)
    return item

# ---------- helpers you can call from sidebar ----------

def avatar_style_selector() -> None:
    _init_state()
    st.session_state["avatar_style"] = st.sidebar.selectbox(
        "🎭 Avatar style", ["Calm", "Dark"], index=0
    )