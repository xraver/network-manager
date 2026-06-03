# backend/routes/backup.py

# import standard modules
from fastapi import APIRouter, HTTPException, status, UploadFile, File
from fastapi.responses import Response, JSONResponse, FileResponse
from pathlib import Path
from pydantic import BaseModel
import shutil
import time
from typing import Dict, Any
import zipfile

# Import local modules
from backend.backup import backup_create, backup_list, backup_restore, backup_delete

# Import Settings & Config
from backend.settings.settings import settings
from backend.db.settings import get_config
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
# API: Create Backup
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

# ---------------------------------------------------------
# API: Download backup
# ---------------------------------------------------------
@router.get("/api/backup/download/{backup_id}")
def download_backup(backup_id: str):
    backup_dir = Path(get_config("BACKUP_PATH"))

    zip_path = backup_dir / f"{backup_id}"

    if not zip_path.exists():
        raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "BACKUP_NOT_FOUND",
                    "status": "failure",
                    "message": "Backup not found",
                },
            )

    return FileResponse(
        path=zip_path,
        filename=zip_path.name,
        media_type="application/zip"
    )

# ---------------------------------------------------------
# API: Upload backup
# ---------------------------------------------------------
@router.post("/api/backup/upload")
def upload_backup(file: UploadFile = File(...)):

    # Initialization
    start_ns = time.monotonic_ns()

    if not file.filename.endswith(".zip"):
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "BACKUP_UPLOAD_FAILED",
                    "status": "failure",
                    "message": "Only ZIP files allowed",
                    "took_ms": took_ms,
                },
            )

    backup_dir = Path(get_config("BACKUP_PATH"))
    backup_dir.mkdir(parents=True, exist_ok=True)

    # safe filename
    safe_name = Path(file.filename).name
    target_path = backup_dir / safe_name

    # prevent overwrite
    if target_path.exists():
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "BACKUP_UPLOAD_FAILED",
                    "status": "failure",
                    "message": "Backup already exists",
                    "took_ms": took_ms,
                },
            )

    # validate ZIP
    import zipfile
    try:
        with zipfile.ZipFile(file.file) as z:
            if z.testzip() is not None:
                took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
                raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail={
                            "code": "BACKUP_UPLOAD_FAILED",
                            "status": "failure",
                            "message": "Corrupted ZIP file",
                            "took_ms": took_ms,
                        },
                    )

    except zipfile.BadZipFile:
        took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
        raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "BACKUP_UPLOAD_FAILED",
                    "status": "failure",
                    "message": "Invalid ZIP file",
                    "took_ms": took_ms,
                },
            )

    # reset pointer after validation
    file.file.seek(0)

    # save file
    with target_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    backup_id = safe_name.replace(".zip", "")

    took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

    return {
        "code": "BACKUP_UPLOADED",
        "status": "success",
        "message": "Backup uploaded successfully",
        "took_ms": took_ms,
        "backup_id": backup_id,
    }
