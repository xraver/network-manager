#!/usr/local/bin/python3

# Import standard modules
import logging
import os
import sys
import argparse
# Import local modules
from backend.db.db import init_db
import backend.db.users
import backend.db.hosts
import backend.db.aliases
# Import Settings
from settings.settings import settings
# Import Log
from log.log import setup_logging, get_logger

# ================================
# Parse CLI arguments
# ================================
def parse_args():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--reset", action="store_true")
    parser.add_argument("--domain")
    parser.add_argument("--public-ip")
    parser.add_argument("cmd", nargs=argparse.REMAINDER)
    return parser.parse_args()

# ================================
# Create DB if needed
# ================================
def docker_create_db(logger):
    # Reset database if requested
    if settings.DB_RESET and os.path.exists(settings.DB_FILE):
        logger.info("Removing existing database: %s", settings.DB_FILE)
        os.remove(settings.DB_FILE)

    # Skip creation if DB already exists
    if os.path.exists(settings.DB_FILE):
        logger.info("Database already exists. Nothing to do.")
        return

    logger.info("Creating database: %s", settings.DB_FILE)

    # Ensure directory exists
    os.makedirs(os.path.dirname(settings.DB_FILE) or ".", exist_ok=True)

    # Initialize DB tables
    init_db()

# ================================
# Entry Point
# ================================
def main():
    # Enable logging
    setup_logging()
    logger = get_logger("baseimg")

    # Log startup docker image
    logger.info("Starting docker image %s version %s", settings.BASEIMG_NAME, settings.BASEIMG_VERSION)

    # Parse arguments
    args = parse_args()

    # Apply arguments into settings
    if args.reset:
        settings.DB_RESET = True
    if args.domain:
        settings.DOMAIN = args.domain
    if args.public_ip:
        settings.PUBLIC_IP = args.public_ip

    # Create or update database
    docker_create_db(logger)

    # If no command provided -> error
    if not args.cmd:
        logger.error("No command provided. Exiting.")
        sys.exit(1)

    cmd = args.cmd[0]
    rest = args.cmd[1:]

    logger.info("Docker image initialization completed — executing: %s %s", cmd, " ".join(rest))

    try:
        os.execvp(cmd, [cmd, *rest])
    except FileNotFoundError:
        logger.critical("Command not found: %s", cmd)
        sys.exit(1)

if __name__ == "__main__":
    main()
