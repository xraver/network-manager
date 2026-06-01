# backend/db/users.py

# Import standard modules
import bcrypt
import json

# Import local modules
from backend.db.db import get_db, register_init

# Import Settings
from backend.settings.settings import settings
# Import Logging
from backend.log.log import get_logger

# Logger initialization
logger = get_logger(__name__)

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
    row = cur.fetchone()
    return dict(row) if row else None

# -----------------------------
# Create User
# -----------------------------
def create_user(username, password_hash, email=None, is_admin=0, modules=None):
    conn = get_db()
    cur = conn.cursor()

    try:
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
        return cur.lastrowid
    except Exception as err:
        conn.rollback()
        logger.error(f"USERS DB: Error creating user - {err}")
        raise

# -----------------------------
# Create Users Table
# -----------------------------
@register_init("create_users_table")
def init_db_users_table(cur):

    # USERS TABLE
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
            description TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);")

# -----------------------------
# Populate Users Tables
# -----------------------------
@register_init("init_users_table", depends_on=["create_users_table"])
def init_db_users_defaults(cur):
    # Insert default admin user
    if settings.ADMIN_PASSWORD_HASH:
        password_hash = settings.ADMIN_PASSWORD_HASH
    else:
        password_hash = hash_password(settings.ADMIN_PASSWORD)
    cur.execute("""
        INSERT or IGNORE INTO users (
            username, password_hash, email, is_admin, modules, status,
            created_at, updated_at, password_changed_at
        ) VALUES (?, ?, ?, ?, ?, ?, strftime('%s','now'), strftime('%s','now'), strftime('%s','now'));
    """, (
        settings.ADMIN_USER,
        password_hash,
        "admin@example.com",
        1,
        json.dumps(["dns", "dhcp"]),
        "active"
    ))
