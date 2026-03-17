# backend/security.py

# Import standard modules
import bcrypt
import os
from fastapi import Request, HTTPException
from itsdangerous import TimestampSigner

# Import local modules
from backend.db.users import get_user_by_username

# Import Settings & Logging
from backend.settings.settings import settings
from backend.log.log import setup_logging, get_logger

# Logger initialization
logger = get_logger(__name__)

signer = TimestampSigner(settings.SECRET_KEY)

# -----------------------------
# Verify Login
# -----------------------------
def verify_login(username, password):

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

    logger.debug("Login successful - user %s", username)
    return True

# ----------------------------
# creates or renew the cookie
# ----------------------------
def apply_session(response, username: str | None = None, token: str | None = None):

    # First Login
    if username is not None and token is None:
        token = signer.sign(username).decode()
        logger.debug("Session created - %s", username)

    if username is None:
        username = signer.unsign(token, max_age=86400).decode()
        logger.debug("Session updated - %s", username)

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

    response.delete_cookie(
        key="session",
        path="/"
    )

    logger.debug("Session closed")
