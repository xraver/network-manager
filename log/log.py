# log/log.py

import logging
import logging.config
import os
import sys

# Module-level flag to prevent re-initialization
_INITIALIZED = False

# ---------------------------------------------------------
# Build a full dictConfig for logging
# ---------------------------------------------------------
def build_log_config(level: str = "INFO", to_file: bool = False, file: str | None = None) -> dict:
    """
    Returns a complete dictConfig for the logging system, including formatters,
    console/file handlers, and specific loggers (uvicorn, fastapi, etc).
    """
    level = (level or "INFO").upper()

    formatters = {
        "detailed": {
            "format": "%(asctime)s %(levelname)s [%(name)s] %(message)s",
            "datefmt": "%Y-%m-%dT%H:%M:%S%z",
        },
        "access": {
            "format": '%(asctime)s %(levelname)s [%(name)s] '
                      '%(client_addr)s - "%(request_line)s" %(status_code)s',
            "datefmt": "%Y-%m-%dT%H:%M:%S%z",
        },
    }

    handlers = {
        "console": {
            "class": "logging.StreamHandler",
            "level": level,
            "formatter": "detailed",
            "stream": "ext://sys.stdout",
        }
    }

    # Select active handler based on console
    active_handlers = ["console"]

    if to_file:
        if file is not None:
            # Ensure the log directory exists and add a rotating file handler
            log_dir = os.path.dirname(file) or "."
            os.makedirs(log_dir, exist_ok=True)
            handlers["file"] = {
                "class": "logging.handlers.RotatingFileHandler",
                "level": level,
                "formatter": "detailed",
                "filename": file,
                "maxBytes": 5 * 1024 * 1024,
                "backupCount": 5,
                "encoding": "utf-8",
            }
            # Add active handler based on file
            active_handlers.append("file")

    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": formatters,
        "handlers": handlers,
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
            # Uvicorn HTTP access
            "uvicorn.access": {
                "level": level,
                "handlers": active_handlers,
                "propagate": False,
            },
            # FastAPI
            "fastapi": {
                "level": level,
                "handlers": active_handlers,
                "propagate": False,
            },
        },
    }

# ---------------------------------------------------------
# Initialize logging once (singleton guard)
# ---------------------------------------------------------
def setup_logging(level: str = "INFO", to_file: bool = False, file: str | None = None) -> None:
    """
    Initializes the logging system only once. Subsequent calls are no-ops.
    Useful to prevent duplicated handlers or reconfiguration side effects.
    """
    global _INITIALIZED

    if _INITIALIZED:
        return

    config = build_log_config(level=level, to_file=to_file, file=file)
    logging.config.dictConfig(config)

    logging.getLogger(__name__).info(
        "Logging configured (level=%s, to_file=%s, file=%s)",
        level.upper(), to_file, file
    )

    _INITIALIZED = True

# ---------------------------------------------------------
# Get a configured logger for the given module/name
# ---------------------------------------------------------
def get_logger(name: str = None) -> logging.Logger:
    """
    Returns a logger instance configured via the module setup. If setup was not
    called yet, it falls back to the standard logging defaults.
    """
    if not name:
        name = __name__
    return logging.getLogger(name)
