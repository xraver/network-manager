# backend/health.py

from fastapi import APIRouter

# Create Router
router = APIRouter()

# ---------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------

@router.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
