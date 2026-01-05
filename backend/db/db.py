# backend/db/db.py

# Import standard modules
import os
import sqlite3
# Import local modules
from backend.config import DB_FILE

_connection = None
_init_functions = []

def register_init(func):
    _init_functions.append(func)
    return func

# -----------------------------
# Connect to the database
# -----------------------------
def get_db():
    global _connection
    if _connection is None:
        os.makedirs(os.path.dirname(DB_FILE) or ".", exist_ok=True)
        _connection = sqlite3.connect(DB_FILE, check_same_thread=False)
        _connection.row_factory = sqlite3.Row
        _connection.execute("PRAGMA foreign_keys = ON;")
    return _connection

# -----------------------------
# Init Database
# -----------------------------
def init_db():
    print(f"INFO:     Starting DB Initialization.")

    conn = get_db()
    cur = conn.cursor()

    for func in _init_functions:
        func(cur)

    conn.commit()
    conn.close()

    print(f"INFO:     DB Initialization Completed.")