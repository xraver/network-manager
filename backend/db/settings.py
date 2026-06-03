# backend/db/settings.py

# Import standard modules
from typing import Any, Dict, List

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
    if result is None:
        raise ValueError(f"Invalid boolean value: {v}")
    return result

# ---------------------------------------------------------
# Type mapping for config keys
# ---------------------------------------------------------
TYPE_CASTERS = {
    "string": str,
    "integer": int,
    "number": float,
    "boolean": _to_bool,
}

# ---------------------------------------------------------
# Default Values
# ---------------------------------------------------------
CONFIG_DEFAULTS = {
    "LOG_LEVEL": {
        "value": settings.LOG_LEVEL,
        "description": "Logging verbosity level",
        "group_name": "logging",
        "type": "string",
        "allowed": ["debug", "info", "warning", "error", "critical"],
    },
    "LOG_TO_FILE": {
        "value": settings.LOG_TO_FILE,
        "description": "Enable file logging",
        "group_name": "logging",
        "allowed": [True, False],
        "type": "boolean",
    },
    "DOMAIN": {
        "value": settings.DOMAIN,
        "description": "Domain name for DNS configuration",
        "group_name": "network",
        "type": "string",
    },
    "EXTERNAL_NAME": {
        "value": settings.EXTERNAL_NAME,
        "description": "External hostname or IP for API access",
        "group_name": "network",
        "type": "string",
    },
    "DNS_HOST_FILE": {
        "value": settings.DNS_HOST_FILE,
        "description": "Path to DNS host file",
        "group_name": "network - dns",
        "type": "string",
    },
    "DNS_ALIAS_FILE": {
        "value": settings.DNS_ALIAS_FILE,
        "description": "Path to DNS alias file",
        "group_name": "network - dns",
        "type": "string",
    },
    "DNS_REVERSE_FILE": {
        "value": settings.DNS_REVERSE_FILE,
        "description": "Path to DNS reverse file",
        "group_name": "network - dns",
        "type": "string",
    },
    "DHCP4_HOST_FILE": {
        "value": settings.DHCP4_HOST_FILE,
        "description": "Path to DHCPv4 host file",
        "group_name": "network - dhcp",
        "type": "string",
    },
    "DHCP4_LEASES_FILE": {
        "value": settings.DHCP4_LEASES_FILE,
        "description": "Path to DHCPv4 leases file",
        "group_name": "network - dhcp",
        "type": "string",
    },
    "DHCP6_HOST_FILE": {
        "value": settings.DHCP6_HOST_FILE,
        "description": "Path to DHCPv6 host file",
        "group_name": "network - dhcp",
        "type": "string",
    },
    "DHCP6_LEASES_FILE": {
        "value": settings.DHCP6_LEASES_FILE,
        "description": "Path to DHCPv6 leases file",
        "group_name": "network - dhcp",
        "type": "string",
    },
    "BACKUP_PATH": {
        "value": settings.BACKUP_PATH,
        "description": "Directory path for storing backups",
        "group_name": "backup",
        "type": "string",
    },
    "LOGIN_MAX_ATTEMPTS": {
        "value": settings.LOGIN_MAX_ATTEMPTS,
        "description": "Maximum failed login attempts",
        "group_name": "security",
        "type": "integer",
        "min": 1,
        "max": 10
    },
    "LOGIN_WINDOW_SECONDS": {
        "value": settings.LOGIN_WINDOW_SECONDS,
        "description": "Time window for counting failed login attempts (seconds)",
        "group_name": "security",
        "type": "integer",
        "min": 60,
        "max": 3600,
    },
    "PING_WORKERS": {
        "value": settings.PING_WORKERS,
        "description": "Number of ping worker threads",
        "group_name": "system",
        "type": "integer",
        "min": 1,
        "max": 100,
    },
}

# ---------------------------------------------------------
# Runtime cache to avoid repeated DB queries
# ---------------------------------------------------------
_config_cache = {}

# ---------------------------------------------------------
# Internal: error response helper
# ---------------------------------------------------------
def _error(msg, code="CONFIG_UPDATE_ERROR", json_format=False):
    if json_format:
        return {
            "code": code,
            "status": "failure",
            "message": msg,
        }
    return False

# ---------------------------------------------------------
# Internal: expand config data with metadata and type casting
# ---------------------------------------------------------
def _expand_config_data(key, data: dict) -> dict:

    cfg_default = CONFIG_DEFAULTS.get(key, {})
    type_name = cfg_default.get("type", "string")
    caster = TYPE_CASTERS.get(type_name, str)

    # -------------------------
    # Type casting
    # -------------------------
    try:
        data["value"] = caster(data["value"])
    except Exception as e:
        logger.warning(f"Config cast failed for {key}: {data['value']} ({e})")

    # -------------------------
    # Default value
    # -------------------------
    default = cfg_default.get("value")
    data["default_value"] = default

    # -------------------------
    # is_default flag
    # -------------------------
    try:
        casted_default = caster(default)
    except Exception:
        casted_default = default
    data["is_default"] = (data.get("value") == casted_default)

    # -------------------------
    # Optional metadata
    # -------------------------
    if cfg_default.get("min") is not None:
        data["min"] = cfg_default["min"]

    if cfg_default.get("max") is not None:
        data["max"] = cfg_default["max"]

    if cfg_default.get("allowed") is not None:
        data["allowed"] = cfg_default["allowed"]

    # -------------------------
    # Type info (optional but useful)
    # -------------------------
    data["type"] = type_name

    return data

# ---------------------------------------------------------
# Clear cache
# ---------------------------------------------------------
def clear_cache(key=None):
    """Clear cached config entry (or full cache)."""
    if key:
        _config_cache.pop(key, None)
    else:
        _config_cache.clear()

# -----------------------------
# Return the list of configs
# -----------------------------
def get_configs() -> List[Dict[str, Any]]:
    conn = get_db()
    query = (
        "SELECT * FROM config"
    )
    cur = conn.execute(query)

    rows = []
    for r in cur.fetchall():
        item = dict(r)

        # Expand with metadata and type casting
        item = _expand_config_data(item["key"], item)

        rows.append(item)
    return rows

# ---------------------------------------------------------
# Return a specific config value (with cache + type casting)
# ---------------------------------------------------------
def get_config(key, json_format: bool = False):
    # Check if key is valid
    if key not in CONFIG_DEFAULTS:
        logger.warning("Invalid config key: %s", key)
        return None

    # ---- JSON format (no cache, no type casting) ----
    if json_format:
        conn = get_db()
        cur = conn.execute("SELECT * FROM config WHERE key = ?", (key,))
        row = cur.fetchone()

        if not row:
            cfg_default = CONFIG_DEFAULTS.get(key, {})
            value = cfg_default.get("value", None)
            logger.warning("Config key not found in database: %s (using default: %s)", key, value)
            data = {
                "key": key,
                "value": value,
                "description": cfg_default.get("description", None),
                "group_name": cfg_default.get("group_name", None),
                "from_default": True
            }
        else:
            data = dict(row)

        # Expand with metadata and type casting
        data = _expand_config_data(key, data)

        return data

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
    meta = CONFIG_DEFAULTS.get(key, {})
    type_name = meta.get("type", "string")
    caster = TYPE_CASTERS.get(type_name, str)
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
# Update a specific config value (with validation, cache invalidation, and optional JSON input)
# ---------------------------------------------------------
def update_config(key, value=None, reset_to_default=False, json_format=False):

    # Initialization
    meta = CONFIG_DEFAULTS.get(key, {})

    conn = get_db()

    # JSON input
    if json_format and not reset_to_default:
        if not isinstance(value, dict) or "value" not in value:
            return _error("Invalid input format, expected dict with 'value' key", json_format=json_format)
        value = value["value"]

    # Reset
    if reset_to_default:
        if key not in CONFIG_DEFAULTS:
            return _error(f"No default value for key: {key}", "CONFIG_NOT_FOUND", json_format=json_format)
        value = CONFIG_DEFAULTS[key]["value"]

    # Check Value
    if value is None:
        return _error(f"Value is None for key: {key}", json_format=json_format)

    # Type Cast
    type_name = meta.get("type", "string")
    caster = TYPE_CASTERS.get(type_name, str)
    try:
        value = caster(value)
    except Exception:
        return _error(f"Invalid type for key {key}: {value}", json_format=json_format)

    # Data Validation
    if "allowed" in meta and value not in meta["allowed"]:
        return _error(f"Value not allowed for {key}: {value}", json_format=json_format)
    if "min" in meta and value < meta["min"]:
        return _error(f"Value below minimum for {key}: {value}", json_format=json_format)
    if "max" in meta and value > meta["max"]:
        return _error(f"Value above maximum for {key}: {value}", json_format=json_format)

    try:
        cur = conn.cursor()

        # Check existence
        cur.execute("SELECT value FROM config WHERE key = ?", (key,))
        row = cur.fetchone()
        if not row:
            return _error(f"Config key not found: {key}", "CONFIG_NOT_FOUND", json_format=json_format)

        current_value = row["value"]
        str_value = str(value)

        # Skip if unchanged
        if current_value == str_value:
            if json_format:
                return {"code": "CONFIG_UNCHANGED", "status": "success"}
            else:
                return True

        # Update
        cur.execute("""
            UPDATE config
            SET value = ?, last_updated=strftime('%Y-%m-%dT%H:%M:%SZ','now')
            WHERE key = ?
        """, (str_value, key))

        conn.commit()

        # cache invalidation
        clear_cache(key)

        if json_format:
            return {"code": "CONFIG_UPDATED", "status": "success"}
        else:
            return True

    except Exception as err:
        conn.rollback()
        logger.error(f"CONFIG DB: Error updating config - {err}")
        raise

# ---------------------------------------------------------
# Create Config DB Tables
# ---------------------------------------------------------
@register_init("create_settings_table")
def init_db_config_table(cur):

    # CONFIG TABLE
    cur.execute("""
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT,
            description TEXT,
            group_name TEXT,
            last_updated TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
        );
    """)

# ---------------------------------------------------------
# Initialize Config DB Tables
# ---------------------------------------------------------
@register_init("init_settings_table", depends_on=["create_settings_table"])
def init_db_config_defaults(cur):

    # Add configuration parameters
    for key, value in CONFIG_DEFAULTS.items():
        cur.execute("""
            INSERT OR IGNORE INTO config (key, value, description, group_name, last_updated)
            VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
            """,
            (key, str(value["value"]), value["description"], value["group_name"])
        )
