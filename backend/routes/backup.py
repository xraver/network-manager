# backend/routes/backup.py

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
@router.get("/api/backup")
async def apt_dns_reload(request: Request):
    start_ns = time.monotonic_ns()

    # Inizializzazioni
    error = False
    message = None
    code = None
    status = None
    dns_hosts = []
    dns_reverse = []

    try:
        # Get Hosts List
        hosts = get_hosts()

        # Backup Hosts DB
        path = settings.DATA_PATH + "/hosts.json"
        with open(path, "w", encoding="utf-8") as f:
            for h in hosts:
                f.write(json.dumps(h, ensure_ascii=False) + "\n")

    except Exception as err:
        error = True
        message = str(err).strip()

    if error:
        code = "BACKUP_ERROR"
        # default del messaggio se vuoto o None
        if not message:
            message = "BACKUP error"
        status = "failure"
        #http_status = 500
    else:
        code = "BACKUP_OK"
        message = "BACKUP executed successfully"
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
