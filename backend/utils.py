# backend/db/utils.py

# Import standard modules
import subprocess

# -----------------------------
# Normalize string (strip and convert empty to None)
# -----------------------------
def normalize(value):
    return value.strip() if value and value.strip() else None

# -----------------------------
# convert string to int (returns None if conversion fails)
# -----------------------------
def to_int(v: str, default: int | None = None) -> int | None:
    v = (v or "").strip()
    if not v or v.lower() == "null":
        return default
    try:
        return int(v)
    except ValueError:
        return default

# -----------------------------
# convert string to bool (returns None if conversion fails)
# -----------------------------
def to_bool(v: str, default: bool | None = None) -> bool | None:
    # bool
    if isinstance(v, bool):
        return v
    # int
    if isinstance(v, int):
        return bool(v)
    # strings
    if isinstance(v, str):
        v = v.strip().lower()
        if v in ("true", "1", "yes", "y", "on"):
            return True
        if v in ("false", "0", "no", "n", "off"):
            return False
    return default

# -----------------------------
# check if host is active (ping)
# -----------------------------
def is_host_active(ip: str, timeout: int = 1) -> bool:
    try:
        result = subprocess.run(
            ["ping", "-c", "1", "-W", str(timeout), ip],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        return result.returncode == 0

    except Exception:
        return False
