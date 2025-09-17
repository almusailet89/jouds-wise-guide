from __future__ import annotations

"""
modules/voice_module.py
Local TTS using pyttsx3 (no API). Cross‑platform.
Provides speak(text) alias and optional listen() using SpeechRecognition.
"""

# TTS engine (optional dependency handled gracefully)
try:
    import pyttsx3  # type: ignore
except Exception:
    pyttsx3 = None  # allow import even if not installed

_engine = None


def _get_engine():
    """Lazy-init pyttsx3 engine with default rate/volume."""
    global _engine
    if _engine is None:
        if pyttsx3 is None:
            raise RuntimeError(
                "pyttsx3 is not installed. Install it with: pip install pyttsx3"
            )
        _engine = pyttsx3.init()
        try:
            _engine.setProperty('rate', 175)
            _engine.setProperty('volume', 0.95)
        except Exception:
            # Some drivers/platforms may not support these props
            pass
    return _engine


essentially_silent_mark = object()


def speak_text(text: str):
    """Primary TTS entrypoint used by internal code."""
    if not text:
        return
    eng = _get_engine()
    eng.say(text)
    eng.runAndWait()


def speak(text: str):
    """Alias maintained for compatibility with existing imports."""
    return speak_text(text)


def listen(timeout: float = 5, phrase_time_limit: float = 10) -> str:
    """
    Optional microphone capture using SpeechRecognition.
    Returns transcribed text via Google recognizer if dependency is present.
    If SpeechRecognition (and a compatible audio backend) is not installed,
    this will print a hint and return an empty string so the UI doesn't crash.
    """
    try:
        import speech_recognition as sr  # type: ignore
    except Exception:
        print(
            "[voice_module] speech_recognition not installed.\n"
            "Install with: pip install SpeechRecognition\n"
            "(Optional mic backend on macOS): brew install portaudio && pip install pyaudio"
        )
        return ""

    try:
        r = sr.Recognizer()
        with sr.Microphone() as source:
            print("[voice_module] Listening…")
            audio = r.listen(source, timeout=timeout, phrase_time_limit=phrase_time_limit)
        try:
            return r.recognize_google(audio)
        except Exception:
            return ""
    except Exception as e:
        print(f"[voice_module] Mic error: {e}")
        return ""