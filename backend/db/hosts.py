# backend/db/hosts.py

# Import standard modules
import ipaddress
import logging
import os
# Import local modules
from backend.db.db import get_db, register_init
# Import Settings
from settings.settings import settings
# Import Log
from log.log import get_logger

# -----------------------------
# SELECT ALL HOSTS
# -----------------------------
def get_hosts():
    conn = get_db()
    cur = conn.execute("SELECT * FROM hosts ORDER BY name")
    rows = cur.fetchall()
    return [dict(r) for r in rows]

# -----------------------------
# SELECT SINGLE HOST
# -----------------------------
def get_host(host_id: int):
    conn = get_db()
    cur = conn.execute("SELECT * FROM hosts WHERE id = ?", (host_id,))
    row = cur.fetchone()
    return dict(row) if row else None

# -----------------------------
# INSERT HOST
# -----------------------------
def add_host(data: dict):
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO hosts (name, ipv4, ipv6, mac, note, ssl_enabled) VALUES (?, ?, ?, ?, ?, ?)",
        (
            data["name"],
            data.get("ipv4"),
            data.get("ipv6"),
            data.get("mac"),
            data.get("note"),
            data.get("ssl_enabled", 0)
        )
    )
    conn.commit()
    last_id = cur.lastrowid
    return last_id

# -----------------------------
# UPDATE HOST
# -----------------------------
def update_host(host_id: int, data: dict):
    conn = get_db()
    conn.execute(
        "UPDATE hosts SET name=?, ipv4=?, ipv6=?, mac=?, note=?, ssl_enabled=? WHERE id=?",
        (
            data["name"],
            data.get("ipv4"),
            data.get("ipv6"),
            data.get("mac"),
            data.get("note"),
            data.get("ssl_enabled", 0),
            host_id
        )
    )
    conn.commit()
    return True

# -----------------------------
# DELETE HOST
# -----------------------------
def delete_host(host_id: int):
    conn = get_db()
    conn.execute("DELETE FROM hosts WHERE id = ?", (host_id,))
    conn.commit()
    return True

# -----------------------------
# Initialize Hosts DB Table
# -----------------------------
@register_init
def init_db_hosts_table(cur):
    logger = get_logger(__name__)

    # SETTINGS TABLE
    cur.execute("""
        CREATE TABLE settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    """)
    cur.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("domain", settings.DOMAIN))
    cur.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("external_ipv4", settings.PUBLIC_IP))

    # HOSTS TABLE
    cur.execute("""
        CREATE TABLE hosts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            ipv4 TEXT,
            ipv6 TEXT,
            mac TEXT,
            note TEXT,
            ssl_enabled INTEGER NOT NULL DEFAULT 0
        );
    """)
    cur.execute("CREATE INDEX idx_hosts_name ON hosts(name);")

    # ALIASES TABLE
    cur.execute("""
        CREATE TABLE aliases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            host_id INTEGER NOT NULL,
            alias TEXT NOT NULL,
            note TEXT,
            ssl_enabled INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (host_id) REFERENCES hosts(id)
        );
    """)
    cur.execute("CREATE INDEX idx_aliases_host ON aliases(host_id);")

    # TXT TABLE
    cur.execute("""
        CREATE TABLE txt_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            value TEXT NOT NULL,
            note TEXT,
            host_id INTEGER,
            FOREIGN KEY (host_id) REFERENCES hosts(id)
        );
    """)
    cur.execute("CREATE INDEX idx_txt_host ON txt_records(host_id);")

    logger.info("HOSTS DB: Database initialized successfully for %s", settings.DOMAIN)
    logger.info("HOSTS DB: Public IP: %s", settings.PUBLIC_IP)
