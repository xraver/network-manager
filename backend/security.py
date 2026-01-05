# backend/security.py

# import standard modules
import os
from fastapi import Request, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from itsdangerous import TimestampSigner
# Import config variables
from backend.config import FRONTEND_DIR, SECRET_KEY

signer = TimestampSigner(SECRET_KEY)

# -----------------------------
# login check
# -----------------------------
def is_logged_in(request: Request) -> bool:
    token = request.cookies.get("session")
    if not token:
        return False
    try:
        signer.unsign(token, max_age=86400)
        return True
    except:
        return False

# -----------------------------
# login check (for api)
# -----------------------------
def require_login(request: Request):
    if not is_logged_in(request):
        raise HTTPException(status_code=401, detail="Not authenticated")

# -----------------------------
# login check (for html)
# -----------------------------
def html_protected(request: Request, filename: str):
    if not is_logged_in(request):
        return RedirectResponse("/login")
    return FileResponse(os.path.join(FRONTEND_DIR, filename))