# backend/routes/backup.py

# import standard modules
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel
import time
from typing import Dict, Any

# Import local modules
from backend.backup import backup_create, backup_list, backup_restore, backup_delete

# Import Logging
from backend.log.log import get_logger

# Logger initialization
logger = get_logger(__name__)

# Create Router
router = APIRouter()

class BackupRestoreRequest(BaseModel):
    backup_id: str

class BackupDeleteRequest(BaseModel):
    backup_id: str

# ---------------------------------------------------------
# Internal: Convert _OK to _PARTIAL
# ---------------------------------------------------------
def to_partial_code(code_ok: str) -> str:
    if code_ok.endswith("_OK"):
        return code_ok[:-3] + "_PARTIAL"
    return f"{code_ok}_PARTIAL"

# ---------------------------------------------------------
# Internal: Prepare answer
# ---------------------------------------------------------
def build_operation_response(
    *,
    code_ok: str,
    code_error: str,
    message_ok: str,
    message_partial: str,
    message_error: str,
    result: dict,
    start_ns: int
) -> Dict[str, Any] | Response:
    summary = result.get("summary") or {}
    total = summary.get("total", 0)
    success = summary.get("success", 0)
    failed = summary.get("failed", 0)

    took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

    is_partial = failed > 0 or success != total
    if is_partial:
        if success > 0:
            return JSONResponse(
                status_code=status.HTTP_207_MULTI_STATUS,
                content={
                    "code": to_partial_code(code_ok),
                    "status": "partial",
                    "message": message_partial,
                    "took_ms": took_ms,
                    "results": result,
                },
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "code": code_error,
                    "status": "failure",
                    "message": message_error,
                    "took_ms": took_ms,
                    "results": result,
                },
            )

    return {
        "code": code_ok,
        "status": "success",
        "message": message_ok,
        "took_ms": took_ms,
        "results": result,
    }

# ---------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------
@router.post("/api/backup/create")
async def api_backup_create():

    # Initialization
    start_ns = time.monotonic_ns()

    try:
        # Backup Creation
        result = backup_create()

        return build_operation_response(
            code_ok="BACKUP_CREATE_OK",
            code_error="BACKUP_CREATE_ERROR",
            message_ok="Backup executed successfully",
            message_partial="Backup completed with some failed operations",
            message_error="Some operations failed",
            result=result,
            start_ns=start_ns,
        )

    except HTTPException:
        raise

    except Exception as err:
        logger.exception("Error executing backup: %s", str(err))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "BACKUP_CREATE_ERROR", "message": "Internal error"},
        )

# ---------------------------------------------------------
# API: List available backups
# ---------------------------------------------------------
@router.get("/api/backup/list")
async def api_backup_list():

    # Initialization
    start_ns = time.monotonic_ns()

    try:
        backups = backup_list()
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

        return {
            "status": "success",
            "took_ms": took_ms,
            "backups": backups
        }

    except HTTPException:
        raise

    except Exception as err:
        logger.exception("Error listing backups: %s", str(err))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "BACKUP_LIST_ERROR", "message": "Internal error"},
        )

# ---------------------------------------------------------
# API: Restore from backup
# ---------------------------------------------------------
@router.post("/api/backup/restore")
async def api_backup_restore(payload: BackupRestoreRequest):

    # Initialization
    start_ns = time.monotonic_ns()

    try:
        # Backup Restore
        result = backup_restore(backup_id=payload.backup_id)

        return build_operation_response(
            code_ok="BACKUP_RESTORE_OK",
            code_error="BACKUP_RESTORE_ERROR",
            message_ok="Restore executed successfully",
            message_partial="Restore completed with some failed operations",
            message_error="Some operations failed",
            result=result,
            start_ns=start_ns,
        )

    except HTTPException:
        raise

    except Exception as err:
        logger.exception("Error executing restore: %s", str(err))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "BACKUP_RESTORE_ERROR", "message": "Internal error"},
        )

# ---------------------------------------------------------
# API: Delete a backup
# ---------------------------------------------------------
@router.post("/api/backup/delete")
async def api_backup_delete(payload: BackupDeleteRequest):

    # Initialization
    start_ns = time.monotonic_ns()

    try:
        # Delete Backup
        result = backup_delete(backup_id=payload.backup_id)
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

        if result.get("status") != "success":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "BACKUP_NOT_FOUND",
                    "status": "failure",
                    "message": "Backup not found",
                    "took_ms": took_ms,
                    "results": result,
                },
            )

        return {
            "code": "BACKUP_DELETED",
            "status": "success",
            "message": "Backup deleted successfully",
            "took_ms": took_ms,
            "results": result,
        }

    except HTTPException:
        raise

    except Exception as err:
        logger.exception("Error deleting backup: %s", str(err))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "BACKUP_DELETE_ERROR", "message": "Internal error"},
        )
