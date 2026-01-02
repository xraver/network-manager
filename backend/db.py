import sqlite3
import os
import ipaddress

DB_PATH = os.environ.get("DB_PATH", "/app/database.db")

# -----------------------------
# Connect to the database
# -----------------------------
def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=5)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn

# -----------------------------
# SELECT ALL HOSTS
# -----------------------------
def get_hosts():
    conn = get_db()
    cur = conn.execute("SELECT * FROM hosts ORDER BY name")
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# -----------------------------
# SELECT SINGLE HOST
# -----------------------------
def get_host(host_id: int):
    conn = get_db()
    cur = conn.execute("SELECT * FROM hosts WHERE id = ?", (host_id,))
    row = cur.fetchone()
    conn.close()
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
    conn.close()
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
    conn.close()
    return True

# -----------------------------
# DELETE HOST
# -----------------------------
def delete_host(host_id: int):
    conn = get_db()
    conn.execute("DELETE FROM hosts WHERE id = ?", (host_id,))
    conn.commit()
    conn.close()
    return True
