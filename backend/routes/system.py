# backend/about.py

# Import standard modules
from fastapi import APIRouter
from datetime import datetime, timezone
import os
import signal
import threading
import time

# Import Settings & Config
from backend.settings.settings import settings
from backend.db.settings import get_config

# Create Router
router = APIRouter()

# ---------------------------------------------------------
# Get Information
# ---------------------------------------------------------
@router.get("/about")
def about():
    return {
        "app": {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
        },
        "domain": get_config("DOMAIN"),
        "server_time": datetime.now(timezone.utc).isoformat(),
    }

# ---------------------------------------------------------
# Restart Application
# ---------------------------------------------------------
@router.post("/api/restart")
def restart():
    def do_restart():
        time.sleep(0.5)
        os.kill(os.getpid(), signal.SIGTERM)

    threading.Thread(target=do_restart, daemon=True).start()

    return {"message": "Application restarting..."}
