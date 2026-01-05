# backend/routes/login.py

# import standard modules
from fastapi import APIRouter, Request, Response
from fastapi.responses import FileResponse, RedirectResponse
import os
import time
# Import local modules
from backend.security import is_logged_in, signer
from backend.db.users import verify_login
# Import config variables
from backend.config import FRONTEND_DIR, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_SECONDS

router = APIRouter()

# IP -> lista timestamp tentativi 
login_attempts = {}

def check_rate_limit(ip: str):
    now = time.time()
    attempts = login_attempts.get(ip, [])
    # tieni solo tentativi negli ultimi LOGIN_WINDOW_SECONDS secondi
    attempts = [t for t in attempts if now - t < LOGIN_WINDOW_SECONDS]

    if len(attempts) >= LOGIN_MAX_ATTEMPTS:
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
    if is_logged_in(request):
        return RedirectResponse("/")
    return FileResponse(os.path.join(FRONTEND_DIR, "login.html"))

# Serve login.css
@router.get("/css/login.css")
def css_login():
    return FileResponse(os.path.join(FRONTEND_DIR, "css/login.css"))

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

        token = signer.sign(user).decode()
        response.set_cookie(
            "session",
            token,
            httponly=True,
            max_age=86400,
            path="/",
            #secure=True, # solo via HTTPS
            samesite="Strict"
        )
        return {"status": "ok"}

    return {"error": "Invalid credentials"}

@router.post("/api/logout")
def api_logout(response: Response):
    response.delete_cookie("session")
    return {"status": "logged_out"}
