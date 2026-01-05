# backend/config.py

# Import standard modules
import os
import secrets
# Import local modules
from backend.utils import load_hash

# Database related settings
DB_FILE = os.environ.get("DB_FILE", "/data/database.db")
DB_RESET = os.environ.get("DB_RESET", "0") == "1"

# Hosts related settings
DOMAIN = os.environ.get("DOMAIN", "example.com")
PUBLIC_IP = os.environ.get("PUBLIC_IP", "127.0.0.1")

# Web server related settings
SECRET_KEY = os.getenv("SESSION_SECRET", secrets.token_urlsafe(64))
HTTP_PORT = os.getenv("HTTP_PORT", "8000")
LOGIN_MAX_ATTEMPTS = int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"))
LOGIN_WINDOW_SECONDS = int(os.getenv("LOGIN_WINDOW_SECONDS", "600"))

# User related settings
ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")
ADMIN_HASH = os.environ.get("ADMIN_HASH", "")
if not ADMIN_HASH:
  ADMIN_HASH = load_hash("ADMIN_HASH_FILE")
