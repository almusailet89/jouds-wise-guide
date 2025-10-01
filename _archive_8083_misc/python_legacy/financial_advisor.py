from __future__ import annotations
from datetime import datetime
import os, json
from typing import Dict, List, Optional

# ---------------------------
# Paths
# ---------------------------
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
PORT_FILE = os.path.join(DATA_DIR, "portfolio.json")
TX_FILE = os.path.join(DATA_DIR, "transactions.json")
PROFILE_FILE = os.path.join(DATA_DIR, "user_profile.json")

# ---------------------------
# Internal helpers
# ---------------------------

def _ensure() -> None:
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


def _read_profile(profile_path: Optional[str] = None) -> dict:
    """Load user_profile.json if present; return {} if missing/invalid."""
    path = profile_path or PROFILE_FILE
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception:
        return {}

# ---------------------------
# Backward‑compatible portfolio API
# ---------------------------

def load_portfolio() -> dict:
    _ensure()
    return _read_json(PORT_FILE, {"income": 0.0, "expenses": 0.0, "risk": 50, "last_updated": None})


def log_financials(income: float, expenses: float) -> dict:
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
# Transactions + profile seeding
# ---------------------------

def _load_tx() -> Dict[str, List[dict]]:
    _ensure()
    data = _read_json(TX_FILE, {"incomes": [], "expenses": []})
    data.setdefault("incomes", [])
    data.setdefault("expenses", [])
    return data


def seed_from_profile(profile_path: Optional[str] = None) -> bool:
    """If transactions are empty, seed incomes/expenses from user_profile.json.
    Returns True if seeding occurred, else False.
    """
    payload = _load_tx()
    if payload.get("incomes") or payload.get("expenses"):
        return False  # already has data
    prof = _read_profile(profile_path)
    seeded = False

    for e in (prof.get("incomes") or []):
        try:
            amount = float(e.get("amount", 0) or 0)
            label = str(e.get("label", "Salary") or "Salary")
            note = str(e.get("note", "") or "")
            ts = e.get("ts")
            payload.setdefault("incomes", []).append({
                "amount": amount,
                "label": label,
                "note": note,
                "ts": ts or datetime.now().isoformat(timespec="seconds"),
            })
            seeded = True
        except Exception:
            continue

    for e in (prof.get("expenses") or []):
        try:
            amount = float(e.get("amount", 0) or 0)
            label = str(e.get("label", "General") or "General")
            note = str(e.get("note", "") or "")
            ts = e.get("ts")
            payload.setdefault("expenses", []).append({
                "amount": amount,
                "label": label,
                "note": note,
                "ts": ts or datetime.now().isoformat(timespec="seconds"),
            })
            seeded = True
        except Exception:
            continue

    if seeded:
        _write_json(TX_FILE, payload)
    return seeded


def get_cash_from_profile(profile_path: Optional[str] = None) -> dict:
    """Return the 'cash' mapping from user_profile.json if available."""
    prof = _read_profile(profile_path)
    portfolio = prof.get("portfolio", {}) if isinstance(prof, dict) else {}
    cash = portfolio.get("cash", {}) if isinstance(portfolio, dict) else {}
    safe: Dict[str, float] = {}
    for k, v in cash.items():
        try:
            safe[str(k)] = float(v)
        except Exception:
            continue
    return safe

# ---------------------------
# Public API
# ---------------------------

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

# ---------------------------
# Backward-compat: simple rule-based ideas
# ---------------------------

def suggest_investments(risk: int, horizon: str) -> list:
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


if __name__ == "__main__":
    _ensure()
    # Optionally seed once from profile if empty
    try:
        seed_from_profile()
    except Exception:
        pass
    print(json.dumps(get_summary(), indent=2))