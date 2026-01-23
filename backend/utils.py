# backend/db/utils.py

# Import standard modules
import os

# -----------------------------
# Load hash from file
# -----------------------------
def load_hash(path: str):
    if path and os.path.exists(path):
        with open(path, "r") as f:
            return f.read().strip()
    return None
