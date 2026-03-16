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
@router.post("/api/dns/reload", status_code=status.HTTP_200_OK, responses={
    200: {"description": "DNS configuration reload successfully"},
    500: {"description": "Internal server error"},
})
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
                name   = h.get("name").ljust(20)
                rtype  = "A".ljust(8)
                target = h.get("ipv4")
                line = f"{name} IN {rtype} {target}\n"
                f.write(line)

        # Save DNS Reverse Configuration
        path = settings.DNS_REVERSE_FILE
        with open(path, "w", encoding="utf-8") as f:
            for h in hosts:
                ip = h.get("ipv4")
                if ip:
                    parts  = ip.split(".")
                    rev    = f"{parts[-1]}.{parts[-2]}"
                    ip     = rev.ljust(20)
                    rtype  = "PTR".ljust(8)
                    target = h.get("name")+ "." + settings.DOMAIN
                    line = f"{ip} IN {rtype} {target}\n"
                    f.write(line)

        # Get Aliases List
        aliases = get_aliases()

        # Save DNS Aliases Configuration
        path = settings.DNS_ALIAS_FILE
        with open(path, "w", encoding="utf-8") as f:
            for a in aliases:
                name   = a.get("name").ljust(20)
                rtype  = "CNAME".ljust(8)
                target = a.get("target")
                line = f"{name} IN {rtype} {target}\n"
                f.write(line)

        # Get Ext_Cname
        ext_cname = get_config("external_name")

        # Save DNS Host and Aliases for the EXT DNS
        path = settings.DNS_HOST_FILE + "_ext"
        with open(path, "w", encoding="utf-8") as f:
            for h in hosts:
                name   = h.get("name").ljust(20)
                vis = h.get('visibility')
                if (vis == 1):
                    rtype  = "A".ljust(8)
                    target = h.get("ipv4")
                    line = f"{name} IN {rtype} {target}\n"
                    f.write(line)
                if (vis == 2):
                    rtype  = "CNAME".ljust(8)
                    target = ext_cname + "."
                    line = f"{name} IN {rtype} {target}\n"
                    f.write(line)

            for a in aliases:
                name   = a.get("name").ljust(20)
                vis = a.get('visibility')
                if (vis == 1):
                    rtype  = "CNAME".ljust(8)
                    target = a.get("target") + "." + settings.DOMAIN + "."
                    line = f"{name} IN {rtype} {target}\n"
                    f.write(line)
                if (vis == 2):
                    rtype  = "CNAME".ljust(8)
                    target = ext_cname + "."
                    line = f"{name} IN {rtype} {target}\n"
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
