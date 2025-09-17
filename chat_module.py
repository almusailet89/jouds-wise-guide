# modules/chat_module.py
from __future__ import annotations

from openai import OpenAI
from datetime import datetime
from typing import Dict, List, Optional
import os, json

API_KEY = os.getenv("OPENAI_API_KEY")
if not API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not set. Please export it in your shell.")
client = OpenAI(api_key=API_KEY)

SYSTEM_PROMPT = (
    "You are Joud, a warm Saudi personal assistant who is concise, helpful, and respectful. "
    "When user asks to add tasks, log expenses, or update mood, confirm the details first."
)

def chat_interface(prompt: str) -> str:
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=0.5,
    )
    return resp.choices[0].message.content.strip()

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
PORT_FILE = os.path.join(DATA_DIR, "portfolio.json")
TX_FILE = os.path.join(DATA_DIR, "transactions.json")

# ---------------------------
# Internal helpers
# ---------------------------

def _ensure() -> None:
    """Ensure data directory and baseline files exist."""
    os.makedirs(DATA_DIR, exist_ok=True)

    if not os.path.exists(PORT_FILE):
        with open(PORT_FILE, "w") as f:
            json.dump({
                "income": 0.0,
                "expenses": 0.0,
                "risk": 50,
                "last_updated": None
            }, f)

    if not os.path.exists(TX_FILE):
        with open(TX_FILE, "w") as f:
            json.dump({"incomes": [], "expenses": []}, f)


def _read_json(path: str, default):
    try:
        with open(path, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def _write_json(path: str, payload) -> None:
    with open(path, "w") as f:
        json.dump(payload, f, indent=2)

# ---------------------------
# Backward‑compatible portfolio API
# ---------------------------

def load_portfolio() -> dict:
    """Load summary portfolio numbers (legacy)."""
    _ensure()
    return _read_json(PORT_FILE, {"income": 0.0, "expenses": 0.0, "risk": 50, "last_updated": None})


def log_financials(income: float, expenses: float) -> dict:
    """Overwrite legacy portfolio totals and timestamp."""
    _ensure()
    p = {
        "income": float(income or 0),
        "expenses": float(expenses or 0),
        "risk": load_portfolio().get("risk", 50),
        "last_updated": datetime.now().isoformat(timespec="seconds")
    }
    _write_json(PORT_FILE, p)
    return p

# ---------------------------
# New persistent transactions API
# ---------------------------

def _load_tx() -> Dict[str, List[dict]]:
    _ensure()
    data = _read_json(TX_FILE, {"incomes": [], "expenses": []})
    data.setdefault("incomes", [])
    data.setdefault("expenses", [])
    return data


def _append_tx(kind: str, amount: float, label: str, note: str = "") -> dict:
    if kind not in ("incomes", "expenses"):
        raise ValueError("kind must be 'incomes' or 'expenses'")
    _ensure()
    payload = _load_tx()
    entry = {
        "amount": float(amount or 0),
        "label": label or ("Salary" if kind == "incomes" else "General"),
        "note": note or "",
        "ts": datetime.now().isoformat(timespec="seconds")
    }
    payload[kind].append(entry)
    _write_json(TX_FILE, payload)
    return entry


def add_income(amount: float, source: str = "Salary", note: str = "") -> dict:
    return _append_tx("incomes", amount, source, note)


def add_expense(amount: float, category: str = "General", note: str = "") -> dict:
    return _append_tx("expenses", amount, category, note)


def get_history(limit: Optional[int] = None) -> Dict[str, List[dict]]:
    data = _load_tx()
    if isinstance(limit, int) and limit > 0:
        data = {
            "incomes": data["incomes"][-limit:],
            "expenses": data["expenses"][-limit:]
        }
    return data


def clear_history() -> None:
    _write_json(TX_FILE, {"incomes": [], "expenses": []})


def get_summary() -> dict:
    data = _load_tx()
    total_income = sum(e.get("amount", 0.0) for e in data["incomes"])
    total_exp = sum(e.get("amount", 0.0) for e in data["expenses"])
    savings = total_income - total_exp
    savings_rate = (savings / total_income) if total_income else 0.0

    by_income: Dict[str, float] = {}
    for e in data["incomes"]:
        by_income[e.get("label", "?")] = by_income.get(e.get("label", "?"), 0.0) + float(e.get("amount", 0.0))

    by_expense: Dict[str, float] = {}
    for e in data["expenses"]:
        by_expense[e.get("label", "?")] = by_expense.get(e.get("label", "?"), 0.0) + float(e.get("amount", 0.0))

    rec = {
        "needs": total_income * 0.50,
        "wants": total_income * 0.30,
        "savings": total_income * 0.20,
    }

    return {
        "totals": {
            "income": total_income,
            "expenses": total_exp,
            "savings": savings,
            "savings_rate": savings_rate,
        },
        "breakdown": {
            "incomes": by_income,
            "expenses": by_expense,
        },
        "recommendations": rec,
        "count": {
            "incomes": len(data["incomes"]),
            "expenses": len(data["expenses"]),
        },
    }

# Backward-compat: simple rule-based ideas

def suggest_investments(risk: int, horizon: str) -> list:
    """Simple rule-based suggestions; kept for backward compatibility."""
    if risk < 34:
        base = [
            "Government Sukuk/Bonds",
            "High-yield savings",
            "KSA/US broad ETFs",
        ]
    elif risk < 67:
        base = [
            "Blue-chip KSA/US stocks",
            "Balanced ETFs",
            "REITs",
            "Gold 5-10%",
        ]
    else:
        base = [
            "Growth tech (capped)",
            "Small caps",
            "Crypto ≤ 10%",
            "Frontier ETFs",
        ]
    tail = {
        "Short (≤1y)": ["Hold more cash buffer", "Focus on low-volatility instruments"],
        "Medium (1–3y)": ["Mix growth and income", "Use DCA monthly"],
        "Long (3y+)": ["Tilt to growth and EM", "Rebalance quarterly"],
    }.get(horizon, [])
    return base + tail

# If run directly, tiny smoke test
if __name__ == "__main__":
    _ensure()
    add_income(5000, "Salary")
    add_expense(1500, "Rent")
    print(json.dumps(get_summary(), indent=2))