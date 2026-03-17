# backend/routes/backup.py

# import standard modules
from fastapi import APIRouter, Request, Response, HTTPException, status
from fastapi.responses import FileResponse
import asyncio
import time
from typing import Iterable, List, Tuple, Dict, Any

# Import local modules
from backend.backup import backup, restore

# Import Settings & Logging
from backend.settings.settings import settings
from backend.log.log import get_logger

# Logger initialization
logger = get_logger(__name__)

# Create Router
router = APIRouter()

# ---------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------
@router.get(
    "/api/backup",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Backup executed with success or failure result"},
        500: {"description": "Internal server error"},
    },
)
async def api_backup(request: Request):

    # Initialization
    start_ns = time.monotonic_ns()

    try:
        # Backup DB
        result = backup()
        errors = result.get("errors") or []

        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

        if errors:
            logger.warning("Backup executed with %d error(s)", len(errors))
            return {
                "code": "BACKUP_ERROR",
                "status": "failure",
                "message": "Some operations failed",
                "took_ms": took_ms,
                "results": result,
            }

        return {
                "code": "BACKUP_OK",
                "status": "success",
                "message": "BACKUP executed successfully",
                "took_ms": took_ms,
                "results": result,
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
@router.get(
    "/api/restore",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Restore executed with success or failure result"},
        500: {"description": "Internal server error"},
    }
)
async def api_restore(request: Request):
    start_ns = time.monotonic_ns()

    try:
        # Restore hosts DB
        result = restore()
        errors = (result.get("errors") or [])

        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

        if errors:
            return {
                "code": "RESTORE_ERROR",
                "status": "failure",
                "message": "Some operation failed",
                "took_ms": took_ms,
                "results": result,
            }

        return {
                "code": "RESTORE_OK",
                "status": "success",
                "message": "RESTORE executed successfully",
                "took_ms": took_ms,
                "results": result,
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

