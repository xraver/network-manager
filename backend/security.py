# backend/security.py

# Import standard modules
import bcrypt
import os
from fastapi import Request, HTTPException
from itsdangerous import TimestampSigner
# Import local modules
from backend.db.users import get_user_by_username
# Import Settings
from settings.settings import settings
# Import Log
from log.log import get_logger

signer = TimestampSigner(settings.SECRET_KEY)

# -----------------------------
# Verify Login
# -----------------------------
def verify_login(username, password):
    logger = get_logger(__name__)
    user = get_user_by_username(username)
    if not user:
        logger.error("Login failed - user %s not found", username)
        return False

    if user["status"] != "active":
        logger.error("Login Failed - user %s disabled", username)
        return False

    if not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        logger.error("Login Failed - password wrong for user %s", username)
        return False

    logger.info("Login successful - user %s", username)
    return True

# ----------------------------
# creates or renew the cookie
# ----------------------------
def apply_session(response, username: str | None = None, token: str | None = None):
    logger = get_logger(__name__)

    # First Login
    if username is not None and token is None:
        token = signer.sign(username).decode()
        logger.info("Session created - %s", username)

    if username is None:
        username = signer.unsign(token, max_age=86400).decode()
        logger.info("Session updated - %s", username)

    if username is None or token is None:
        logger.error("Session Error - missing username or token")
        return

    response.set_cookie(
        "session",
        token,
        httponly=True,
        max_age=86400,
        path="/",
        #secure=True, # GRGR solo via HTTPS
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
# Close Session
# -----------------------------
def close_session(response):
    logger = get_logger(__name__)
    
    response.delete_cookie(
        key="session",
        path="/"
    )

    logger.info("Session closed")
