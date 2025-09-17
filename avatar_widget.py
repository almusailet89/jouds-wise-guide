# modules/avatar_widget.py
from pathlib import Path
import streamlit as st
import streamlit.components.v1 as components

def avatar_card(height: int = 400):
    """Embeds web/avatar_livekit.html inside Streamlit."""
    root = Path(__file__).resolve().parents[1]
    html_path = root / "web" / "avatar_livekit.html"
    if not html_path.exists():
        st.error("Missing file: web/avatar_livekit.html")
        st.info("Create it (we provided full code) and place your avatar videos in assets/")
        return
    components.html(html_path.read_text(encoding="utf-8"), height=height, scrolling=False)