# backend/routes/dhcp.py

# import standard modules
from fastapi import APIRouter, Request, Response, HTTPException, status
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
import asyncio
import csv
import json
import os
import ipaddress
from pathlib import Path
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
@router.post("/api/dhcp/reload")
async def api_dhcp_reload(request: Request):

    # Inizializzazioni
    start_ns = time.monotonic_ns()
    kea4_hosts = []
    kea6_hosts = []

    try:
        # Get Hosts List
        hosts = get_hosts()

        # Convert hosts into the kea structure
        for h in hosts:
            if h.get("ipv4") and h.get("mac"):
                kea4_hosts.append({
                    "hw-address": h.get("mac"),
                    "ip-address": h.get("ipv4"),
                    "hostname": h.get("name"),
            })
            if h.get("ipv6") and h.get("mac"):
                kea6_hosts.append({
                    "duid": h.get("mac"),
                    "ip-addresses": h.get("ipv6"),
                    "hostname": h.get("name"),
            })

        # Save DHCP4 Configuration
        path = settings.DHCP4_HOST_FILE
        data = {"reservations": kea4_hosts}
        full = json.dumps(data, indent=4, ensure_ascii=False)
        fragment = full.strip()[1:-1].strip() + "\n"
        with open(path, "w", encoding="utf-8") as f:
            f.write(fragment)

        # Save DHCP6 Configuration
        path = settings.DHCP6_HOST_FILE
        data = {"reservations": kea6_hosts}
        full = json.dumps(data, indent=4, ensure_ascii=False)
        fragment = full.strip()[1:-1].strip() + "\n"
        with open(path, "w", encoding="utf-8") as f:
            f.write(fragment)

        # RELOAD DHCP

        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        return JSONResponse(
            status_code=status.HTTP_200_OK,
                content={
                "code": "DHCP_RELOAD_OK",
                "status": "success",
                "message": "DHCP configuration reload successfully",
                "took_ms": took_ms,
            },
        )

    except Exception as err:
        logger = get_logger("dhcp")
        logger.exception("Error reloading DHCP: %s", str(err).strip())
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "DHCP_RELOAD_ERROR",
                "status": "failure",
                "message": "Internal error reloading DHCP",
                "took_ms": took_ms,
            },
        )

# ---------------------------------------------------------
# Get Leases
# ---------------------------------------------------------
@router.get("/api/dhcp/leases")
def api_dhcp_leases(request: Request):

    # Inizializzazioni
    items = []

    try:
        path = Path(settings.DHCP4_LEASES_FILE)
        if not path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "DHCP_LEASES_NOT_FOUND",
                    "status": "failure",
                    "message": "File not found: " + str(path),
                },
            )

        def _to_int(v: str):
            v = (v or "").strip()
            if not v or v.lower() == "null":
                return None
            try:
                return int(v)
            except ValueError:
                return None

        def _to_bool(v: str):
            v = (v or "").strip().lower()
            if v in ("true", "1", "yes", "y"):
                return True
            if v in ("false", "0", "no", "n"):
                return False
            return None

        def _norm(col: str) -> str:
            col = (col or "").strip()
            aliases = {
                "client_id": "client-id",
                "valid_lifetime": "valid-lft",
                "subnet_id": "subnet-id",
                "fqdn_fwd": "fqdn-fwd",
                "fqdn_rev": "fqdn-rev",
                "user_context": "user-context",
                "pool_id": "pool-id",
            }
            return aliases.get(col, col)

        # Open the file in lettura (non locking): ok per kea memfile
        with path.open("r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content={
                        "total": 0, "items": []
                    },
                )

            for raw in reader:
                rec = { _norm(k): (v if v is not None else "") for k, v in raw.items() }

                item = {
                    "address":        rec.get("address", "").strip() or None,
                    "hwaddr":         rec.get("hwaddr", "").strip() or None,
                    "client_id":      rec.get("client-id", "").strip() or None,
                    "valid_lifetime": _to_int(rec.get("valid-lft", "")),
                    "expire":         _to_int(rec.get("expire", "")),        # epoch seconds
                    "subnet_id":      _to_int(rec.get("subnet-id", "")),
                    "fqdn_fwd":       _to_bool(rec.get("fqdn-fwd", "")),
                    "fqdn_rev":       _to_bool(rec.get("fqdn-rev", "")),
                    "hostname":       rec.get("hostname", "").strip() or None,
                    "state":          _to_int(rec.get("state", "")),
                    "user_context":   rec.get("user-context", "").strip() or None,  # spesso JSON serializzato
                    "pool_id":        _to_int(rec.get("pool-id", "")),
                }
                items.append(item)

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "total": len(items),
                "items": items
            },
        )

    except Exception as err:
        logger = get_logger("dhcp")
        logger.exception("Error reading DHCP leases: %s", str(err).strip())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "DHCP_LEASES_ERROR",
                "status": "failure",
                "message": "Internal error reading DHCP leases",
            },
        )
