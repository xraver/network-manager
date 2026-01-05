# backend/db/hosts.py

# Import standard modules
import ipaddress
import os
# Import local modules
from backend.db.db import get_db
from backend.db.db import register_init

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
    from backend.config import DOMAIN
    from backend.config import PUBLIC_IP

    # GLOBAL SETTINGS
    cur.execute("""
        CREATE TABLE settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    """)
    cur.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("domain", DOMAIN))
    cur.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("external_ipv4", PUBLIC_IP))

    # HOSTS
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

    # ALIASES
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

    # TXT RECORDS
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

    print(f"INFO:     - HOSTS DB: Database initialized successfully for {DOMAIN}.")
    print(f"INFO:     - HOSTS DB: Public IP: {PUBLIC_IP}.")
