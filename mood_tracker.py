# modules/mood_tracker.py
import os, json
from datetime import datetime
import streamlit as st
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
MOOD_FILE = os.path.join(DATA_DIR, "mood_log.json")

def _ensure():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(MOOD_FILE):
        with open(MOOD_FILE, "w") as f:
            json.dump([], f)

def log_mood(mood_label: str):
    _ensure()
    entry = {"ts": datetime.now().isoformat(timespec="seconds"), "mood": mood_label}
    try:
        with open(MOOD_FILE, "r") as f:
            data = json.load(f)
    except json.JSONDecodeError:
        data = []
    data.append(entry)
    with open(MOOD_FILE, "w") as f:
        json.dump(data, f, indent=2)

def display_mood_chart():
    _ensure()
    try:
        with open(MOOD_FILE, "r") as f:
            rows = json.load(f)
    except json.JSONDecodeError:
        rows = []
    if not rows:
        st.info("No mood entries yet.")
        return
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["ts"]).dt.date
    daily = df.groupby(["date", "mood"]).size().reset_index(name="count")
    st.bar_chart(daily.pivot(index="date", columns="mood", values="count").fillna(0))