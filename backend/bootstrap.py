# backend/bootstrap.py

# Import standard modules
import logging

# Import backend modules
from backend.db.db import configure_db, create_db
import backend.db.config
import backend.db.users
import backend.db.hosts
import backend.db.aliases

# Import Settings & Config
from backend.settings.settings import settings
from backend.db.config import get_config
# Import Logging
from backend.log.log import setup_logging, get_logger

# ------------------------------------------------------------------------------
# Welcome log
# ------------------------------------------------------------------------------
def print_welcome(logger):
    masked_secret = "****" if settings.SECRET_KEY else "undefined"
    masked_admin_pwd = "****" if settings.ADMIN_PASSWORD else "undefined"
    masked_admin_hash = "****" if settings.ADMIN_PASSWORD_HASH else "undefined"

    logger.info(
        "%s starting | app_version=%s",
        settings.APP_NAME, settings.APP_VERSION
    )
    logger.info(
        "App settings: frontend=%s | host=%s | port=%d | secret=%s",
        str(settings.FRONTEND_PATH), settings.HTTP_HOST, settings.HTTP_PORT, masked_secret
    )
    logger.info(
        "Database: file=%s | reset=%s",
        str(settings.DB_FILE), settings.DB_RESET
    )
    logger.info(
        "Log: level=%s, to_file=%s, file=%s",
        get_config("LOG_LEVEL"), get_config("LOG_TO_FILE"), str(settings.LOG_FILE)
    )
    logger.info(
        "Users: admin=%s | password=%s | hash=%s | hash_file=%s",
        settings.ADMIN_USER, masked_admin_pwd, masked_admin_hash, str(settings.ADMIN_PASSWORD_HASH_FILE)
    )
    logger.info(
        "DNS: host file=%s | alias file=%s | reverse file=%s",
        settings.DNS_HOST_FILE, settings.DNS_ALIAS_FILE, settings.DNS_REVERSE_FILE
    )
    logger.info(
        "DHCP: ipv4 host file=%s | ipv4 leases file=%s | ipv6 host file=%s | ipv6 leases file=%s",
        settings.DHCP4_HOST_FILE, settings.DHCP4_LEASES_FILE, settings.DHCP6_HOST_FILE, settings.DHCP6_LEASES_FILE
    )
    logger.info(
        "Backup: path=%s",
        str(settings.BACKUP_PATH)
    )
    logger.info(
        "App features: ping_workers=%d",
        get_config("PING_WORKERS")
    )

# ------------------------------------------------------------------------------
# Shutdown log
# ------------------------------------------------------------------------------
def print_goodbye(logger):
    logger.info(
        "Application %s shutting down | app_version=%s",
        settings.APP_NAME, settings.APP_VERSION
    )

# ------------------------------------------------------------------------------
# Bootstrap: setup logging, print welcome, create DB, etc.
# ------------------------------------------------------------------------------
def bootstrap():
    # Set Database
    configure_db(settings.DB_FILE)
    # Create or update database
    created = create_db(settings.DB_FILE, settings.DB_RESET)

    # Log Setup
    setup_logging(
        level=get_config("LOG_LEVEL"),
        to_file=get_config("LOG_TO_FILE"),
        log_file=settings.LOG_FILE,
        log_access_file=settings.LOG_ACCESS_FILE
    )

    logger = get_logger(__name__)

    print_welcome(logger)

    if created:
        logger.info("Database created: %s", settings.DB_FILE)
    else:
        logger.info("Database already exists. Nothing to do.")
