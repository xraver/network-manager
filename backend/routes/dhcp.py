# backend/routes/dhcp.py

# import standard modules
from fastapi import APIRouter, Request, Response, HTTPException, status
from fastapi.responses import FileResponse
import json
import time

# Import local modules
from backend.db.hosts import get_hosts
from backend.db.leases import get_leases, get_lease, delete_lease

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
# Leases page
@router.get("/leases")
def leases_page(request: Request):
    return FileResponse(settings.FRONTEND_PATH / "leases.html")

# Serve leases.js
@router.get("/js/leases.js")
def leases_js():
    return FileResponse(settings.FRONTEND_PATH / "js/leases.js")

# ---------------------------------------------------------
# Reload
# ---------------------------------------------------------
@router.post("/api/dhcp/reload", status_code=status.HTTP_200_OK, responses={
    200: {"description": "DHCP configuration reload successfully"},
    500: {"description": "Internal server error"},
})
async def api_dhcp_reload(request: Request):

    # Inizializzazioni
    start_ns = time.monotonic_ns()
    kea4_hosts = []
    kea6_hosts = []

    try:
        # Get Hosts List
        hosts = get_hosts()

        # Convert hosts into the kea structure
        for h in hosts:
            if h.get("ipv4") and h.get("mac"):
                kea4_hosts.append({
                    "hw-address": h.get("mac"),
                    "ip-address": h.get("ipv4"),
                    "hostname": h.get("name"),
            })
            if h.get("ipv6") and h.get("mac"):
                kea6_hosts.append({
                    "duid": h.get("mac"),
                    "ip-addresses": h.get("ipv6"),
                    "hostname": h.get("name"),
            })

        # Save DHCP4 Configuration
        path = settings.DHCP4_HOST_FILE
        data = {"reservations": kea4_hosts}
        full = json.dumps(data, indent=4, ensure_ascii=False)
        fragment = full.strip()[1:-1].strip() + "\n"
        with open(path, "w", encoding="utf-8") as f:
            f.write(fragment)

        # Save DHCP6 Configuration
        path = settings.DHCP6_HOST_FILE
        data = {"reservations": kea6_hosts}
        full = json.dumps(data, indent=4, ensure_ascii=False)
        fragment = full.strip()[1:-1].strip() + "\n"
        with open(path, "w", encoding="utf-8") as f:
            f.write(fragment)

        # RELOAD DHCP

        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        return {
                "code": "DHCP_RELOAD_OK",
                "status": "success",
                "message": "DHCP configuration reload successfully",
                "took_ms": took_ms,
            }

    except HTTPException:
        raise

    except Exception as err:
        logger.exception("Error reloading DHCP: %s", str(err).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "DHCP_RELOAD_ERROR",
                "status": "failure",
                "message": "Internal error reloading DHCP",
                "took_ms": took_ms,
            },
        )

# ---------------------------------------------------------
# Get Leases
# ---------------------------------------------------------
@router.get("/api/dhcp/leases", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Leases found"},
    404: {"description": "Leases not found"},
    500: {"description": "Internal server error"},
})
def api_dhcp_leases(request: Request):

    try:
        leases = get_leases()
        return leases or []

    except FileNotFoundError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "DHCP_LEASES_NOT_FOUND",
                "status": "failure",
                "message": str(err),
            },
        )

    except HTTPException:
        raise

    except Exception as err:
        logger.exception("Error reading DHCP leases: %s", str(err).strip())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "DHCP_LEASES_ERROR",
                "status": "failure",
                "message": "Internal error reading DHCP leases",
            },
        )

# ---------------------------------------------------------
# Get Lease
# ---------------------------------------------------------
@router.get("/api/dhcp/leases/{lease_id}", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Lease found"},
    404: {"description": "Lease not found"},
    500: {"description": "Internal server error"},
})
def api_get_lease(request: Request, lease_id: int):

    # Inizializzazioni
    start_ns = time.monotonic_ns()

    try:
        lease = get_lease(lease_id)
        if not lease:  # None or empty dict
            took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "DHCP_LEASE_NOT_FOUND",
                    "status": "failure",
                    "message": "Lease not found",
                    "details": {
                        "lease_id": lease_id,
                        "took_ms": took_ms,
                    },
                },
            )
        return lease

    except FileNotFoundError as err:
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "DHCP_LEASE_NOT_FOUND",
                "status": "failure",
                "message": str(err),
                "details": {
                    "lease_id": lease_id,
                    "took_ms": took_ms,
                },
            },
        )

    except HTTPException:
        raise

    except Exception as err:
        logger.exception("Error reading DHCP lease: %s", str(err).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "DHCP_LEASE_ERROR",
                "status": "failure",
                "message": "Internal error reading DHCP lease",
                "details": {
                    "lease_id": lease_id,
                    "took_ms": took_ms,
                },
            },
        )

# ---------------------------------------------------------
# Delete
# ---------------------------------------------------------
@router.delete("/api/dhcp/leases/{lease_id}", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Lease deleted"},
    404: {"description": "Lease not found"},
    500: {"description": "Internal server error"},
})
def api_delete_lease(request: Request, lease_id: int):

    # Inizializzazioni
    start_ns = time.monotonic_ns()

    try:
        delete_lease(lease_id)

        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        return {
            "code": "DHCP_LEASE_DELETED",
            "status": "success",
            "message": "Lease deleted successfully",
            "details": {
                "lease_id": lease_id,
                "took_ms": took_ms,
            },
        }

    except FileNotFoundError as err:
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "DHCP_LEASES_NOT_FOUND",
                "status": "failure",
                "message": str(err),
                "details": {
                    "lease_id": lease_id,
                    "took_ms": took_ms,
                },
            },
        )

    except ValueError as err:
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "DHCP_LEASES_NOT_FOUND",
                "status": "failure",
                "message": str(err),
                "details": {
                    "lease_id": lease_id,
                    "took_ms": took_ms,
                },
            },
        )

    except HTTPException:
        raise

    except Exception as err:
        logger.exception("Error deleting lease index %s: %s", lease_id, str(err).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "DHCP_LEASE_DELETE_ERROR",
                "status": "failure",
                "message": "Internal error deleting lease",
                "details": {
                    "lease_id": lease_id,
                    "took_ms": took_ms,
                },
            },
        )
