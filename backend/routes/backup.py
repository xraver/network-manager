# backend/routes/backup.py

# import standard modules
from fastapi import APIRouter, Request, Response, HTTPException, status
from fastapi.responses import FileResponse, JSONResponse
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
@router.post(
    "/api/backup",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Backup executed with success or failure result"},
        207: {"description": "Backup executed with partial success"},
        500: {"description": "Internal server error"},
    },
)
async def api_backup(request: Request):

    # Initialization
    start_ns = time.monotonic_ns()

    try:
        # Backup DB
        result = backup()
        total = (result.get("summary") or []).get("total", 0)
        success = (result.get("summary") or []).get("success", 0)
        failed = (result.get("summary") or []).get("failed", 0)
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

        if failed > 0 or success != total:
            if success > 0:
                status_code=status.HTTP_207_MULTI_STATUS
                return JSONResponse(
                    status_code=status.HTTP_207_MULTI_STATUS,
                    content={
                        "code": "BACKUP_PARTIAL",
                        "status": "partial",
                        "message": "Backup completed with some failed operations",
                        "took_ms": took_ms,
                        "results": result,
                    },
                )
            else:
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
                raise HTTPException(
                    status_code=status_code,
                    detail={
                        "code": "BACKUP_ERROR",
                        "status": "failure",
                        "message": "Some operations failed",
                        "took_ms": took_ms,
                        "results": result,
                    },
                )

        else:
            return {
                "code": "BACKUP_OK",
                "status": "success",
                "message": "Backup executed successfully",
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
@router.post(
    "/api/restore",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Restore executed with success or failure result"},
        207: {"description": "Restore executed with partial success"},
        500: {"description": "Internal server error"},
    }
)
async def api_restore(request: Request):
    start_ns = time.monotonic_ns()

    try:
        # Restore DB
        result = restore()
        total = (result.get("summary") or []).get("total", 0)
        success = (result.get("summary") or []).get("success", 0)
        failed = (result.get("summary") or []).get("failed", 0)
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

        if failed > 0 or success != total:
            if success > 0:
                status_code=status.HTTP_207_MULTI_STATUS
                return JSONResponse(
                    status_code=status.HTTP_207_MULTI_STATUS,
                    content={
                        "code": "RESTORE_PARTIAL",
                        "status": "partial",
                        "message": "Restore completed with some failed operations",
                        "took_ms": took_ms,
                        "results": result,
                    },
                )
            else:
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
                raise HTTPException(
                    status_code=status_code,
                    detail={
                        "code": "RESTORE_ERROR",
                        "status": "failure",
                        "message": "Some operations failed",
                        "took_ms": took_ms,
                        "results": result,
                    },
                )

        else:
            return {
                "code": "RESTORE_OK",
                "status": "success",
                "message": "Restore executed successfully",
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
