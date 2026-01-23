# log/log.py

from __future__ import annotations

import logging
import logging.config
import os
from typing import Optional

# Module-level flag to prevent re-initialization
_INITIALIZED = False

# ---------------------------------------------------------
# Build a full dictConfig for logging
# ---------------------------------------------------------
def build_log_config(level: str = "INFO", to_file: bool = False, log_file: Optional[str] = None, log_access_file: Optional[str] = None,) -> dict:
    """
    Returns a complete dictConfig for the logging system, including formatters,
    console/file handlers, and specific loggers (uvicorn, fastapi, etc).
    """
    level = (level or "INFO").upper()

    formatters = {
        # Generic Formatter
        "detailed": {
            "format": "%(asctime)s %(levelname)s [%(name)s] %(message)s",
            "datefmt": "%Y-%m-%dT%H:%M:%S%z",
        },
        # Access log Formatter
        "access": {
            "()": "uvicorn.logging.AccessFormatter",
            "fmt": '%(asctime)s %(levelname)s [%(name)s] %(client_addr)s - "%(request_line)s" %(status_code)s',
            "datefmt": "%Y-%m-%dT%H:%M:%S%z",
        },
    }

    handlers = {
        # Generic Console (root/uvicorn/uvicorn.error/fastapi/app)
        "console": {
            "class": "logging.StreamHandler",
            "level": level,
            "formatter": "detailed",
            "stream": "ext://sys.stdout",
        },
        # Access log Console
        "access_console": {
            "class": "logging.StreamHandler",
            "level": level,
            "formatter": "access",
            "stream": "ext://sys.stdout",
        },
    }

    # Select active handler based on console
    active_handlers = ["console"]
    access_handlers = ["access_console"]

    if to_file:
        if log_file is not None:
            # Ensure the log directory exists and add a rotating file handler
            log_dir = os.path.dirname(log_file) or "."
            os.makedirs(log_dir, exist_ok=True)
            # handler for generic log
            handlers["file"] = {
                "class": "logging.handlers.RotatingFileHandler",
                "level": level,
                "formatter": "detailed",
                "filename": log_file,
                "maxBytes": 5 * 1024 * 1024,
                "backupCount": 5,
                "encoding": "utf-8",
            }
            # Add active handler for generic log file
            active_handlers.append("file")
        if log_access_file is not None:
            # Ensure the log directory exists and add a rotating file handler
            log_dir = os.path.dirname(log_access_file) or "."
            os.makedirs(log_dir, exist_ok=True)
            # handler for access log
            handlers["access_file"] = {
                "class": "logging.handlers.RotatingFileHandler",
                "level": level,
                "formatter": "access",
                "filename": log_access_file,
                "maxBytes": 5 * 1024 * 1024,
                "backupCount": 5,
                "encoding": "utf-8",
            }
            # Add active handler for access log file
            access_handlers.append("access_file")

    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": formatters,
        "handlers": handlers,

        # Root logger
        "root": {
            "level": level,
            "handlers": active_handlers,
        },
        # Modules
        "loggers": {
            # Uvicorn core
            "uvicorn": {
                "level": level,
                "handlers": active_handlers,
                "propagate": False,
            },
            # Uvicorn internal error
            "uvicorn.error": {
                "level": level,
                "handlers": active_handlers,
                "propagate": False,
            },
            # Uvicorn access log
            "uvicorn.access": {
                "level": level,
                "handlers": access_handlers,
                "propagate": False,
            },
            # FastAPI
            "fastapi": {
                "level": level,
                "handlers": active_handlers,
                "propagate": False,
            },
            # Logger applicativo di comodo (puoi usarlo come logging.getLogger("main"))
            "main": {
                "level": level,
                "handlers": active_handlers,
                "propagate": False,
            },
        },
    }

# ---------------------------------------------------------
# Initialize logging once (singleton guard)
# ---------------------------------------------------------
def setup_logging(level: str = "INFO", to_file: bool = False, log_file: Optional[str] = None, log_access_file: Optional[str] = None, *, force: bool = False) -> None:
    """
    Initializes the logging system only once. Subsequent calls are no-ops.
    Useful to prevent duplicated handlers or reconfiguration side effects.
    """
    global _INITIALIZED

    if _INITIALIZED and not force:
        return

    config = build_log_config(level=level, to_file=to_file, log_file=log_file, log_access_file=log_access_file)
    logging.config.dictConfig(config)

    logging.getLogger("main").info(
        "Logging configured (level=%s, to_file=%s, log_file=%s, log_access_file=%s)",
        level.upper(), to_file, log_file, log_access_file
    )

    _INITIALIZED = True

# ---------------------------------------------------------
# Get a configured logger for the given module/name
# ---------------------------------------------------------
def get_logger(name: str | None = None) -> logging.Logger:
    """
    Returns a logger instance configured via the module setup. If setup was not
    called yet, it falls back to the standard logging defaults.
    """
    return logging.getLogger(name or "main")
