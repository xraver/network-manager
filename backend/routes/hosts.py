# backend/routes/hosts.py

# import standard modules
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse
import time

# Import local modules
from backend.db.hosts import (
    get_hosts,
    get_host,
    add_host,
    update_host,
    delete_host
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
# Hosts page
@router.get("/hosts")
def hosts_page():
    return FileResponse(settings.FRONTEND_PATH / "hosts.html")

# Serve hosts.js
@router.get("/js/hosts.js")
def hosts_js():
    return FileResponse(settings.FRONTEND_PATH / "js/hosts.js")

# ---------------------------------------------------------
# Get Hosts
# ---------------------------------------------------------
@router.get("/api/hosts", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Hosts found"},
    500: {"description": "Internal server error"},
})
def api_get_hosts():

    try:
        hosts = get_hosts()
        return hosts or []

    except Exception as err:
        logger.exception("Error getting list hosts %s", str(err).strip())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "HOSTS_GET_ERROR",
                "status": "failure",
                "message": "Internal error getting hosts",
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
def api_get_host(host_id: int):

    # Inizializzazioni
    start_ns = time.monotonic_ns()

    try:
        host = get_host(host_id)

    except Exception as err:
        logger.exception("Error getting host %s: %s", host_id, str(err).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "HOST_GET_ERROR",
                "status": "failure",
                "message": "Internal error getting host",
                "details": {
                    "host_id": host_id,
                    "took_ms": took_ms,
                },
            },
        )

    if not host:  # None or empty dict
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "HOST_NOT_FOUND",
                "status": "failure",
                "message": "Host not found",
                "details": {
                    "host_id": host_id,
                    "took_ms": took_ms,
                },
            },
        )

    return host

# ---------------------------------------------------------
# Add Hosts
# ---------------------------------------------------------
@router.post("/api/hosts", status_code=status.HTTP_201_CREATED, responses={
    201: {"description": "Host added"},
    409: {"description": "Host already present"},
    500: {"description": "Internal server error"},
})
def api_add_host(data: dict):

    # Inizializzazioni
    start_ns = time.monotonic_ns()
    host_id = None

    try:
        host_id = add_host(data)
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        return {
                "code": "HOST_ADDED",
                "status": "success",
                "message": "Host added successfully",
                "details": {
                    "host_id": host_id,
                    "took_ms": took_ms,
                },
            }

    # Not Found
    except ValueError:
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "HOST_ALREADY_PRESENT",
                "status": "failure",
                "message": "Host already present",
                "details": {
                    "host_id": host_id,
                    "took_ms": took_ms,
                },
            },
        )

    except Exception as err:
        logger.exception("Error adding host: %s", str(err).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "HOST_ADD_ERROR",
                "status": "failure",
                "message": "Internal error adding host",
                "details": {
                    "host_id": host_id,
                    "took_ms": took_ms,
                },
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
def api_update_host(data: dict, host_id: int):

    # Inizializzazioni
    start_ns = time.monotonic_ns()

    try:
        update_host(host_id, data)
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        return {
                "code": "HOST_UPDATED",
                "status": "success",
                "message": "Host updated successfully",
                "details": {
                    "host_id": host_id,
                    "took_ms": took_ms,
                },
            }

    # Not Found
    except ValueError:
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "HOST_NOT_FOUND",
                "status": "failure",
                "message": "Host not found",
                "details": {
                    "host_id": host_id,
                    "took_ms": took_ms,
                },
            },
        )

    except Exception as err:
        logger.exception("Error updating host %s: %s", host_id, str(err).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "HOST_UPDATE_ERROR",
                "status": "failure",
                "message": "Internal error updating host",
                "details": {
                    "host_id": host_id,
                    "took_ms": took_ms,
                },
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
def api_delete_host(host_id: int):

    # Inizializzazioni
    start_ns = time.monotonic_ns()

    try:
        delete_host(host_id)
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        return {
                "code": "HOST_DELETED",
                "status": "success",
                "message": "Host deleted successfully",
                "details": {
                    "host_id": host_id,
                    "took_ms": took_ms,
                },
            }

    # Not Found
    except ValueError:
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "HOST_NOT_FOUND",
                "status": "failure",
                "message": "Host not found",
                "details": {
                    "host_id": host_id,
                    "took_ms": took_ms,
                },
            },
        )

    except Exception as err:
        logger.exception("Error deleting host %s: %s", host_id, str(err).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "HOST_DELETE_ERROR",
                "status": "failure",
                "message": "Internal error deleting host",
                "details": {
                    "host_id": host_id,
                    "took_ms": took_ms,
                },
            },
        )
