# backend/routes/hosts.py

# import standard modules
from fastapi import APIRouter, Request, Response, HTTPException, status
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
import ipaddress
import time
import os
# Import local modules
from backend.db.hosts import (
    get_hosts,
    get_host,
    add_host,
    update_host,
    delete_host
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
# Hosts page
@router.get("/hosts")
def hosts(request: Request):
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "hosts.html"))

# Serve hosts.js
@router.get("/js/hosts.js")
def css_hosts():
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "js/hosts.js"))

# ---------------------------------------------------------
# Get Hosts
# ---------------------------------------------------------
@router.get("/api/hosts", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Hosts found"},
    500: {"description": "Internal server error"},
})
def api_get_hosts(request: Request):
    try:
        hosts = get_hosts()
        return hosts or []

    except Exception as e:
        logger = get_logger("hosts")
        logger.exception("Error getting list host %s", str(e).strip())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "HOSTS_GET_ERROR",
                "status": "failure",
                "message": "Internal error getting host",
            },
        )

# ---------------------------------------------------------
# Get Host
# ---------------------------------------------------------
@router.get("/api/hosts/{host_id}", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Host found"},
    404: {"description": "Host not found"},
    500: {"description": "Internal server error"},
})
def api_get_host(request: Request, host_id: int):

    try:
        host = get_host(host_id)
        if not host:  # None or empty dict
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "HOST_NOT_FOUND",
                    "status": "failure",
                    "message": "Host not found",
                    "host_id": host_id,
                },
            )
        return host

    except Exception as e:
        logger = get_logger("hosts")
        logger.exception("Error adding host %s: %s", host_id, str(e).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "HOST_GET_ERROR",
                "status": "failure",
                "message": "Internal error getting host",
                "took_ms": took_ms,
            },
        )

# ---------------------------------------------------------
# Add Hosts
# ---------------------------------------------------------
@router.post("/api/hosts", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Host added"},
    409: {"description": "Host already present"},
    500: {"description": "Internal server error"},
})
def api_add_host(request: Request, data: dict):

    # Inizializzazioni
    start_ns = time.monotonic_ns()

    try:
        host_id = add_host(data)
        if(host_id > 0):
            took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "code": "HOST_ADDED",
                    "status": "success",
                    "message": "Host added successfully",
                    "host_id": host_id,
                    "took_ms": took_ms,
                },
            )

        # Already present
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "HOST_ALREADY_PRESENT",
                "status": "failure",
                "message": "Host already present",
                "took_ms": took_ms,
            },
        )

    except HTTPException as httpe:
        raise httpe

    except Exception as e:
        logger = get_logger("hosts")
        logger.exception("Error adding host: %s", str(e).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "HOST_ADD_ERROR",
                "status": "failure",
                "message": "Internal error adding host",
                "took_ms": took_ms,
            },
        )

# ---------------------------------------------------------
# Update Host
# ---------------------------------------------------------
@router.put("/api/hosts/{host_id}", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Host updated"},
    404: {"description": "Host not found"},
    500: {"description": "Internal server error"},
})
def api_update_host(request: Request, data: dict, host_id: int):

    # Inizializzazioni
    start_ns = time.monotonic_ns()

    try:
        updated = update_host(host_id, data)
        if updated:
            took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "code": "HOST_UPDATED",
                    "status": "success",
                    "message": "Host updated successfully",
                    "host_id": host_id,
                    "took_ms": took_ms,
                },
            )

        # Not Found
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "HOST_NOT_FOUND",
                "status": "failure",
                "message": "Host not found",
                "host_id": host_id,
                "took_ms": took_ms,
            },
        )

    except Exception as e:
        logger = get_logger("hosts")
        logger.exception("Error updating host %s: %s", host_id, str(e).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "HOST_UPDATE_ERROR",
                "status": "failure",
                "message": "Internal error updating host",
                "host_id": host_id,
                "took_ms": took_ms,
            },
        )

# ---------------------------------------------------------
# Delete
# ---------------------------------------------------------
@router.delete("/api/hosts/{host_id}", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Host deleted"},
    404: {"description": "Host not found"},
    500: {"description": "Internal server error"},
})
def api_delete_host(request: Request, host_id: int):

    # Inizializzazioni
    start_ns = time.monotonic_ns()

    try:
        deleted = delete_host(host_id)
        if deleted:
            took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "code": "HOST_DELETED",
                    "status": "success",
                    "message": "Host deleted successfully",
                    "details": {"took_ms": took_ms, "host_id": host_id,},
                },
            )

        # Not Found
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "HOST_NOT_FOUND",
                "status": "failure",
                "message": "Host not found",
                "host_id": host_id,
                "took_ms": took_ms,
            },
        )

    except Exception as e:
        logger = get_logger("hosts")
        logger.exception("Error deleting host %s: %s", host_id, str(e).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "HOST_DELETE_ERROR",
                "status": "failure",
                "message": "Internal error deleting host",
                "host_id": host_id,
                "took_ms": took_ms,
            },
        )
