# backend/routes/backup.py

# import standard modules
from fastapi import APIRouter, Request, Response, HTTPException, status
from fastapi.responses import FileResponse
import asyncio
import json
import os
import ipaddress
import time
from typing import Iterable, List, Tuple, Dict, Any

# Import local modules
from backend.db.hosts import get_hosts, add_host, reset_hosts_db
from backend.db.aliases import get_aliases, add_alias, reset_aliases_db

# Import Settings & Logging
from backend.settings.settings import settings
from backend.log.log import get_logger

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
    path = os.path.join(settings.DATA_PATH, "hosts.json")
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
    path = os.path.join(settings.DATA_PATH, "aliases.json")
    with open(path, "w", encoding="utf-8") as f:
        for a in aliases:
            f.write(json.dumps(a, ensure_ascii=False) + "\n")

# ---------------------------------------------------------
# Internal: load NDJSON utility
# ---------------------------------------------------------
def _load_ndjson(path: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    records: List[Dict[str, Any]] = []
    errors: List[str] = []

    if not os.path.exists(path):
        errors.append(f"File not found: {path}")
        return records, errors

    with open(path, "r", encoding="utf-8") as f:
        for lineno, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                if isinstance(obj, dict):
                    records.append(obj)
                else:
                    errors.append(f"{os.path.basename(path)}:{lineno} -> JSON is not an object")
            except json.JSONDecodeError as e:
                errors.append(f"{os.path.basename(path)}:{lineno} -> JSON decode error: {str(e)}")

    return records, errors

# ---------------------------------------------------------
# Restore Hosts DB
# ---------------------------------------------------------
def restore_hosts() -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    src_path = os.path.join(settings.DATA_PATH, "hosts.json")
    restored = 0

    # load records from NDJSON file
    records, load_errors = _load_ndjson(src_path)

    try:
        for r in records:
            add_host(r)
            restored += 1

    except Exception as e:
        logger.exception("restore_hosts failed applying records: %s", str(e).strip())
        raise

    took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
    return {
        "file": src_path,
        "count_loaded": len(records),
        "count_restored": restored,
        "load_errors": load_errors,
        "took_ms": took_ms,
    }

# ---------------------------------------------------------
# Restore Aliases DB
# ---------------------------------------------------------
def restore_aliases() -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    src_path = os.path.join(settings.DATA_PATH, "aliases.json")
    restored = 0

    # load records from NDJSON file
    records, load_errors = _load_ndjson(src_path)

    try:
        for r in records:
            add_alias(r)
            restored += 1

    except Exception as e:
        logger.exception("restore_aliases failed applying records: %s", str(e).strip())
        raise

    took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
    return {
        "file": src_path,
        "count_loaded": len(records),
        "count_restored": restored,
        "load_errors": load_errors,
        "took_ms": took_ms,
    }

# ---------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------
@router.get("/api/backup", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Backup executed successfully"},
    500: {"description": "Internal server error"},
})
async def api_backup(request: Request):

    # Initialization
    start_ns = time.monotonic_ns()

    try:
        # Backup Hosts DB
        save_host()

        # Backup Aliases DB
        save_aliases()

        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        return {
                "code": "BACKUP_OK",
                "status": "success",
                "message": "BACKUP executed successfully",
                "took_ms": took_ms,
            }

    except HTTPException:
        raise

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

# ---------------------------------------------------------
# API: Restore from backup
# ---------------------------------------------------------
@router.get("/api/restore", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Restore executed successfully"},
    400: {"description": "Invalid backup files"},
    500: {"description": "Internal server error"},
})
async def api_restore(request: Request):
    start_ns = time.monotonic_ns()

    try:
        # 1) Restore hosts
        reset_hosts_db()
        hosts_result = restore_hosts()

        # 2) Restore aliases
        reset_aliases_db()
        aliases_result = restore_aliases()

        # Se uno dei file ha errori di parsing, segnaliamolo come 400
        load_errors = (hosts_result.get("load_errors") or []) + (aliases_result.get("load_errors") or [])
        if load_errors:
            # Non blocchiamo l'operazione se comunque abbiamo applicato record;
            # ma comunichiamo che ci sono righe scartate.
            logger.warning("Restore completed with parsing issues: %d errors", len(load_errors))

        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        return {
                "code": "RESTORE_OK",
                "status": "success",
                "message": "RESTORE executed successfully",
                "took_ms": took_ms,
                "results": {
                    "hosts": hosts_result,
                    "aliases": aliases_result,
                },
            }

    except HTTPException:
        raise

    except Exception as err:
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        logger.exception("Error executing restore: %s", str(err).strip())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "RESTORE_ERROR",
                "status": "failure",
                "message": "Internal error executing restore",
                "took_ms": took_ms,
            },
        )
