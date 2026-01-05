# backend/db/hosts.py

import ipaddress
import os
from backend.db.db import get_db

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
