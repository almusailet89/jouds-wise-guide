# modules/avatar_widget.py
# Avatar card with speaking glow and animated waveform (pure CSS bars) for Streamlit.

import time
import streamlit as st

_AVATAR_CSS = """
<style>
.joud-avatar{position:relative;width:100%;max-width:420px;border-radius:18px;overflow:hidden;background:#0b121a}
.joud-avatar img{display:block;width:100%;height:auto}
.joud-overlay{position:absolute;left:16px;bottom:16px;background:rgba(0,0,0,.45);color:#e9edf6;padding:8px 12px;border-radius:12px;font-size:.95rem}

/* Speaking glow */
.joud-glow{animation:joudPulse 1.2s ease-in-out infinite}
@keyframes joudPulse{0%{box-shadow:0 0 0 rgba(255,196,64,0)}50%{box-shadow:0 0 28px 8px rgba(255,196,64,.45)}100%{box-shadow:0 0 0 rgba(255,196,64,0)}}

/* Waveform under chat bubble */
.joud-wavewrap{position:absolute;left:0;right:0;bottom:0;height:58px;background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.55) 46%);display:flex;align-items:flex-end;gap:4px;padding:8px 14px}
.joud-bar{width:3px;background:#c7a45a;border-radius:2px;animation:joudBars 1.1s ease-in-out infinite}
.joud-bar:nth-child(2){animation-delay:.05s}
.joud-bar:nth-child(3){animation-delay:.1s}
.joud-bar:nth-child(4){animation-delay:.15s}
.joud-bar:nth-child(5){animation-delay:.2s}
.joud-bar:nth-child(6){animation-delay:.25s}
.joud-bar:nth-child(7){animation-delay:.3s}
.joud-bar:nth-child(8){animation-delay:.35s}
.joud-bar:nth-child(9){animation-delay:.4s}
.joud-bar:nth-child(10){animation-delay:.45s}
.joud-bar:nth-child(11){animation-delay:.5s}
.joud-bar:nth-child(12){animation-delay:.55s}
.joud-bar:nth-child(13){animation-delay:.6s}
.joud-bar:nth-child(14){animation-delay:.65s}
.joud-bar:nth-child(15){animation-delay:.7s}
.joud-bar:nth-child(16){animation-delay:.75s}
.joud-bar:nth-child(17){animation-delay:.8s}
.joud-bar:nth-child(18){animation-delay:.85s}
@keyframes joudBars{0%{height:6px}40%{height:28px}60%{height:14px}100%{height:6px}}
</style>
"""


def avatar_card(image_path: str, subtitle: str = "", speaking: bool = False, bars: int = 18):
    """Render the avatar with optional speaking glow and animated waveform."""
    st.markdown(_AVATAR_CSS, unsafe_allow_html=True)
    classes = "joud-avatar"
    if speaking:
        classes += " joud-glow"

    st.markdown(f'<div class="{classes}">', unsafe_allow_html=True)
    st.image(image_path, use_column_width=True)

    if subtitle:
        st.markdown(f'<div class="joud-overlay">{subtitle}</div>', unsafe_allow_html=True)

    if speaking:
        bars_html = "".join('<div class="joud-bar"></div>' for _ in range(bars))
        st.markdown(f'<div class="joud-wavewrap">{bars_html}</div>', unsafe_allow_html=True)

    st.markdown('</div>', unsafe_allow_html=True)


def talk_for(duration_s: float, image_path: str, subtitle: str = "أتحدث الآن…", bars: int = 18):
    """Show speaking avatar for `duration_s` seconds then return to idle."""
    ph = st.empty()
    start = time.time()
    while time.time() - start < duration_s:
        with ph.container():
            avatar_card(image_path, subtitle=subtitle, speaking=True, bars=bars)
        time.sleep(0.25)
    with ph.container():
        avatar_card(image_path, subtitle=subtitle, speaking=False, bars=bars)

# test_openai.py — sanity check for OpenAI client v1.x
from openai import OpenAI
import os

API_KEY = os.getenv("OPENAI_API_KEY")
if not API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not set. Please export it in your shell.")
client = OpenAI(api_key=API_KEY)

print("DEBUG: Key starts with:", API_KEY[:12])
try:
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Say 'hi' in one short sentence"}],
    )
    print("OK:", resp.choices[0].message.content)
except Exception as e:
    print("Error:", e)