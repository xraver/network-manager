# backend/security.py

# Import standard modules
import bcrypt
import os
from fastapi import Request, HTTPException
from itsdangerous import TimestampSigner
# Import local modules
from backend.db.users import get_user_by_username
from backend.utils import log_event
# Import config variables
from backend.config import FRONTEND_DIR, SECRET_KEY

signer = TimestampSigner(SECRET_KEY)

# -----------------------------
# Verify Login
# -----------------------------
def verify_login(username, password):
    user = get_user_by_username(username)
    if not user:
        log_event("LOGIN failed - user not found", user=username)
        return False

    if user["status"] != "active":
        log_event("LOGIN Failed - user disabled", user=username)
        return False

    if not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        log_event("LOGIN Failed - password wrong", user=username)
        return False

    log_event("LOGIN", user=username)
    return True

# ----------------------------
# creates or renew the cookie
# ----------------------------
def apply_session(response, username: str | None = None, token: str | None = None):

    # First Login
    if username is not None and token is None:
        token = signer.sign(username).decode()
        log_event("SESSION_CREATE", user=username)

    if username is None:
        username = signer.unsign(token, max_age=86400).decode()
        log_event("SESSION_UPDATE", user=username)

    if username is None or token is None:
        log_event("SESSION_ERROR")
        return

    response.set_cookie(
        "session",
        token,
        httponly=True,
        max_age=86400,
        path="/",
        #secure=True, # solo via HTTPS
        samesite="Strict"
    )

# -----------------------------
# check session cookie
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
# check login
# -----------------------------
def require_login(request: Request):
    if not is_logged_in(request):
        raise HTTPException(status_code=401, detail="Not authenticated")
