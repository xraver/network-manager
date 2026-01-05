#!/usr/local/bin/python3

import os
import sys
import sqlite3
import subprocess

# ================================
# Variables
# ================================
DB_FILE = os.environ.get("DB_PATH", "database.db")
DB_RESET = os.environ.get("DB_RESET", "0") == "1"
DOMAIN = os.environ.get("DOMAIN", "example.com")
PUBLIC_IP = os.environ.get("PUBLIC_IP", "127.0.0.1")

IMAGE_NAME = "network-manager-distroless"
IMAGE_VERSION = "1.0"

# ================================
# Create DB if needed
# ================================
def create_db():
    # Reset database if requested
    if DB_RESET and os.path.exists(DB_FILE):
        print("INFO:     Removing existing database...")
        os.remove(DB_FILE)

    # Skip creation if DB already exists
    if os.path.exists(DB_FILE):
        print("INFO:     Database already exists. Nothing to do.")
        return

    print(f"INFO:     Creating database: {DB_FILE}.")

    # Ensure directory exists
    os.makedirs(os.path.dirname(DB_FILE) or ".", exist_ok=True)

    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()

    # Enable foreign keys
    cur.execute("PRAGMA foreign_keys = ON;")

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

    conn.commit()
    conn.close()

    print(f"INFO:     Database initialized successfully for {DOMAIN}.")
    print(f"INFO:     Public IP: {PUBLIC_IP}.")

# ================================
# Entry Point
# ================================

# Force flush
sys.stdout.reconfigure(line_buffering=True)

print(f"INFO:     Starting {IMAGE_NAME} docker image version {IMAGE_VERSION}.")


# Parse arguments
args = sys.argv[1:]
i = 0
while i < len(args):
    if args[i] == "--reset":
        DB_RESET = True
        i += 1
    elif args[i] == "--domain" and i + 1 < len(args):
        DOMAIN = args[i + 1]
        i += 2
    elif args[i] == "--public-ip" and i + 1 < len(args):
        PUBLIC_IP = args[i + 1]
        i += 2
    elif args[i] == "--":
        args = args[i + 1:]
        break
    else:
        break

# Create DB
create_db()

# Continue to CMD
if not args:
    print("ERROR:      No command provided to exec.")
    sys.exit(1)

os.execvp(args[0], args)
