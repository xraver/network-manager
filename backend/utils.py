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

# -----------------------------
# Normalize string (strip and convert empty to None)
# -----------------------------
def normalize(value):
    return value.strip() if value and value.strip() else None

