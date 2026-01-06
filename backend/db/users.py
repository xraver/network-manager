# backend/db/users.py

# Import standard modules
import json
import os
# Import local modules
from backend.db.db import get_db, register_init

# ================================
# Create hash password
# ================================
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode(), salt)
    return hashed.decode()

# -----------------------------
# Get User from DB by username
# -----------------------------
def get_user_by_username(username):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE username = ?", (username,))
    return cur.fetchone()

# -----------------------------
# Create Users Table
# -----------------------------
@register_init
def init_db_users_table(cur):
    from backend.config import ADMIN_USER
    from backend.config import ADMIN_PASSWORD
    from backend.config import ADMIN_HASH

    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT UNIQUE,
            is_admin INTEGER NOT NULL DEFAULT 0,
            modules TEXT, -- JSON: ["dns","dhcp","vpn"]
            status TEXT NOT NULL DEFAULT 'active', -- active, disabled, locked
            failed_attempts INTEGER NOT NULL DEFAULT 0,
            last_failed_at INTEGER,
            last_login_at INTEGER,
            password_changed_at INTEGER,
            notes TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
    """)
    cur.execute("CREATE INDEX idx_users_username ON users(username);")
    # Insert default admin user
    if not ADMIN_HASH:
        ADMIN_HASH = hash_password(ADMIN_PASSWORD)
    else:
        ADMIN_PASSWORD = "(hidden)"
    cur.execute("""
        INSERT INTO users (
            username, password_hash, email, is_admin, modules, status,
            created_at, updated_at, password_changed_at
        ) VALUES (?, ?, ?, ?, ?, ?, strftime('%s','now'), strftime('%s','now'), strftime('%s','now'));
    """, (
        ADMIN_USER,
        ADMIN_HASH,
        "admin@example.com",
        1,
        '["dns","dhcp"]',
        "active"
    ))

    print(f"INFO:     - USERS DB: Admin user: {ADMIN_USER} with password {ADMIN_PASSWORD} - {ADMIN_HASH}.")

# -----------------------------
# Create User
# -----------------------------
def create_user(username, password_hash, email=None, is_admin=0, modules=None):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO users (
            username, password_hash, email, is_admin, modules, status,
            created_at, updated_at, password_changed_at
        ) VALUES (?, ?, ?, ?, ?, 'active', strftime('%s','now'), strftime('%s','now'), strftime('%s','now'));
    """, (
        username,
        password_hash,
        email,
        is_admin,
        json.dumps(modules or [])
    ))

    conn.commit()
