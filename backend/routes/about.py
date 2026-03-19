# backend/about.py

# Import standard modules
from fastapi import APIRouter
from datetime import datetime, timezone

# Import local modules
from backend.db.config import get_config

# Import Settings
from backend.settings.settings import settings

# Create Router
router = APIRouter()

# ---------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------
@router.get("/about")
def about():
    return {
        "app": {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
        },
        "domain": settings.DOMAIN,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }
