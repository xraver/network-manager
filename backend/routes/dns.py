# backend/routes/dns.py

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
# Import Logging
from log.log import setup_logging, get_logger

# Create Router
router = APIRouter()

# ---------------------------------------------------------
# Reload
# ---------------------------------------------------------
@router.post("/api/dns/reload")
async def api_dns_reload(request: Request):

    # Inizializzazioni
    start_ns = time.monotonic_ns()

    try:
        # Get Hosts List
        hosts = get_hosts()

        # Save DNS Hosts Configuration
        path = settings.DNS_HOST_FILE
        with open(path, "w", encoding="utf-8") as f:
            for h in hosts:
                line = f"{h.get('name')}\t\t IN\tA\t{h.get('ipv4')}\n"
                f.write(line)

        # Save DNS Reverse Configuration
        path = settings.DNS_REVERSE_FILE
        with open(path, "w", encoding="utf-8") as f:
            for h in hosts:
                ip = h.get("ipv4")
                if ip:
                    parts = ip.split(".")
                    rev = f"{parts[-1]}.{parts[-2]}"
                    line = f"{rev}\t\t IN PTR\t{h.get('name')}.{settings.DOMAIN}\n"
                    f.write(line)

        # RELOAD DNS

        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        return JSONResponse(
            status_code=status.HTTP_200_OK,
                content={
                "code": "DNS_RELOAD_OK",
                "status": "success",
                "message": "DNS configuration reload successfully",
                "took_ms": took_ms,
            },
        )

    except Exception as err:
        logger = get_logger("dns")
        logger.exception("Error reloading DNS: %s", str(err).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "DNS_RELOAD_ERROR",
                "status": "failure",
                "message": "Internal error reloading DNS",
                "took_ms": took_ms,
            },
        )
