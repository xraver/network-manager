# backend/db/users.py

import json
from backend.db.db import get_db
from bcrypt import checkpw

# -----------------------------
# Get User from DB by username
# -----------------------------
def get_user_by_username(username):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE username = ?", (username,))
    return cur.fetchone()

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

# -----------------------------
# Verify Login
# -----------------------------
def verify_login(username, password):
    user = get_user_by_username(username)
    if not user:
        return False

    if user["status"] != "active":
        return False

    if not checkpw(password.encode(), user["password_hash"].encode()):
        return False

    print(f"DEBUG: Checking password for user {user['username']} with status {user['status']}: {user['password_hash']}")
    return True
