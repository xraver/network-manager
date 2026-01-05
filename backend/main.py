# backend/main.py

# import standard modules
from fastapi import FastAPI
from fastapi import Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
import os
import ipaddress
# Import local modules
from backend.security import is_logged_in, require_login
from backend.db.hosts import (
    get_hosts,
    get_host,
    add_host,
    update_host,
    delete_host
)
from backend.routes.health import router as health_router
from backend.routes.login import router as login_router
# Import config variables
from backend.config import FRONTEND_DIR, HTTP_PORT

# Start FastAPI app
app = FastAPI()
app.include_router(health_router)
app.include_router(login_router)

# Allow frontend JS to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        f"http://localhost:{HTTP_PORT}",
        f"http://127.0.0.1:{HTTP_PORT}", 
    ],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)

# ---------------------------------------------------------
# FRONTEND PATHS (absolute paths inside Docker)
# ---------------------------------------------------------

# Protect html pages
def html_protected(request: Request, filename: str):
    if not is_logged_in(request):
        return RedirectResponse("/login")
    return FileResponse(os.path.join(FRONTEND_DIR, filename))

# Homepage
@app.get("/")
def home(request: Request):
    return html_protected(request, "hosts.html")

# Hosts page
@app.get("/hosts")
def hosts(request: Request):
    return html_protected(request, "hosts.html")

# Serve hosts.css
@app.get("/css/hosts.css")
def css_hosts():
    return FileResponse(os.path.join(FRONTEND_DIR, "css/hosts.css"))

# Serve app.js
@app.get("/app.js")
def js():
    return FileResponse(os.path.join(FRONTEND_DIR, "app.js"))

# ---------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------

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
