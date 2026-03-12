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
from backend.db.config import get_config
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

        # Get Domain
        domain = get_config("domain")

        # Save DNS Reverse Configuration
        path = settings.DNS_REVERSE_FILE
        with open(path, "w", encoding="utf-8") as f:
            for h in hosts:
                ip = h.get("ipv4")
                if ip:
                    parts = ip.split(".")
                    rev = f"{parts[-1]}.{parts[-2]}"
                    line = f"{rev}\t\t IN PTR\t{h.get('name')}.{domain}\n"
                    f.write(line)

        # Get Aliases List
        aliases = get_aliases()

        # Save DNS Aliases Configuration
        path = settings.DNS_ALIAS_FILE
        with open(path, "w", encoding="utf-8") as f:
            for a in aliases:
                line = f"{a.get('name')}\t\t IN\tCNAME\t{a.get('target')}\n"
                f.write(line)

        # Get Ext_Cname
        ext_cname = get_config("external_name")

        # Save DNS Host and Aliases for the EXT DNS
        path = settings.DNS_HOST_FILE + "_ext"
        with open(path, "w", encoding="utf-8") as f:
            for h in hosts:
                vis = h.get('visibility')
                if (vis == 1):
                    line = f"{h.get('name')}\t\t IN\tA\t{h.get('ipv4')}\n"
                    f.write(line)
                if (vis == 2):
                    line = f"{h.get('name')}\t\t IN\tCNAME\t{ext_cname}\n"
                    f.write(line)

            for a in aliases:
                vis = a.get('visibility')
                if (vis == 1):
                    line = f"{a.get('name')}\t\t IN\tCNAME\t{a.get('target')}\n"
                    f.write(line)
                if (vis == 2):
                    line = f"{a.get('name')}\t\t IN\tCNAME\t{ext_cname}\n"
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
