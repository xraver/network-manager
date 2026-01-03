from fastapi import FastAPI
from fastapi import Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from itsdangerous import TimestampSigner
import secrets
import os
import ipaddress

# Import local models
from backend.db import (
    get_hosts,
    get_host,
    add_host,
    update_host,
    delete_host
)

app = FastAPI()

# Allow frontend JS to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Token signer for session management
SECRET_KEY = os.getenv("SESSION_SECRET", secrets.token_urlsafe(64))
signer = TimestampSigner(SECRET_KEY)

def require_login(request: Request):
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        signer.unsign(token, max_age=86400)
    except:
        raise HTTPException(status_code=401, detail="Invalid session")

# ---------------------------------------------------------
# FRONTEND PATHS (absolute paths inside Docker)
# ---------------------------------------------------------

FRONTEND_DIR = "/var/www/network-manager/frontend"

# Homepage
@app.get("/")
def home(request: Request):
    token = request.cookies.get("session")
    if not token:
        return RedirectResponse("/login")
    try:
        signer.unsign(token, max_age=86400)  # 24h
    except:
        return RedirectResponse("/login")
    return FileResponse(os.path.join(FRONTEND_DIR, "hosts.html"))

# Login
@app.get("/login")
def login_page():
    return FileResponse(os.path.join(FRONTEND_DIR, "login.html"))

# Hosts management
@app.get("/hosts")
def hosts(request: Request):
    token = request.cookies.get("session")
    if not token:
        return RedirectResponse("/login")
    try:
        signer.unsign(token, max_age=86400)
    except:
        return RedirectResponse("/login")
    return FileResponse(os.path.join(FRONTEND_DIR, "hosts.html"))

# Serve hosts.css
@app.get("/css/hosts.css")
def css_hosts():
    return FileResponse(os.path.join(FRONTEND_DIR, "css/hosts.css"))

# Serve login.css
@app.get("/css/login.css")
def css_login():
    return FileResponse(os.path.join(FRONTEND_DIR, "css/login.css"))

# Serve app.js
@app.get("/app.js")
def js():
    return FileResponse(os.path.join(FRONTEND_DIR, "app.js"))

# ---------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------

@app.post("/api/login")
def api_login(data: dict, response: Response):
    user = data.get("username")
    pwd = data.get("password")
    if user == "admin" and pwd == "admin":
        token = signer.sign(user).decode()
        response.set_cookie(
            "session",
            token,
            httponly=True,
            max_age=86400,
            path="/"
        )
        return {"status": "ok"}
    return {"error": "Invalid credentials"}

@app.post("/api/logout")
def api_logout(response: Response):
    response.delete_cookie("session")
    return {"status": "logged_out"}

@app.get("/api/hosts")
def api_get_hosts(request: Request):
    require_login(request)
    return get_hosts()

@app.post("/api/hosts")
def api_add_host(request: Request, data: dict):
    require_login(request)
    name = data.get("name", "").strip()
    ipv4 = data.get("ipv4")
    ipv6 = data.get("ipv6")
    if not name:
        return {"error": "Name is required"}
    if ipv4:
        try:
            ipaddress.IPv4Address(ipv4)
        except:
            return {"error": "Invalid IPv4 format"}
    if ipv6:
        try:
            ipaddress.IPv6Address(ipv6)
        except:
            return {"error": "Invalid IPv6 format"}
    return {"id": add_host(data)}

@app.get("/api/hosts/{host_id}")
def api_get_host(request: Request, host_id: int):
    require_login(request)
    return get_host(host_id) or {}

@app.put("/api/hosts/{host_id}")
def api_update_host(request: Request, data: dict, host_id: int):
    require_login(request)
    name = data.get("name", "").strip()
    ipv4 = data.get("ipv4")
    ipv6 = data.get("ipv6")
    if not name:
        return {"error": "Name is required"}
    if ipv4:
        try:
            ipaddress.IPv4Address(ipv4)
        except:
            return {"error": "Invalid IPv4 format"}
    if ipv6:
        try:
            ipaddress.IPv6Address(ipv6)
        except:
            return {"error": "Invalid IPv6 format"}
    update_host(host_id, data)
    return {"status": "ok"}

@app.delete("/api/hosts/{host_id}")
def api_delete_host(request: Request, host_id: int):
    require_login(request)
    delete_host(host_id)
    return {"status": "ok"}
