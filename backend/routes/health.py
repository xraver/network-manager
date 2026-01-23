# backend/health.py

# Import standard modules
from fastapi import APIRouter
import sqlite3
import time
import os
# Import Settings
from settings.settings import settings

# Create Router
router = APIRouter()

# ---------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------
@router.get("/api/health", tags=["health"])
def health():
    start = time.time()

    db_status = "ok"
    db_version = None
    db_tables = None
    db_size = None

    try:
        conn = sqlite3.connect(settings.DB_FILE)
        cursor = conn.cursor()

        cursor.execute("select sqlite_version()")
        db_version = cursor.fetchone()[0]

        cursor.execute("select count(*) from sqlite_master where type='table'")
        db_tables = cursor.fetchone()[0]

        conn.close()

        db_size = round(os.path.getsize(settings.DB_FILE) / (1024 * 1024), 2)

    except Exception as e:
        db_status = "error"
        db_version = str(e)

    latency = round((time.time() - start) * 1000, 2)

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "latency_ms": latency,
        "database": {
            "status": db_status,
            "version": db_version,
            "tables": db_tables,
            "size_mb": db_size
        }
    }
