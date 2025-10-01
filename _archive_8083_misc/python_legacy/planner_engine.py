# modules/planner_engine.py
from __future__ import annotations
import json, uuid
from pathlib import Path
from datetime import datetime, date, time as dtime, timedelta
from typing import List, Dict, Any, Optional
import streamlit as st

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "planner_tasks.json"
DATA_PATH.parent.mkdir(parents=True, exist_ok=True)

ISO_DT = "%Y-%m-%d %H:%M"
ISO_D = "%Y-%m-%d"

# ---------- low-level utils ----------

def _read_json(path: Path) -> Any:
    try:
        if not path.exists():
            path.write_text("[]", encoding="utf-8")
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        # Recovery if file corrupted
        backup = path.with_suffix(".json.bak")
        try:
            backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
        except Exception:
            pass
        path.write_text("[]", encoding="utf-8")
        return []

def _write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

def _new_id() -> str:
    return uuid.uuid4().hex[:10]

def _parse_when(val) -> Optional[str]:
    """
    Accepts: date, str 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM'
    Returns ISO string; None if not parseable.
    """
    if val is None:
        return None
    if isinstance(val, date) and not isinstance(val, datetime):
        return datetime.combine(val, dtime.min).strftime(ISO_DT)
    if isinstance(val, datetime):
        return val.strftime(ISO_DT)
    if isinstance(val, str):
        val = val.strip()
        for fmt in (ISO_DT, ISO_D):
            try:
                dt = datetime.strptime(val, fmt)
                if fmt == ISO_D:
                    dt = datetime.combine(dt.date(), dtime.min)
                return dt.strftime(ISO_DT)
            except ValueError:
                continue
    return None

def _ensure_ids(tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    changed = False
    cleaned: List[Dict[str, Any]] = []
    for t in tasks:
        if not isinstance(t, dict):
            # Skip non-dict garbage safely
            continue
        if "id" not in t or not t.get("id"):
            t["id"] = _new_id(); changed = True
        if "type" not in t:
            t["type"] = "task"; changed = True
        # Normalize 'when' to ISO_DT if present
        if t.get("when") is not None:
            iso = _parse_when(t["when"])
            if iso and iso != t["when"]:
                t["when"] = iso; changed = True
        # Optional fields
        t.setdefault("title", "(untitled)")
        t.setdefault("done", False)
        t.setdefault("remind_minutes", None)
        cleaned.append(t)
    if changed:
        _write_json(DATA_PATH, cleaned)
    return cleaned

# ---------- public API ----------

def load_tasks() -> List[Dict[str, Any]]:
    data = _read_json(DATA_PATH)
    if isinstance(data, dict):  # in case someone saved an object by mistake
        data = [data]
    tasks = _ensure_ids(list(data))
    # Sort: earliest first, then undone first
    def _sort_key(t):
        when = t.get("when")
        try:
            dt = datetime.strptime(when, ISO_DT) if when else datetime.max
        except Exception:
            dt = datetime.max
        return (t.get("done", False), dt)
    tasks.sort(key=_sort_key)
    return tasks

def save_tasks(tasks: List[Dict[str, Any]]) -> None:
    _write_json(DATA_PATH, tasks)

def add_task(title: str, when, kind: str = "task", remind_minutes: Optional[int] = None) -> Dict[str, Any]:
    tasks = load_tasks()
    item = {
        "id": _new_id(),
        "type": kind if kind in ("task", "event") else "task",
        "title": title.strip() or "(untitled)",
        "when": _parse_when(when),
        "done": False,
        "remind_minutes": int(remind_minutes) if remind_minutes not in (None, "") else None,
    }
    tasks.append(item)
    save_tasks(tasks)
    return item

def delete_task(task_id: str) -> None:
    tasks = load_tasks()
    tasks = [t for t in tasks if t.get("id") != task_id]
    save_tasks(tasks)

def toggle_done(task_id: str, value: Optional[bool] = None) -> None:
    tasks = load_tasks()
    for t in tasks:
        if t.get("id") == task_id:
            t["done"] = (not t.get("done", False)) if value is None else bool(value)
            break
    save_tasks(tasks)

def add_from_text(text: str) -> List[Dict[str, Any]]:
    """
    Parse lines like:
      PLAN:
      - task | Pay bills | 2025-08-10 09:00 | 60
      - event | Meeting w/ Omar | 2025-08-11 14:30 | 15
    Returns list of created items.
    """
    created = []
    if not text:
        return created
    lines = [ln.strip(" -") for ln in text.splitlines() if ln.strip()]
    for ln in lines:
        if "|" not in ln:
            continue
        parts = [p.strip() for p in ln.split("|")]
        if len(parts) < 3:
            continue
        kind, title, when = parts[:3]
        remind = int(parts[3]) if len(parts) >= 4 and parts[3].strip().isdigit() else None
        created.append(add_task(title=title, when=when, kind=kind, remind_minutes=remind))
    return created

# ---------- reminders ----------

def _reminder_due(task: Dict[str, Any], now: datetime) -> bool:
    if task.get("done"):
        return False
    mins = task.get("remind_minutes")
    if not mins:
        return False
    when = task.get("when")
    if not when:
        return False
    try:
        dt = datetime.strptime(when, ISO_DT)
    except Exception:
        return False
    reminder_at = dt - timedelta(minutes=int(mins))
    if now >= reminder_at and not task.get("_reminded"):
        return True
    return False

def due_reminders() -> List[Dict[str, Any]]:
    now = datetime.now()
    tasks = load_tasks()
    due = [t for t in tasks if _reminder_due(t, now)]
    if due:
        # mark as reminded so we don't spam
        for t in tasks:
            if any(d.get("id") == t.get("id") for d in due):
                t["_reminded"] = True
        save_tasks(tasks)
    return due

# ---------- UI ----------

def render_planner(tasks: Optional[List[Dict[str, Any]]] = None, *, allow_edit: bool = True) -> None:
    """
    Renders the planner list with safe handling of missing ids.
    """
    if tasks is None:
        tasks = load_tasks()

    # Show due reminders
    due = due_reminders()
    if due:
        with st.expander(f"🔔 {len(due)} reminder(s) due", expanded=True):
            for t in due:
                st.info(f"• {t.get('title','(untitled)')} @ {t.get('when','—')}")

    if not tasks:
        st.caption("No items yet. Add a task below.")
        return

    st.write("### Upcoming")
    for idx, t in enumerate(tasks):
        # SAFE ID for widgets
        safe_id = t.get("id") or f"idx-{idx}"
        title = t.get("title", "(untitled)")
        when = t.get("when", "—")
        done = bool(t.get("done", False))
        kind = t.get("type", "task")
        remind = t.get("remind_minutes", None)

        left, mid, right = st.columns([0.06, 0.74, 0.20])

        with left:
            clicked = st.checkbox("Done", value=done, key=f"done-{safe_id}", label_visibility="collapsed")
            if clicked != done:
                # reflect change
                try:
                    toggle_done(safe_id, clicked)
                except Exception:
                    pass

        with mid:
            line = f"**{title}**"
            if kind == "event":
                line += " · 📍 event"
            if when and when != "—":
                line += f" · 🗓 {when}"
            if remind:
                line += f" · ⏰ -{remind}m"
            st.markdown(line)

        with right:
            if allow_edit and st.button("🗑️", key=f"del-{safe_id}"):
                try:
                    delete_task(safe_id)
                    st.experimental_rerun()
                except Exception as e:
                    st.error(f"Delete failed: {e}")