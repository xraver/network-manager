# backend/db/settings.py

# Import local modules
from backend.db.db import get_db, register_init
from backend.utils import to_bool

# Import Settings
from backend.settings.settings import settings
# Import Logging
from backend.log.log import get_logger

# Logger initialization
logger = get_logger(__name__)

# ---------------------------------------------------------
# Internal: wrapper to to_bool
# ---------------------------------------------------------
def _to_bool(v):
    result = to_bool(v)
    return result if result is not None else False

# ---------------------------------------------------------
# Type mapping for config keys
# ---------------------------------------------------------
CONFIG_TYPES = {
    "LOG_LEVEL": str,
    "LOG_TO_FILE": _to_bool,
    "EXTERNAL_NAME": str,
    "LOGIN_MAX_ATTEMPTS": int,
    "LOGIN_WINDOW_SECONDS": int,
    "PING_WORKERS": int,
}

# ---------------------------------------------------------
# Default Values
# ---------------------------------------------------------
CONFIG_DEFAULTS = {
    "LOG_LEVEL": settings.LOG_LEVEL,
    "LOG_TO_FILE": settings.LOG_TO_FILE,
    "EXTERNAL_NAME": settings.EXTERNAL_NAME,
    "LOGIN_MAX_ATTEMPTS": settings.LOGIN_MAX_ATTEMPTS,
    "LOGIN_WINDOW_SECONDS": settings.LOGIN_WINDOW_SECONDS,
    "PING_WORKERS": settings.PING_WORKERS,
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
def set_config(key, value):
    if key not in CONFIG_TYPES:
        logger.warning("Config key not typed: %s", key)

    # salva sempre come stringa
    str_value = str(value)

    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
        (key, str_value),
    )
    conn.commit()

    # invalida cache
    clear_cache(key)

# ---------------------------------------------------------
# Return a specific config value (with cache + type casting)
# ---------------------------------------------------------
def get_config(key):

    if key not in CONFIG_TYPES:
        logger.warning("Invalid config key: %s", key)

    # ---- Cache hit ----
    if key in _config_cache:
        return _config_cache[key]

    # ---- Read from DB ----
    conn = get_db()
    cur = conn.execute("SELECT value FROM config WHERE key = ?", (key,))
    row = cur.fetchone()

    if not row:
        value = getattr(settings, key, None)
        logger.warning("Config key not found in database: %s (using default: %s)", key, value)
        _config_cache[key] = value
        return value

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
# Return a specific config value or default
# ---------------------------------------------------------
def get_config_or(key, default):
    value = get_config(key)
    return value if value is not None else default

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
