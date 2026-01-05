# backend/db/db.py

import os
import sqlite3

DB_PATH = os.environ.get("DB_PATH", "/data/database.db")

_connection = None

# -----------------------------
# Connect to the database
# -----------------------------
def get_db():
    global _connection
    if _connection is None:
        os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
        _connection = sqlite3.connect(DB_PATH, check_same_thread=False)
        _connection.row_factory = sqlite3.Row
        _connection.execute("PRAGMA foreign_keys = ON;")
    return _connection

# -----------------------------
# Init Database
# -----------------------------
def init_db():
    conn = get_db()
    cur = conn.cursor()
    conn.commit()
