# modules/smart_suggester.py
from __future__ import annotations

import json
from pathlib import Path
from datetime import date
from typing import Any, Dict, List

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
MOOD_FILE = DATA_DIR / "mood_log.json"
TASKS_FILE = DATA_DIR / "planner_tasks.json"
PROFILE_FILE = DATA_DIR / "user_profile.json"
PORTFOLIO_FILE = DATA_DIR / "portfolio.json"


# ---------- helpers ----------
def _read_json(path: Path, default):
    try:
        if not path.exists():
            return default
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def build_context(today: date | None = None) -> Dict[str, Any]:
    """Build a context dict from local data files."""
    today = today or date.today()

    moods: List[dict] = _read_json(MOOD_FILE, [])
    tasks: List[dict] = _read_json(TASKS_FILE, [])
    profile: dict = _read_json(PROFILE_FILE, {})
    portfolio: dict = _read_json(PORTFOLIO_FILE, {})

    last_mood = None
    if moods:
        try:
            last_mood = int(moods[-1].get("mood"))
        except Exception:
            last_mood = None

    recent = []
    for m in moods[-7:]:
        try:
            recent.append(int(m.get("mood")))
        except Exception:
            pass
    avg_7 = round(sum(recent) / len(recent), 2) if recent else None

    todays = [t for t in tasks if t.get("date") == today.isoformat() and not t.get("done")]
    upcoming = sorted(tasks, key=lambda t: (t.get("date", "9999-12-31"), t.get("created_at", "")))

    return {
        "today": today.isoformat(),
        "last_mood": last_mood,
        "avg_mood_7": avg_7,
        "tasks_today": todays,
        "tasks_all": upcoming,
        "interests": profile.get("interests", []),
        "goals": profile.get("goals", []),
        "portfolio": portfolio,
        "profile": profile,
    }


# ---------- PUBLIC API ----------
def generate_suggestions(context: Dict[str, Any] | None = None) -> List[str]:
    """
    Produce user suggestions. If no context is provided, it builds one from local JSON files.
    """
    ctx = context or build_context()
    out: List[str] = []

    # Mood-based nudges
    lm = ctx.get("last_mood")
    avg = ctx.get("avg_mood_7")
    if lm is not None:
        if lm <= 3:
            out += [
                "Take a 5-minute breathing break.",
                "Short walk outside – 10 minutes.",
                "Queue your favorite calm playlist.",
            ]
        elif lm >= 8:
            out += [
                "Great energy! Tackle a high-impact task first.",
                "Schedule a workout or a football match with friends.",
            ]
    if avg is not None and avg < 5:
        out.append("Your 7-day mood average is a bit low—try a gentle workout or call a friend.")

    # Planner-based nudges
    todays = ctx.get("tasks_today", [])
    if todays:
        out.append(f"You have {len(todays)} task(s) today. Start with “{todays[0]['title']}”.")
    else:
        out.append("No tasks today. Add one goal you can finish in 30 minutes.")

    # Interest-based
    interests = {str(i).lower() for i in ctx.get("interests", [])}
    if "football" in interests or "soccer" in interests:
        out.append("Al-Hilal play this week—want me to add a match reminder to your planner?")

    # Finance nudge
    if ctx.get("portfolio"):
        out.append("Review your portfolio allocation weekly to keep risk on target.")

    # De-dupe while keeping order
    seen = set()
    uniq = []
    for s in out:
        if s not in seen:
            uniq.append(s)
            seen.add(s)
    return uniq