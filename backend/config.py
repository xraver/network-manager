# backend/config.py

# Import standard modules
import os
import secrets
# Import local modules
from backend.utils import load_hash

# Frontend related settings
FRONTEND_DIR = "/app/frontend"

# Database related settings
DB_FILE = os.getenv("DB_FILE", "/data/database.db")
DB_RESET = os.getenv("DB_RESET", "0") == "1"

# Hosts related settings
DOMAIN = os.getenv("DOMAIN", "example.com")
PUBLIC_IP = os.getenv("PUBLIC_IP", "127.0.0.1")

# Web server related settings
HTTP_PORT = os.getenv("HTTP_PORT", "8000")
SECRET_KEY = os.getenv("SESSION_SECRET")
if not SECRET_KEY:
    SECRET_KEY = load_hash("SECRET_KEY_FILE") or secrets.token_urlsafe(64)
LOGIN_MAX_ATTEMPTS = int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"))
LOGIN_WINDOW_SECONDS = int(os.getenv("LOGIN_WINDOW_SECONDS", "600"))

# User related settings
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")
ADMIN_HASH = os.getenv("ADMIN_HASH") or load_hash("ADMIN_HASH_FILE")
