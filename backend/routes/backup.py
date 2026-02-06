# backend/routes/backup.py

# import standard modules
from fastapi import APIRouter, Request, Response, HTTPException, status
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
async def api_dns_reload(request: Request):
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

        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "code": "BACKUP_OK",
                "status": "success",
                "message": "BACKUP executed successfully",
                "took_ms": took_ms,
            },
        )

    except Exception as err:
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        logger = get_logger("hosts")
        logger.exception("Error executing backup: %s", str(e).strip())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "BACKUP_ERROR",
                "status": "failure",
                "message": "Internal error executing backup",
                "took_ms": took_ms,
            },
        )
