# backend/db/utils.py

# Import standard modules
import os
import platform
import subprocess

# -----------------------------
# Load hash from file
# -----------------------------
def load_hash(path: str):
    if path and os.path.exists(path):
        with open(path, "r") as f:
            return f.read().strip()
    return None

# -----------------------------
# Normalize string (strip and convert empty to None)
# -----------------------------
def normalize(value):
    return value.strip() if value and value.strip() else None

# -----------------------------
# convert string to int (returns None if conversion fails)
# -----------------------------
def to_int(v: str):
    v = (v or "").strip()
    if not v or v.lower() == "null":
        return None
    try:
        return int(v)
    except ValueError:
        return None

# -----------------------------
# convert string to bool (returns None if conversion fails)
# -----------------------------
def to_bool(v: str):
    v = (v or "").strip().lower()
    if v in ("true", "1", "yes", "y"):
        return True
    if v in ("false", "0", "no", "n"):
        return False
    return None

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
