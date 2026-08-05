# backend/routes/hosts.py

# import standard modules
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

# Import local modules
from backend.db.hosts import get_hosts
from backend.db.leases import get_leases

# Import Settings & Config
from backend.settings.settings import settings
from backend.db.settings import get_config
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
def devices_page():
    return FileResponse(settings.FRONTEND_PATH / "devices.html")

# Serve devices.js
@router.get("/js/devices.js")
def devices_js():
    return FileResponse(settings.FRONTEND_PATH / "js/devices.js")

# ---------------------------------------------------------
# Get Devices
# ---------------------------------------------------------
@router.get("/api/devices", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Devices found"},
    500: {"description": "Internal server error"},
})
def api_get_devices():

    try:
        workers = get_config("PING_WORKERS")
        hosts = get_hosts(filter_devices=True)
        leases = get_leases(filter_devices=True)

        for host in hosts:
            host["dhcp_state"] = "static"

        for lease in leases:
            lease["description"] = None

        devices = hosts + leases

        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = [
                executor.submit(is_host_active, device["ipv4"])
                for device in devices
            ]

            for i, future in enumerate(futures):
                devices[i]["active"] = future.result()

        return devices

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
