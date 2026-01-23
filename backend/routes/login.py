# backend/routes/login.py

# import standard modules
from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
import os
import time
# Import local modules
from backend.security import verify_login, apply_session
# Import Settings
from settings.settings import settings

# Create Router
router = APIRouter()

# IP -> lista timestamp tentativi 
login_attempts = {}

def check_rate_limit(ip: str):
    now = time.time()
    attempts = login_attempts.get(ip, [])
    # tieni solo tentativi negli ultimi LOGIN_WINDOW_SECONDS secondi
    attempts = [t for t in attempts if now - t < settings.LOGIN_WINDOW_SECONDS]

    if len(attempts) >= settings.LOGIN_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many login attempts")

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

# Serve login.css
@router.get("/css/login.css")
def css_login():
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "css/login.css"))

# Serve login.js
@router.get("/js/login.js")
def css_login():
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "js/login.js"))

# Serve session.js
@router.get("/js/session.js")
def css_login():
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "js/session.js"))

# ---------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------
@router.post("/api/login")
def api_login(request: Request, data: dict, response: Response):
    ip = request.client.host
    check_rate_limit(ip)

    user = data.get("username")
    pwd = data.get("password")

    if verify_login(user, pwd):
        # reset tentativi su IP 
        login_attempts.pop(ip, None)

        apply_session(response, username=user)
        return {"status": "ok"}

    return {"error": "Wrong credentials"}

@router.post("/api/logout")
def api_logout(response: Response):
    response.delete_cookie("session")
    return {"status": "logged_out"}
