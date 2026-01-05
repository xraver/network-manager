# backend/main.py

# import standard modules
from fastapi import FastAPI
from fastapi import Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
import os
# Import local modules
from backend.security import is_logged_in, require_login, html_protected
from backend.db.hosts import (
    get_hosts,
    get_host,
    add_host,
    update_host,
    delete_host
)
from backend.routes.health import router as health_router
from backend.routes.login import router as login_router
from backend.routes.hosts import router as hosts_router
# Import config variables
from backend.config import FRONTEND_DIR, HTTP_PORT

# Start FastAPI app
app = FastAPI()
app.include_router(health_router)
app.include_router(login_router)
app.include_router(hosts_router)

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

# Serve app.js
@app.get("/app.js")
def js():
    return FileResponse(os.path.join(FRONTEND_DIR, "app.js"))
