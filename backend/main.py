from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
import ipaddress

# Import models
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

# ---------------------------------------------------------
# FRONTEND PATHS (absolute paths inside Docker)
# ---------------------------------------------------------

FRONTEND_DIR = "/app/frontend"

# Homepage
@app.get("/")
def index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

# Serve style.css
@app.get("/style.css")
def css():
    return FileResponse(os.path.join(FRONTEND_DIR, "style.css"))

# Serve app.js
@app.get("/app.js")
def js():
    return FileResponse(os.path.join(FRONTEND_DIR, "app.js"))

# ---------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------

@app.get("/api/hosts")
def api_get_hosts():
    return get_hosts()

@app.post("/api/hosts")
def api_add_host(data: dict):
    name = data.get("name", "").strip()
    ipv4 = data.get("ipv4")
    ipv6 = data.get("ipv6")

    # Check input
    if not name:
        return {"error": "Name is required"}

    # Validate IPv4
    if ipv4:
        try:
            ipaddress.IPv4Address(ipv4)
        except:
            return {"error": "Invalid IPv4 format"}

    # Validate IPv6
    if ipv6:
        try:
            ipaddress.IPv6Address(ipv6)
        except:
            return {"error": "Invalid IPv6 format"}

    return {"id": add_host(data)}

@app.get("/api/hosts/{host_id}")
def api_get_host(host_id: int):
    return get_host(host_id) or {}

@app.put("/api/hosts/{host_id}")
def api_update_host(host_id: int, data: dict):
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
def api_delete_host(host_id: int):
    delete_host(host_id)
    return {"status": "ok"}
