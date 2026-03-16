# backend/db/hosts.py

# Import standard modules
import ipaddress
import re
import sqlite3
from typing import Any, Dict, List, Optional

# Import local modules
from backend.db.db import get_db, register_init

# Import Logging
from backend.log.log import get_logger

# Logger initialization
logger = get_logger(__name__)

# Regex for MAC check
MAC_RE = re.compile(r"^([0-9A-Fa-f]{2}([:\-])){5}([0-9A-Fa-f]{2})$")

# -----------------------------
# Check Data Input
# -----------------------------
def validate_data(data: Dict[str, Any]) -> Dict[str, Any]:
    # Check name
    if "name" not in data:
        raise ValueError("Missing required field: name")
    name = str(data["name"]).strip()
    if not name:
        raise ValueError("Field 'name' cannot be empty")

    # Check IPv4
    ipv4 = data.get("ipv4")
    if ipv4:
        try:
            ipaddress.IPv4Address(ipv4)
        except ValueError:
            raise ValueError(f"Invalid IPv4 address: {ipv4}")

    # Check IPv6
    ipv6 = data.get("ipv6")
    if ipv6:
        try:
            ipaddress.IPv6Address(ipv6)
        except ValueError:
            raise ValueError(f"Invalid IPv6 address: {ipv6}")

    # Check MAC
    mac = data.get("mac")
    if mac and not MAC_RE.match(mac):
        raise ValueError(f"Invalid MAC address: {mac}")

    # Check note
    note = data.get("note")

    # Normalizzazione boolean per DB (0/1)
    ssl_enabled = int(bool(data.get("ssl_enabled", 0)))

    # Normalizzazione (0/1/2)
    v = int(data.get("visibility", 0))
    visibility = v if v in (0, 1, 2) else 0

    return {
        "name": name,
        "ipv4": ipv4,
        "ipv6": ipv6,
        "mac": mac,
        "note": note,
        "ssl_enabled": ssl_enabled,
        "visibility": visibility,
    }

# -----------------------------
# Sorting hosts
# -----------------------------
def ipv4_sort_key(h: Dict[str, Any]):
    v = (h.get("ipv4") or "").strip()
    if not v:
        # no ip at the end
        return (1, 0)
    try:
        return (0, int(ipaddress.IPv4Address(v)))
    except ValueError:
        return (0, float("inf"))

# -----------------------------
# SELECT ALL HOSTS
# -----------------------------
def get_hosts() -> List[Dict[str, Any]]:
    conn = get_db()
    cur = conn.execute("SELECT * FROM hosts")
    rows = [dict(r) for r in cur.fetchall()]
    rows.sort(key=ipv4_sort_key)
    return rows

# -----------------------------
# SELECT SINGLE HOST
# -----------------------------
def get_host(host_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db()
    cur = conn.execute("SELECT * FROM hosts WHERE id = ?", (host_id,))
    row = cur.fetchone()
    return dict(row) if row else None

# -----------------------------
# ADD HOST
# -----------------------------
def add_host(data: Dict[str, Any]) -> int:

    # Validate input
    cleaned = validate_data(data)

    conn = get_db()
    try:
        cur = conn.execute(
           """
           INSERT INTO hosts (name, ipv4, ipv6, mac, note, ssl_enabled, visibility)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           """,
            (
                cleaned["name"],
                cleaned["ipv4"],
                cleaned["ipv6"],
                cleaned["mac"],
                cleaned["note"],
                cleaned["ssl_enabled"],
                cleaned["visibility"],
            ),
        )
        conn.commit()
        return cur.lastrowid

    except sqlite3.IntegrityError:
        conn.rollback()
        return -1

    except Exception as err:
        conn.rollback()
        logger.error(f"HOSTS DB: Error adding host - {err}")
        raise

# -----------------------------
# UPDATE HOST
# -----------------------------
def update_host(host_id: int, data: Dict[str, Any]) -> bool:

    # Validate input
    cleaned = validate_data(data)

    conn = get_db()
    try:
        cur = conn.execute(
            """
            UPDATE hosts
            SET name=?, ipv4=?, ipv6=?, mac=?, note=?, ssl_enabled=?, visibility=?, last_updated=CURRENT_TIMESTAMP
            WHERE id=?
            """,
            (
                cleaned["name"],
                cleaned["ipv4"],
                cleaned["ipv6"],
                cleaned["mac"],
                cleaned["note"],
                cleaned["ssl_enabled"],
                cleaned["visibility"],
                host_id,
            ),
        )
        conn.commit()
        return cur.rowcount > 0

    except Exception as err:
        conn.rollback()
        logger.error(f"HOSTS DB: Error updating host - {err}")
        raise

# -----------------------------
# DELETE HOST
# -----------------------------
def delete_host(host_id: int) -> bool:

    # Validate input
    if host_id is None:
        raise ValueError("host_id cannot be None")

    conn = get_db()
    try:
        cur = conn.execute("DELETE FROM hosts WHERE id = ?", (host_id,))
        conn.commit()
        return cur.rowcount > 0

    except Exception as err:
        conn.rollback()
        logger.error(f"HOSTS DB: Error deleting host - {err}")
        raise

# -----------------------------
# Initialize Hosts DB Table
# -----------------------------
@register_init
def init_db_hosts_table(cur: sqlite3.Cursor) -> None:

    # HOSTS TABLE
    cur.execute(
        """
        CREATE TABLE hosts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            ipv4 TEXT,
            ipv6 TEXT,
            mac TEXT,
            note TEXT,
            ssl_enabled INTEGER NOT NULL DEFAULT 0,
            visibility INTEGER NOT NULL DEFAULT 0,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    cur.execute("CREATE INDEX idx_hosts_name ON hosts(name);")

    # TXT TABLE
    cur.execute(
        """
        CREATE TABLE txt_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            value TEXT NOT NULL,
            note TEXT,
            host_id INTEGER,
            FOREIGN KEY (host_id) REFERENCES hosts(id)
        );
        """
    )
    cur.execute("CREATE INDEX idx_txt_host ON txt_records(host_id);")

    logger.info("HOSTS DB: Tables initialized successfully")

# -----------------------------
# Reset Hosts DB Table
# -----------------------------
def reset_hosts_db() -> None:
    conn = get_db()
    try:
        conn.execute("DELETE FROM hosts;")
        conn.execute("DELETE FROM sqlite_sequence WHERE name='hosts';")
        conn.commit()

    except Exception as err:
        conn.rollback()
        logger.error(f"HOSTS DB: Error resetting tables - {err}")
        raise
