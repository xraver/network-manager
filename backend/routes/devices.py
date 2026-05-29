# backend/routes/hosts.py

# import standard modules
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, Request, Response, HTTPException, status
from fastapi.responses import FileResponse
import ipaddress
import time

# Import local modules
from backend.db.hosts import get_hosts
from backend.db.leases import get_leases

# Import Settings & Config
from backend.settings.settings import settings
from backend.db.config import get_config
# Import Logging
from backend.log.log import get_logger

from backend.utils import is_host_active

# Logger initialization
logger = get_logger(__name__)

# Create Router
router = APIRouter()

# ---------------------------------------------------------
# FRONTEND PATHS (absolute paths inside Docker)
# ---------------------------------------------------------
# Devices page
@router.get("/devices")
def devices(request: Request):
    return FileResponse(settings.FRONTEND_PATH / "devices.html")

# Serve devices.js
@router.get("/js/devices.js")
def js_devices():
    return FileResponse(settings.FRONTEND_PATH / "js/devices.js")

# ---------------------------------------------------------
# Get Devices
# ---------------------------------------------------------
@router.get("/api/devices", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Devices found"},
    500: {"description": "Internal server error"},
})
def api_get_devices(request: Request):

    try:
        hosts = get_hosts(filter_devices=True)
        with ThreadPoolExecutor(max_workers=settings.PING_WORKERS) as executor:
            futures = [executor.submit(is_host_active, host["ipv4"]) for host in hosts]
            for i, future in enumerate(futures):
                hosts[i]["dhcp_state"] = "static"
                hosts[i]["active"] = future.result()

        leases = get_leases(filter_devices=True)
        with ThreadPoolExecutor(max_workers=settings.PING_WORKERS) as executor:
            futures = [executor.submit(is_host_active, lease["ipv4"]) for lease in leases]
            for i, future in enumerate(futures):
                leases[i]["description"] = None
                leases[i]["active"] = future.result()

        return hosts+leases or []

    except HTTPException:
        raise

    except Exception as err:
        logger.exception("Error getting list devices %s", str(err).strip())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "DEVICES_GET_ERROR",
                "status": "failure",
                "message": "Internal error getting devices",
            },
        )
