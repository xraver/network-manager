# backend/routes/hosts.py

# import standard modules
from fastapi import APIRouter, Request, HTTPException, Query
from fastapi.responses import FileResponse, PlainTextResponse
from pathlib import Path

# Import local modules

# Import Settings
from backend.settings.settings import settings
# Import Logging
from backend.log.log import get_logger

# Logger initialization
logger = get_logger(__name__)

LOG_FILES = {
    "app": settings.LOG_FILE,
    "access": settings.LOG_ACCESS_FILE,
    #"dhcp": Path("/var/log/kea/kea-dhcp4.log"),
    #"dns": Path("/var/log/named/named.log"),
}

# Create Router
router = APIRouter()

# ---------------------------------------------------------
# FRONTEND PATHS (absolute paths inside Docker)
# ---------------------------------------------------------
# Hosts page
@router.get("/logs")
def hosts_page(request: Request):
    return FileResponse(settings.FRONTEND_PATH / "logs.html")

# Serve hosts.js
@router.get("/js/logs.js")
def hosts_js():
    return FileResponse(settings.FRONTEND_PATH / "js/logs.js")

# ---------------------------------------------------------
# Internal: File tail
# ---------------------------------------------------------
def tail_file(path: Path, lines: int = 200) -> str:
    """
    Legge le ultime N righe in modo efficiente
    """
    with open(path, "rb") as f:
        f.seek(0, 2)  # vai a fine file
        file_size = f.tell()

        buffer = bytearray()
        pointer = file_size - 1
        line_count = 0

        while pointer >= 0 and line_count < lines:
            f.seek(pointer)
            byte = f.read(1)

            if byte == b"\n":
                line_count += 1

            buffer.extend(byte)
            pointer -= 1

        buffer.reverse()
        return buffer.decode(errors="ignore")

# ---------------------------------------------------------
# Get Logs
# ---------------------------------------------------------
@router.get("/api/logs", response_class=PlainTextResponse)
def get_logs(
    type: str = Query("app", pattern="^(app|access|dhcp|dns)$"),
    lines: int = Query(200, ge=10, le=5000)
):
    log_path = LOG_FILES.get(type)

    if not log_path or not log_path.exists():
        logger.error(f"Log file not found: {type}")
        raise HTTPException(status_code=404, detail=f"Log file not found: {type}")

    try:
        return tail_file(log_path, lines)
    except Exception as e:
        logger.exception("Error reading log")
        raise HTTPException(status_code=500, detail=str(e))
