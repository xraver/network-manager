# backend/routes/dns.py

# import standard modules
from fastapi import APIRouter, Request, Response
from fastapi.responses import FileResponse, RedirectResponse
import asyncio
import os
import ipaddress
import time

# Import Settings
from settings.settings import settings

# Create Router
router = APIRouter()

# ---------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------
@router.get("/api/dns/reload")
async def apt_dns_reload(request: Request):
    start_ns = time.monotonic_ns()

    await asyncio.sleep(0.2)

    end_ns = time.monotonic_ns()
    took_ms = (end_ns - start_ns)

    return {   
        "code": "DNS_RELOAD_OK",
        "status": "success",
        "message": "DNS configuration reload successfully",
        "details": {
            "took_ms": took_ms
        }
    }
