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

# ---------------------------------------------------------
# Type mapping for config keys
# ---------------------------------------------------------
CONFIG_TYPES = {
    "external_name": str,
    "login_max_attempts": int,
    "login_window_seconds": int,
}

# ---------------------------------------------------------
# Runtime cache to avoid repeated DB queries
# ---------------------------------------------------------
_config_cache = {}

def invalidate_config(key=None):
    """Clear cached config entry (or full cache)."""
    if key:
        _config_cache.pop(key, None)
    else:
        _config_cache.clear()

# ---------------------------------------------------------
# Return a specific config value (with cache + type casting)
# ---------------------------------------------------------
def get_config(key):
    # ---- Cache hit ----
    if key in _config_cache:
        return _config_cache[key]

    # ---- Read from DB ----
    conn = get_db()
    cur = conn.execute("SELECT value FROM config WHERE key = ?", (key,))
    row = cur.fetchone()

    if not row:
        return None

    raw_value = row["value"]

    # ---- Type casting ----
    caster = CONFIG_TYPES.get(key, str)
    try:
        value = caster(raw_value)
    except Exception:
        value = raw_value  # fallback safe

    # ---- Save in cache ----
    _config_cache[key] = value
    return value

# ---------------------------------------------------------
# Initialize Config DB Table
# ---------------------------------------------------------
@register_init
def init_db_hosts_table(cur):

    # CONFIG TABLE
    cur.execute("""
        CREATE TABLE config (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    """)

    # Initial values from settings (as strings in DB)
    cur.execute("INSERT INTO config (key, value) VALUES (?, ?)", ("external_name", settings.EXTERNAL_NAME))
    cur.execute("INSERT INTO config (key, value) VALUES (?, ?)", ("login_max_attempts", str(settings.LOGIN_MAX_ATTEMPTS)))
    cur.execute("INSERT INTO config (key, value) VALUES (?, ?)", ("login_window_seconds", str(settings.LOGIN_WINDOW_SECONDS)))

    logger.info("CONFIG DB: Tables initialized successfully")
