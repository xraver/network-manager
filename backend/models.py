import sqlite3
import os

DB_PATH = os.environ.get("DB_PATH", "/app/database.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS hosts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            ipv4 TEXT,
            ipv6 TEXT,
            mac TEXT,
            note TEXT,
            ssl_enabled INTEGER NOT NULL DEFAULT 0
        )
    """)
    conn.commit()
    conn.close()
