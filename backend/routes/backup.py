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
from backend.db.aliases import get_aliases

# Import Settings & Logging
from backend.settings.settings import settings
from backend.log.log import setup_logging, get_logger

# Logger initialization
logger = get_logger(__name__)

# Create Router
router = APIRouter()

# ---------------------------------------------------------
# Save Hosts DB
# ---------------------------------------------------------
def save_host():
    # Get Hosts List
    hosts = get_hosts()

    # Backup Hosts DB
    path = settings.DATA_PATH + "/hosts.json"
    with open(path, "w", encoding="utf-8") as f:
        for h in hosts:
            f.write(json.dumps(h, ensure_ascii=False) + "\n")

# ---------------------------------------------------------
# Save Aliases DB
# ---------------------------------------------------------
def save_aliases():
    # Get Aliases List
    aliases = get_aliases()

    # Backup Aliases DB
    path = settings.DATA_PATH + "/aliases.json"
    with open(path, "w", encoding="utf-8") as f:
        for a in aliases:
            f.write(json.dumps(a, ensure_ascii=False) + "\n")

# ---------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------
@router.get("/api/backup", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Backup executed successfully"},
    500: {"description": "Internal server error"},
})
async def api_dns_reload(request: Request):

    # Inizializzazioni
    start_ns = time.monotonic_ns()

    try:
        # Backup Hosts DB
        save_host()

        # Backup Aliases DB
        save_aliases()

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
        logger.exception("Error executing backup: %s", str(err).strip())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "BACKUP_ERROR",
                "status": "failure",
                "message": "Internal error executing backup",
                "took_ms": took_ms,
            },
        )
