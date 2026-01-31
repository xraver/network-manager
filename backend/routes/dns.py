# backend/routes/dns.py

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
@router.get("/api/dns/reload")
async def apt_dns_reload(request: Request):
    start_ns = time.monotonic_ns()

    # Inizializzazioni
    error = False
    message = None
    code = None
    status = None

    try:
        # Get Hosts List
        hosts = get_hosts()

        # Save DNS Configuration
        path = settings.DNS_HOST_FILE
        with open(path, "w", encoding="utf-8") as f:
            for h in hosts:
                line = f"{h.get('name')}\t\t IN\tA\t{h.get('ipv4')}\n"
                f.write(line)

        path = settings.DNS_HOST_FILE + ".json"
        with open(path, "w", encoding="utf-8") as f:
            #json.dump(hosts, f, indent=4, ensure_ascii=False)
            for h in hosts:
                f.write(json.dumps(h, ensure_ascii=False) + "\n")

    except Exception as err:
        error = True
        message = str(err).strip()

    if error:
        code = "DNS_RELOAD_ERROR"
        # default del messaggio se vuoto o None
        if not message:
            message = "DNS reload error"
        status = "failure"
        #http_status = 500
    else:
        code = "DNS_RELOAD_OK"
        message = "DNS configuration reload successfully"
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
