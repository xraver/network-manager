# backend/main.py

# import standard modules
from contextlib import asynccontextmanager
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
from backend.routes.dns import router as dns_router
from backend.routes.dhcp import router as dhcp_router
# Import Security
from backend.security import is_logged_in, apply_session
# Import Settings
from settings.settings import settings
# Import Logging
from log.log import setup_logging, get_logger

# ------------------------------------------------------------------------------
# Logging setup
# ------------------------------------------------------------------------------
setup_logging(level=settings.LOG_LEVEL, to_file=settings.LOG_TO_FILE, log_file=settings.LOG_FILE, log_access_file=settings.LOG_ACCESS_FILE)
logger = get_logger("backend.main")

# ------------------------------------------------------------------------------
# Welcome log
# ------------------------------------------------------------------------------
def print_welcome():
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
# Shutdown log
# ------------------------------------------------------------------------------
def print_goodbye():
    logger = get_logger("backend.main")

    logger.info(
        "Application %s shutting down | app_version=%s",
        settings.APP_NAME, settings.APP_VERSION
    )

# ------------------------------------------------------------------------------
# Lifespan for startup and shutdown events
# ------------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP
    print_welcome()

    try:
        yield
    finally:
        # SHUTDOWN
        print_goodbye()

# ------------------------------------------------------------------------------
# App init
# ------------------------------------------------------------------------------
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# ------------------------------------------------------------------------------
# Routers
# ------------------------------------------------------------------------------
app.include_router(about_router)
app.include_router(health_router)
app.include_router(login_router)
app.include_router(hosts_router)
app.include_router(dns_router)
app.include_router(dhcp_router)

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

    # Excludes the login/logout methods
    if path.startswith("/login") or path.startswith("/api/login") or \
       path.startswith("/logout") or path.startswith("/api/logout"):
        return await call_next(request)

    # Excludes the about & health methods
    if path.startswith("/about") or path.startswith("/api/health"):
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
            logger.error("API access denied - not logged in")
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
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

# ------------------------------------------------------------------------------
# Entry-point
# ------------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    # Uvicorn config da settings con fallback
    host = getattr(settings, "HTTP_HOST", "0.0.0.0")
    port = int(getattr(settings, "HTTP_PORT", 8000))
    reload_flag = bool(getattr(settings, "DEV_RELOAD", False))

    logger.info(f"Server running on http://{host}:{port} (reload={reload_flag})")

    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=reload_flag,
        proxy_headers=True,
        forwarded_allow_ips="*",
        log_level=(settings.LOG_LEVEL or "info").lower(),
        #access_log=True,
        log_config=None,
        # workers=1,                # GRGR in prod valuta gunicorn+uvicorn workers
    )
