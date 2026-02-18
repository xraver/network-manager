# backend/db/aliases.py

# Import standard modules
import ipaddress
import logging
import os
import re
import sqlite3
# Import local modules
from backend.db.db import get_db, register_init
# Import Settings
from settings.settings import settings
# Import Log
from log.log import get_logger

# -----------------------------
# Check Data Input
# -----------------------------
def validate_data(data: dict) -> dict:
    # Check name
    if "name" not in data:
        raise ValueError("Missing required field: name")
    name = str(data["name"]).strip()
    if not name:
        raise ValueError("Field 'name' cannot be empty")

    # Check target
    if "target" not in data:
        raise ValueError("Missing required field: target")
    target = str(data["target"]).strip()
    if not target:
        raise ValueError("Field 'target' cannot be empty")

    # Check note
    note = data.get("note")

    # Boolean normalization for DB (0/1)
    ssl_enabled = int(bool(data.get("ssl_enabled", 0)))

    return {
        "name": name,
        "target": target,
        "note": note,
        "ssl_enabled": ssl_enabled,
    }

# -----------------------------
# SELECT ALL ALIASES
# -----------------------------
def get_aliases():
    conn = get_db()
    cur = conn.execute("SELECT * FROM aliases ORDER BY target")
    rows = [dict(r) for r in cur.fetchall()]
    return rows

# -----------------------------
# SELECT SINGLE ALIAS
# -----------------------------
def get_alias(alias_id: int):
    conn = get_db()
    cur = conn.execute("SELECT * FROM aliases WHERE id = ?", (alias_id,))
    row = cur.fetchone()
    return dict(row) if row else None

# -----------------------------
# ADD ALIAS
# -----------------------------
def add_alias(data: dict):

    # Validate input
    cleaned = validate_data(data)

    conn = get_db()
    try:
        cur = conn.execute(
            "INSERT INTO aliases (name, target, note, ssl_enabled) VALUES (?, ?, ?, ?)",
            (
                cleaned["name"],
                cleaned["target"],
                cleaned["note"],
                cleaned["ssl_enabled"],
            )
        )
        conn.commit()
        return cur.lastrowid

    except sqlite3.IntegrityError as e:
        conn.rollback()
        return -1

    except Exception as e:
        conn.rollback()
        raise

# -----------------------------
# UPDATE ALIAS
# -----------------------------
def update_alias(alias_id: int, data: dict) -> bool:

    # Validate input
    cleaned = validate_data(data)

    conn = get_db()
    try:
        cur = conn.execute(
            """
            UPDATE aliases
            SET name=?, target=?, note=?, ssl_enabled=?
            WHERE id=?
            """,
            (
                cleaned["name"],
                cleaned["target"],
                cleaned["note"],
                cleaned["ssl_enabled"],
                alias_id,
            )
        )
        conn.commit()
        return cur.rowcount > 0

    except Exception:
        conn.rollback()
        raise

# -----------------------------
# DELETE ALIAS
# -----------------------------
def delete_alias(alias_id: int) -> bool:

    # Validate input
    if alias_id is None:
        raise ValueError("alias_id cannot be None")

    conn = get_db()
    try:
        cur = conn.execute(
            "DELETE FROM aliases WHERE id = ?",
            (alias_id,)
        )
        conn.commit()

        return cur.rowcount > 0

    except Exception:
        conn.rollback()
        raise

# -----------------------------
# Initialize Aliases DB Table
# -----------------------------
@register_init
def init_db_alias_table(cur):
    logger = get_logger(__name__)

    # ALIASES TABLE
    cur.execute("""
        CREATE TABLE aliases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            target TEXT NOT NULL,
            note TEXT,
            ssl_enabled INTEGER NOT NULL DEFAULT 0
        );
    """)
    cur.execute("CREATE INDEX idx_aliases_name ON aliases(name);")

    logger.info("ALIASES DB: Database initialized successfully for %s", settings.DOMAIN)
    logger.info("ALIASES DB: Public IP: %s", settings.PUBLIC_IP)
