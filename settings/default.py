# backend/default.py

# ---------------------------------------------------------
# Frontend
# ---------------------------------------------------------
FRONTEND_DIR = "/app/frontend"

# ---------------------------------------------------------
# Data Path (DB + Backup)
# ---------------------------------------------------------
DATA_PATH = "/data"

# ---------------------------------------------------------
# Database
# ---------------------------------------------------------
DB_FILE = "database.db"
DB_RESET = False

# ---------------------------------------------------------
# Log
# ---------------------------------------------------------
LOG_LEVEL = "INFO"
LOG_TO_FILE = False
LOG_FILE = "app.log"
LOG_ACCESS_FILE = "access.log"

# ---------------------------------------------------------
# Host
# ---------------------------------------------------------
DOMAIN = "example.com"
PUBLIC_IP = "127.0.0.1"

# ---------------------------------------------------------
# Web
# ---------------------------------------------------------
HTTP_PORT = "8000"
LOGIN_MAX_ATTEMPTS = "5"
LOGIN_WINDOW_SECONDS = "600"

# ---------------------------------------------------------
# Admin
# ---------------------------------------------------------
ADMIN_USER = "admin"
ADMIN_PASSWORD = "admin"
ADMIN_PASSWORD_HASH_FILE = "/run/secrets/admin_password_hash"

# ---------------------------------------------------------
# DNS
# ---------------------------------------------------------
DNS_HOST_FILE=f"/dns/etc/{DOMAIN}/hosts.inc"
DNS_ALIAS_FILE=f"/dns/etc/{DOMAIN}/alias.inc"
DNS_REVERSE_FILE="/dns/etc/reverse/hosts.inc"

# ---------------------------------------------------------
# DHCP
# ---------------------------------------------------------
DHCP4_HOST_FILE="/dhcp/etc/hosts-ipv4.json"
DHCP4_LEASES_FILE="/dhcp/lib/dhcp4.leases"
DHCP6_HOST_FILE="/dhcp/etc/hosts-ipv6.json"
DHCP6_LEASES_FILE="/dhcp/lib/dhcp6.leases"
