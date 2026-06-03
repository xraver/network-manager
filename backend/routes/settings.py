# backend/routes/settings.py

# import standard modules
from fastapi import APIRouter, Request, Response, HTTPException, status
from fastapi.responses import FileResponse
import ipaddress
import time

# Import local modules
from backend.db.settings import (
    get_configs,
    get_config,
    update_config,
)

# Import Settings
from backend.settings.settings import settings
# Import Logging
from backend.log.log import get_logger

# Logger initialization
logger = get_logger(__name__)

# Create Router
router = APIRouter()

# ---------------------------------------------------------
# FRONTEND PATHS (absolute paths inside Docker)
# ---------------------------------------------------------
# Settings page
@router.get("/settings")
def settings_page(request: Request):
    return FileResponse(settings.FRONTEND_PATH / "settings.html")

# Serve settings.js
@router.get("/js/settings.js")
def settings_js():
    return FileResponse(settings.FRONTEND_PATH / "js/settings.js")

# ---------------------------------------------------------
# Get Settings
# ---------------------------------------------------------
@router.get("/api/settings", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Settings found"},
    500: {"description": "Internal server error"},
})
def api_get_configs(request: Request):

    try:
        configs = get_configs()
        return configs or []

    except HTTPException:
        raise

    except Exception as err:
        logger.exception("Error getting list of the configuration parameters %s", str(err).strip())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "CONFIGS_GET_ERROR",
                "status": "failure",
                "message": "Internal error getting list of the configuration parameters",
            },
        )

# ---------------------------------------------------------
# Get a configuration parameter
# ---------------------------------------------------------
@router.get("/api/settings/{config_key}", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Configuration parameter found"},
    404: {"description": "Configuration parameter not found"},
    500: {"description": "Internal server error"},
})
def api_get_setting(request: Request, config_key: str):

    # Inizializzazioni
    start_ns = time.monotonic_ns()

    try:
        config = get_config(config_key, json_format=True)
        if not config:  # None or empty dict
            took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "CONFIG_NOT_FOUND",
                    "status": "failure",
                    "message": "Configuration parameter not found",
                    "details": {
                        "config_key": config_key,
                        "took_ms": took_ms,
                    },
                },
            )
        return config

    except HTTPException:
        raise

    except Exception as err:
        logger.exception("Error getting configuration parameter %s: %s", config_key, str(err).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "CONFIG_GET_ERROR",
                "status": "failure",
                "message": "Internal error getting configuration parameter",
                "details": {
                    "config_key": config_key,
                    "took_ms": took_ms,
                },
            },
        )

# ---------------------------------------------------------
# Update config
# ---------------------------------------------------------
@router.put("/api/settings/{config_key}", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Configuration parameter updated"},
    400: {"description": "Invalid request"},
    404: {"description": "Configuration parameter not found"},
    500: {"description": "Internal server error"},
})
def api_update_setting(request: Request, data: dict, config_key: str):

    # Inizializzazioni
    start_ns = time.monotonic_ns()

    try:
        result = update_config(config_key, data, json_format=True)
        if result["status"] == "success":
            took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
            return {
                    "code": "CONFIG_UPDATED",
                    "status": "success",
                    "message": "Configuration parameter updated successfully",
                    "details": {
                        "config_key": config_key,
                        "took_ms": took_ms,
                    },
                }

        else:
            # Not Found
            if result["code"] == "CONFIG_NOT_FOUND":
                took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={
                        "code": "CONFIG_NOT_FOUND",
                        "status": "failure",
                        "message": (result.get("message") if result else None) or f"Config key not found: {key}",
                        "details": {
                            "config_key": config_key,
                            "took_ms": took_ms,
                        },
                    },
                )

            # Other failure
            else:
                took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "code": "CONFIG_RESET_ERROR",
                        "status": "failure",
                        "message": (result.get("message") if result else None) or "Internal error updating configuration parameter",
                        "details": {
                            "config_key": config_key,
                            "took_ms": took_ms,
                        },
                    },
                )

    except HTTPException:
        raise

    except Exception as err:
        logger.exception("Error updating configuration parameter %s: %s", config_key, str(err).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "CONFIG_UPDATE_ERROR",
                "status": "failure",
                "message": "Internal error updating configuration parameter",
                "details": {
                    "config_key": config_key,
                    "took_ms": took_ms,
                },
            },
        )

# ---------------------------------------------------------
# Reset config to default
# ---------------------------------------------------------
@router.post("/api/settings/{config_key}/reset", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Configuration parameter reset to default"},
    400: {"description": "Invalid request"},
    404: {"description": "Configuration parameter not found"},
    500: {"description": "Internal server error"},
})
def api_reset_config(request: Request, config_key: str):

    # Inizializzazioni
    start_ns = time.monotonic_ns()

    try:
        result = update_config(config_key, reset_to_default=True, json_format=True)
        if result["status"] == "success":
            took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
            return {
                    "code": "CONFIG_RESET",
                    "status": "success",
                    "message": "Configuration parameter reset to default successfully",
                    "details": {
                        "config_key": config_key,
                        "took_ms": took_ms,
                    },
                }

        else:
            # Not Found
            if result["code"] == "CONFIG_NOT_FOUND":
                took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={
                        "code": "CONFIG_NOT_FOUND",
                        "status": "failure",
                        "message": (result.get("message") if result else None) or f"Config key not found: {key}",
                        "details": {
                            "config_key": config_key,
                            "took_ms": took_ms,
                        },
                    },
                )

            # Other failure
            else:
                took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "code": "CONFIG_RESET_ERROR",
                        "status": "failure",
                        "message": (result.get("message") if result else None) or "Internal error resetting configuration parameter",
                        "details": {
                            "config_key": config_key,
                            "took_ms": took_ms,
                        },
                    },
                )

    except HTTPException:
        raise

    except Exception as err:
        logger.exception("Error updating configuration parameter %s: %s", config_key, str(err).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "CONFIG_RESET_ERROR",
                "status": "failure",
                "message": "Internal error resetting configuration parameter",
                "details": {
                    "config_key": config_key,
                    "took_ms": took_ms,
                },
            },
        )
