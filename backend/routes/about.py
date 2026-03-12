# backend/about.py

# Import standard modules
from fastapi import APIRouter

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
            "version": settings.APP_VERSION,
        },
        "domain": settings.DOMAIN,
    }
