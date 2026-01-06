# backend/db/utils.py

# Import standard modules
from datetime import datetime
import os

# -----------------------------
# Load hash from file
# -----------------------------
def load_hash(hash_file: str):
    path = os.environ.get(hash_file)
    if path and os.path.exists(path):
        with open(path, "r") as f:
            return f.read().strip()
    return None

# -----------------------------
# Log Event
# -----------------------------
def log_event(event: str, **fields):
    ts = datetime.utcnow().isoformat() + "Z"
    parts = " ".join(f"{k}={v}" for k, v in fields.items())
    print(f"INFO:     {ts} {event} {parts}")

