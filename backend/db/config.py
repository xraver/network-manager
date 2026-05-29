# backend/db/config.py

# Import local modules
from backend.db.db import get_db, register_init

# Import Settings
from backend.settings.settings import settings
# Import Logging
from backend.log.log import get_logger

# Logger initialization
logger = get_logger(__name__)

# ---------------------------------------------------------
# Type mapping for config keys
# ---------------------------------------------------------
CONFIG_TYPES = {
    "EXTERNAL_NAME": str,
    "LOGIN_MAX_ATTEMPTS": int,
    "LOGIN_WINDOW_SECONDS": int,
}

# ---------------------------------------------------------
# Default Values
# ---------------------------------------------------------
CONFIG_DEFAULTS = {
    "EXTERNAL_NAME": settings.EXTERNAL_NAME,
    "LOGIN_MAX_ATTEMPTS": settings.LOGIN_MAX_ATTEMPTS,
    "LOGIN_WINDOW_SECONDS": settings.LOGIN_WINDOW_SECONDS,
}

# ---------------------------------------------------------
# Runtime cache to avoid repeated DB queries
# ---------------------------------------------------------
_config_cache = {}

# ---------------------------------------------------------
# Clear cache
# ---------------------------------------------------------
def clear_cache(key=None):
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
# Create Config DB Tables
# ---------------------------------------------------------
@register_init
def init_db_config_table(cur):

    # CONFIG TABLE
    cur.execute("""
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    """)

# ---------------------------------------------------------
# Initialize Config DB Tables
# ---------------------------------------------------------
@register_init
def init_db_config_defaults(cur):

    # Add configuration parameters
    for key, value in CONFIG_DEFAULTS.items():
        cur.execute("INSERT OR IGNORE INTO config VALUES (?, ?)", (key, str(value)))
