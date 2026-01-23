# backend/main.py

# import standard modules
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse, Response
import logging
import os
# Import Routers
from backend.routes.about import router as about_router
from backend.routes.health import router as health_router
from backend.routes.login import router as login_router
from backend.routes.hosts import router as hosts_router
# Import Security
from backend.security import is_logged_in, apply_session
# Import Settings
from settings.settings import settings
# Import Logging
from log.log import setup_logging, get_logger

# ------------------------------------------------------------------------------
# Logging setup
# ------------------------------------------------------------------------------
setup_logging(settings.LOG_LEVEL, settings.LOG_TO_FILE, settings.LOG_FILE)
logger = get_logger(__name__)

# ------------------------------------------------------------------------------
# App init
# ------------------------------------------------------------------------------
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
)

# ------------------------------------------------------------------------------
# Routers
# ------------------------------------------------------------------------------
app.include_router(about_router)
app.include_router(health_router)
app.include_router(login_router)
app.include_router(hosts_router)

# ------------------------------------------------------------------------------
# Startup log
# ------------------------------------------------------------------------------
@app.on_event("startup")
async def startup_log():
    logger = get_logger(__name__)

    safe_secret = "****" if settings.SECRET_KEY else "undefined"
    safe_admin_pwd = "****" if settings.ADMIN_PASSWORD else "undefined"
    safe_admin_hash = "****" if settings.ADMIN_PASSWORD_HASH else "undefined"

    logger.info(
        "%s starting | app_version=%s | baseimg_version=%s",
        settings.APP_NAME, settings.APP_VERSION, settings.BASEIMG_VERSION
    )
    logger.info(
        "App settings: frontend=%s | port=%d | secret=%s",
        settings.FRONTEND_DIR, settings.HTTP_PORT, safe_secret
    )
    logger.info(
        "Database: file=%s | reset=%s",
        settings.DB_FILE, settings.DB_RESET
    )
    logger.info(
        "Log: level=%s, to_file=%s, file=%s",
        settings.LOG_LEVEL, settings.LOG_TO_FILE, settings.LOG_FILE
    )
    logger.info(
        "Users: admin=%s | password=%s | hash=%s | hash_file=%s",
        settings.ADMIN_USER, safe_admin_pwd, safe_admin_hash, settings.ADMIN_PASSWORD_HASH_FILE
    )

# ------------------------------------------------------------------------------
# CORS
# ------------------------------------------------------------------------------
cors_origins = [
    f"http://localhost:{settings.HTTP_PORT}",
    f"http://127.0.0.1:{settings.HTTP_PORT}",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=True,
)

# ------------------------------------------------------------------------------
# Session / Auth middleware
# ------------------------------------------------------------------------------
@app.middleware("http")
async def session_middleware(request: Request, call_next):
    path = request.url.path
    token = request.cookies.get("session")

    # Excludes the login methods
    if path.startswith("/login") or path.startswith("/api/login"):
        return await call_next(request)

    # Excludes static files
    if (
        path.startswith("/css") or
        path.startswith("/js") or
        path.startswith("/static") or
        path.endswith((".js", ".css", ".png", ".jpg", ".jpeg", ".ico", ".svg", ".map"))
    ):
        return await call_next(request)

    # Protected APIs
    if path.startswith("/api"):
        if not is_logged_in(request):
            return JSONResponse({"error": "Not authenticated"}, status_code=401)
        response = await call_next(request)
        # Sliding expiration
        apply_session(response, username=None, token=token)
        return response

    # Protected HTML pages
    if not is_logged_in(request):
        return RedirectResponse("/login")

    response = await call_next(request)
    # Sliding expiration
    apply_session(response, username=None, token=token)
    return response

# ------------------------------------------------------------------------------
# FRONTEND (FileResponse): pages and assets
# ------------------------------------------------------------------------------
# Homepage
@app.get("/")
def home(request: Request):
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "hosts.html"))

# CSS variables
@app.get("/css/variables.css")
def css_variables(request: Request):
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "css/variables.css"))

# CSS Layout
@app.get("/css/layout.css")
def css_layout(request: Request):
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "css/layout.css"))

