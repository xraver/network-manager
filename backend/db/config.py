# backend/db/config.py

# Import standard modules
import os
import sqlite3

# Import local modules
from backend.db.db import get_db, register_init

# Import Settings & Logging
from backend.settings.settings import settings
from backend.log.log import setup_logging, get_logger

# Logger initialization
logger = get_logger(__name__)

# -----------------------------
# Return a specific config value
# -----------------------------
def get_config(key):
    conn = get_db()
    cur = conn.execute("SELECT value FROM config WHERE key = ?", (key,))
    row = cur.fetchone()
    return row["value"] if row else None

# -----------------------------
# Initialize Config DB Table
# -----------------------------
@register_init
def init_db_hosts_table(cur):

    # SETTINGS TABLE
    cur.execute("""
        CREATE TABLE config (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    """)
    cur.execute("INSERT INTO config (key, value) VALUES (?, ?)", ("domain", settings.DOMAIN))
    cur.execute("INSERT INTO config (key, value) VALUES (?, ?)", ("external_name", settings.EXTERNAL_NAME))

    logger.info("CONFIG DB: Tables initialized successfully")
