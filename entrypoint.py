#!/usr/local/bin/python3

# Import standard modules
import os
import sys
# Import local modules
from backend.db.db import init_db
import backend.db.hosts
import backend.db.users

# ================================
# Variables
# ================================
BASEIMG_NAME = "network-manager-distroless"
BASEIMG_VERSION = "0.2"

from backend.config import DB_FILE
from backend.config import DB_RESET

# ================================
# Create DB if needed
# ================================
def docker_create_db():
    # Reset database if requested
    if DB_RESET and os.path.exists(DB_FILE):
        print("INFO:     Removing existing database.")
        os.remove(DB_FILE)

    # Skip creation if DB already exists
    if os.path.exists(DB_FILE):
        print("INFO:     Database already exists. Nothing to do.")
        return

    print(f"INFO:     Creating database: {DB_FILE}.")

    # Ensure directory exists
    os.makedirs(os.path.dirname(DB_FILE) or ".", exist_ok=True)

    # Initialize all registered DB tables
    init_db()

# ================================
# Entry Point
# ================================

# Force flush
sys.stdout.reconfigure(line_buffering=True)

print(f"INFO:     Starting {BASEIMG_NAME} docker image version {BASEIMG_VERSION}.")
os.environ["BASEIMG_NAME"] = BASEIMG_NAME
os.environ["BASEIMG_VERSION"] = BASEIMG_VERSION

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
docker_create_db()

# Continue to CMD
if not args:
    print("ERROR:      No command provided to exec.")
    sys.exit(1)

os.execvp(args[0], args)
