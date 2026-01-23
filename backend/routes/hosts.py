# backend/routes/hosts.py

# import standard modules
from fastapi import APIRouter, Request, Response
from fastapi.responses import FileResponse, RedirectResponse
import os
import ipaddress
# Import local modules
from backend.db.hosts import (
    get_hosts,
    get_host,
    add_host,
    update_host,
    delete_host
)
# Import Settings
from settings.settings import settings

# Create Router
router = APIRouter()

# ---------------------------------------------------------
# FRONTEND PATHS (absolute paths inside Docker)
# ---------------------------------------------------------
# Hosts page
@router.get("/hosts")
def hosts(request: Request):
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "hosts.html"))

# Serve hosts.css
@router.get("/css/hosts.css")
def css_hosts():
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "css/hosts.css"))

# Serve hosts.js
@router.get("/js/hosts.js")
def css_hosts():
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "js/hosts.js"))

# ---------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------
@router.get("/api/hosts")
def api_get_hosts(request: Request):
    return get_hosts()

@router.post("/api/hosts")
def api_add_host(request: Request, data: dict):
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

@router.get("/api/hosts/{host_id}")
def api_get_host(request: Request, host_id: int):
    return get_host(host_id) or {}

@router.put("/api/hosts/{host_id}")
def api_update_host(request: Request, data: dict, host_id: int):
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

@router.delete("/api/hosts/{host_id}")
def api_delete_host(request: Request, host_id: int):
    delete_host(host_id)
    return {"status": "ok"}
