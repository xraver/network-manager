# backend/about.py

# Import standard modules
from fastapi import APIRouter
# Import Settings
from settings.settings import settings

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
        "baseimg": {
            "name": settings.BASEIMG_NAME,
            "version": settings.BASEIMG_VERSION,
        },
        "domain": settings.DOMAIN,
        "admin_hash_loaded": settings.ADMIN_PASSWORD_HASH is not None,
    }
