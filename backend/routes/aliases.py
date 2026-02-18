# backend/routes/aliases.py

# import standard modules
from fastapi import APIRouter, Request, Response, HTTPException, status
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
import ipaddress
import time
import os
# Import local modules
from backend.db.aliases import (
    get_aliases,
    get_alias,
    add_alias,
    update_alias,
    delete_alias
)
# Import Settings
from settings.settings import settings
# Import Logging
from log.log import setup_logging, get_logger

# Create Router
router = APIRouter()

# ---------------------------------------------------------
# FRONTEND PATHS (absolute paths inside Docker)
# ---------------------------------------------------------
# Aliass page
@router.get("/aliases")
def aliases(request: Request):
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "aliases.html"))

# Serve aliases.js
@router.get("/js/aliases.js")
def js_aliases():
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "js/aliases.js"))

# ---------------------------------------------------------
# Get Aliass
# ---------------------------------------------------------
@router.get("/api/aliases", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Aliass found"},
    500: {"description": "Internal server error"},
})
def api_get_aliases(request: Request):
    try:
        aliases = get_aliases()
        return aliases or []

    except Exception as e:
        logger = get_logger("aliases")
        logger.exception("Error getting list alias %s", str(e).strip())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "ALIASES_GET_ERROR",
                "status": "failure",
                "message": "Internal error getting alias",
            },
        )

# ---------------------------------------------------------
# Get Alias
# ---------------------------------------------------------
@router.get("/api/aliases/{alias_id}", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Alias found"},
    404: {"description": "Alias not found"},
    500: {"description": "Internal server error"},
})
def api_get_alias(request: Request, alias_id: int):

    try:
        alias = get_alias(alias_id)
        if not alias:  # None or empty dict
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "ALIAS_NOT_FOUND",
                    "status": "failure",
                    "message": "Alias not found",
                    "alias_id": alias_id,
                },
            )
        return alias

    except Exception as e:
        logger = get_logger("aliases")
        logger.exception("Error adding alias %s: %s", alias_id, str(e).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "ALIAS_GET_ERROR",
                "status": "failure",
                "message": "Internal error getting alias",
                "took_ms": took_ms,
            },
        )

# ---------------------------------------------------------
# Add Aliass
# ---------------------------------------------------------
@router.post("/api/aliases", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Alias added"},
    409: {"description": "Alias already present"},
    500: {"description": "Internal server error"},
})
def api_add_alias(request: Request, data: dict):

    # Inizializzazioni
    start_ns = time.monotonic_ns()

    try:
        alias_id = add_alias(data)
        if(alias_id > 0):
            took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "code": "ALIAS_ADDED",
                    "status": "success",
                    "message": "Alias added successfully",
                    "alias_id": alias_id,
                    "took_ms": took_ms,
                },
            )

        # Already present
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "ALIAS_ALREADY_PRESENT",
                "status": "failure",
                "message": "Alias already present",
                "took_ms": took_ms,
            },
        )

    except HTTPException as httpe:
        raise httpe

    except Exception as e:
        logger = get_logger("aliases")
        logger.exception("Error adding alias: %s", str(e).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "ALIAS_ADD_ERROR",
                "status": "failure",
                "message": "Internal error adding alias",
                "took_ms": took_ms,
            },
        )

# ---------------------------------------------------------
# Update Alias
# ---------------------------------------------------------
@router.put("/api/aliases/{alias_id}", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Alias updated"},
    404: {"description": "Alias not found"},
    500: {"description": "Internal server error"},
})
def api_update_alias(request: Request, data: dict, alias_id: int):

    # Inizializzazioni
    start_ns = time.monotonic_ns()

    try:
        updated = update_alias(alias_id, data)
        if updated:
            took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "code": "ALIAS_UPDATED",
                    "status": "success",
                    "message": "Alias updated successfully",
                    "alias_id": alias_id,
                    "took_ms": took_ms,
                },
            )

        # Not Found
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "ALIAS_NOT_FOUND",
                "status": "failure",
                "message": "Alias not found",
                "alias_id": alias_id,
                "took_ms": took_ms,
            },
        )

    except Exception as e:
        logger = get_logger("aliases")
        logger.exception("Error updating alias %s: %s", alias_id, str(e).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "ALIAS_UPDATE_ERROR",
                "status": "failure",
                "message": "Internal error updating alias",
                "alias_id": alias_id,
                "took_ms": took_ms,
            },
        )

# ---------------------------------------------------------
# Delete
# ---------------------------------------------------------
@router.delete("/api/aliases/{alias_id}", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Alias deleted"},
    404: {"description": "Alias not found"},
    500: {"description": "Internal server error"},
})
def api_delete_alias(request: Request, alias_id: int):

    # Inizializzazioni
    start_ns = time.monotonic_ns()

    try:
        deleted = delete_alias(alias_id)
        if deleted:
            took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "code": "ALIAS_DELETED",
                    "status": "success",
                    "message": "Alias deleted successfully",
                    "details": {"took_ms": took_ms, "alias_id": alias_id,},
                },
            )

        # Not Found
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "ALIAS_NOT_FOUND",
                "status": "failure",
                "message": "Alias not found",
                "alias_id": alias_id,
                "took_ms": took_ms,
            },
        )

    except Exception as e:
        logger = get_logger("aliases")
        logger.exception("Error deleting alias %s: %s", alias_id, str(e).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "ALIAS_DELETE_ERROR",
                "status": "failure",
                "message": "Internal error deleting alias",
                "alias_id": alias_id,
                "took_ms": took_ms,
            },
        )
