# backend/routes/dhcp.py

# import standard modules
from fastapi import APIRouter, Request, Response
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
import asyncio
import json
import os
import ipaddress
import time
# Import local modules
from backend.db.hosts import get_hosts
# Import Settings
from settings.settings import settings

# Create Router
router = APIRouter()

# ---------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------
@router.get("/api/dhcp/reload")
async def apt_dhcp_reload(request: Request):
    start_ns = time.monotonic_ns()

    # Inizializzazioni
    error = False
    message = None
    code = None
    status = None
    kea4_hosts = []
    kea6_hosts = []

    try:
        # Get Hosts List
        hosts = get_hosts()

        # Convert hosts into the kea structure
        for h in hosts:
            if h.get("ipv4") and h.get("mac"):
                kea4_hosts.append({
                    "hostname": h.get("name"),
                    "hw-address": h.get("mac"),
                    "ip-address": h.get("ipv4"),
            })
            if h.get("ipv6") and h.get("mac"):
                kea6_hosts.append({
                   "hostname": h.get("name"),
                    "hw-address": h.get("mac"),
                    "ip-address": h.get("ipv6"),
            })

        # Save DHCP4 Configuration
        path = settings.DHCP4_HOST_FILE
        with open(path, "w", encoding="utf-8") as f:
            json.dump(kea4_hosts, f, indent=4, ensure_ascii=False)

        # Save DHCP6 Configuration
        path = settings.DHCP6_HOST_FILE
        with open(path, "w", encoding="utf-8") as f:
            json.dump(kea6_hosts, f, indent=4, ensure_ascii=False)

    except Exception as err:
        error = True
        message = str(err).strip()

    if error:
        code = "DHCP_RELOAD_ERROR"
        # default del messaggio se vuoto o None
        if not message:
            message = "DHCP reload error"
        status = "failure"
        #http_status = 500
    else:
        code = "DHCP_RELOAD_OK"
        message = "DHCP configuration reload successfully"
        status = "success"
        #http_status = 200

    took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

    payload = {
        "code": code,
        "status": status,
        "message": message,
        "details": {
            "took_ms": took_ms
        }
    }
    return JSONResponse(content=payload)
    #return JSONResponse(content=payload, status_code=http_status)
