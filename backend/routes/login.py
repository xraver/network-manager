# backend/routes/login.py

# import standard modules
from fastapi import APIRouter, Request, Response, HTTPException, status
from fastapi.responses import FileResponse, RedirectResponse
import os
import time

# Import local modules
from backend.db.config import get_config
from backend.security import verify_login, apply_session, close_session

# Import Settings & Logging
from backend.settings.settings import settings

# Create Router
router = APIRouter()

# IP -> lista timestamp tentativi
login_attempts = {}

def check_rate_limit(ip: str):
    now = time.time()
    attempts = login_attempts.get(ip, [])
    # tieni solo tentativi negli ultimi LOGIN_WINDOW_SECONDS secondi
    attempts = [t for t in attempts if now - t < int(get_config("login_window_seconds"))]

    if len(attempts) >= int(get_config("login_max_attempts")):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "LOGIN_ERROR",
                "status": "failure",
                "message": "Too many login attempts"
            },
        )

    # registra nuovo tentativo
    attempts.append(now)
    login_attempts[ip] = attempts

# ---------------------------------------------------------
# FRONTEND PATHS (absolute paths inside Docker)
# ---------------------------------------------------------
# Login page
@router.get("/login")
def login_page(request: Request):
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "login.html"))

# Serve login.js
@router.get("/js/login.js")
def css_login():
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "js/login.js"))

# Serve session.js
@router.get("/js/session.js")
def css_login():
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "js/session.js"))

# ---------------------------------------------------------
# Login API
# ---------------------------------------------------------
@router.post("/api/login", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Login successful"},
    401: {"description": "Invalid credentials"},
    403: {"description": "Account locked"}, # GRGR TBD
    429: {"description": "Too many login attempts"},
    500: {"description": "Internal server error"},
})
def api_login(request: Request, data: dict, response: Response):
    ip = request.client.host
    check_rate_limit(ip)

    user = data.get("username")
    pwd = data.get("password")

    if verify_login(user, pwd):
        # reset tentativi su IP
        login_attempts.pop(ip, None)

        apply_session(response, username=user)
        response.status_code = status.HTTP_200_OK
        return {
            "code": "LOGIN_SUCCESS",
            "status": "success",
            "message": "Login successful",
        }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "code": "LOGIN_ERROR",
            "status": "failure",
            "message": "Invalid credentials",
        },
    )

# ---------------------------------------------------------
# Logout API
# ---------------------------------------------------------
@router.post("/api/logout", status_code=status.HTTP_200_OK, responses={
    200: {"description": "Logout successful"}
})
def api_logout(response: Response):
    close_session(response)
    response.status_code = status.HTTP_200_OK
    return {
        "code": "LOGOUT_SUCCESS",
        "status": "success",
        "message": "Logout successful",
    }
