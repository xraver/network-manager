# backend/main.py

# import standard modules
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware
import logging
import os
# Import Routers
from backend.routes.about import router as about_router
from backend.routes.backup import router as backup_router
from backend.routes.health import router as health_router
from backend.routes.login import router as login_router
from backend.routes.hosts import router as hosts_router
from backend.routes.aliases import router as aliases_router
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
    masked_secret = "****" if settings.SECRET_KEY else "undefined"
    masked_admin_pwd = "****" if settings.ADMIN_PASSWORD else "undefined"
    masked_admin_hash = "****" if settings.ADMIN_PASSWORD_HASH else "undefined"

    logger.info(
        "%s starting | app_version=%s | baseimg_version=%s",
        settings.APP_NAME, settings.APP_VERSION, settings.BASEIMG_VERSION
    )
    logger.info(
        "App settings: frontend=%s | port=%d | secret=%s",
        settings.FRONTEND_DIR, settings.HTTP_PORT, masked_secret
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
        settings.ADMIN_USER, masked_admin_pwd, masked_admin_hash, settings.ADMIN_PASSWORD_HASH_FILE
    )
    logger.info(
        "DNS: host file=%s | alias file=%s | reverse file=%s",
        settings.DNS_HOST_FILE, settings.DNS_ALIAS_FILE, settings.DNS_REVERSE_FILE
    )
    logger.info(
        "DHCP: ipv4 host file=%s | ipv4 leases file=%s | ipv6 host file=%s | ipv6 leases file=%s",
        settings.DHCP4_HOST_FILE, settings.DHCP4_LEASES_FILE, settings.DHCP6_HOST_FILE, settings.DHCP6_LEASES_FILE
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
app.include_router(backup_router)
app.include_router(health_router)
app.include_router(login_router)
app.include_router(hosts_router)
app.include_router(aliases_router)
app.include_router(dns_router)
app.include_router(dhcp_router)

# ------------------------------------------------------------------------------
# CORS
# ------------------------------------------------------------------------------
cors_origins = [
    f"http://localhost:{settings.HTTP_PORT}",
    f"http://127.0.0.1:{settings.HTTP_PORT}",
    # aggiungi qui host reali quando servi da hostname:
    # "http://miohost:8000", "https://dominio.tld"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=True,
)

# ------------------------------------------------------------------------------
# Security Headers middleware (basic hardening)
# ------------------------------------------------------------------------------
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        # Hardening base
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=(), payment=(), usb=(), "
            "accelerometer=(), autoplay=(), clipboard-read=(), clipboard-write=()"
        )

        # HSTS (richiede HTTPS)
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )

        # COOP / CORP isolano la pagina (protezione anti-XSS/XFO)
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"

        # CSP rigida per produzione
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "base-uri 'self'; "
            "object-src 'none'; "
            "frame-ancestors 'none'; "
            "img-src 'self' data:; "
            "font-src 'self' data:; "
            "style-src 'self'; "
            "script-src 'self'; "
            "connect-src 'self'; "
            "manifest-src 'self'; "
            "worker-src 'self'"
        )
        return response

# GRGR -> to be enabled in production
#app.add_middleware(SecurityHeadersMiddleware)

# ------------------------------------------------------------------------------
# Public paths
# ------------------------------------------------------------------------------
PUBLIC_PATHS = (
    "/login",
    "/api/login",
    "/logout",
    "/api/logout",
    "/about",
    "/api/health",
    "/docs",
    "/openapi.json",
)

STATIC_PREFIXES = (
    "/css",
    "/js",
    "/static",
)

STATIC_SUFFIXES = (".js", ".css", ".png", ".jpg", ".jpeg", ".ico", ".svg", ".map")

# ------------------------------------------------------------------------------
# Session / Auth middleware
# ------------------------------------------------------------------------------
@app.middleware("http")
async def session_middleware(request: Request, call_next):
    path = request.url.path
    method = request.method.upper()

    # 1) Always let CORS preflight through (browsers send OPTIONS before real requests)
    if method == "OPTIONS":
        return await call_next(request)

    # 2) Skip public endpoints (login/logout/about/health/docs/openapi)
    if path.startswith(PUBLIC_PATHS):
        return await call_next(request)

    # 3) Skip static assets
    if path.startswith(STATIC_PREFIXES) or path.endswith(STATIC_SUFFIXES):
        return await call_next(request)

    # 4) Read session token from cookie (adjust name if different)
    token = request.cookies.get("session")

    # 5) Check authentication (your function should validate the cookie/session)
    authenticated = is_logged_in(request)

    # 6) Protect JSON APIs
    if path.startswith("/api"):
        if not authenticated:
            logger.warning("API access denied - not logged in: %s %s", method, path)
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                headers={"WWW-Authenticate": "Session"},
                content={
                    "detail": {
                        "code": "UNAUTHORIZED",
                        "status": "failure",
                        "message": "Unauthorized",
                        "path": path,
                    }
                },
            )

        # Optionally attach user info to request.state for downstream handlers
        # request.state.user = <current_user>

        # Call the downstream route/handler
        response = await call_next(request)

        # Apply sliding expiration only on successful responses (2xx) and if a token exists
        if token and 200 <= response.status_code < 300:
            apply_session(response, username=None, token=token)
        return response

    # 7) Protect HTML pages (non-API): redirect unauthenticated users to login
    if not authenticated:
        # 303 See Other avoids reusing POST/other methods
        return RedirectResponse("/login", status_code=status.HTTP_303_SEE_OTHER)

    # 8) Authenticated HTML request ? proceed
    response = await call_next(request)

    # 9) Apply sliding expiration only on successful responses (2xx)
    if token and 200 <= response.status_code < 300:
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

# JS Common
@app.get("/js/common.js")
def js_common(request: Request):
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "js/common.js"))

# JS Services
@app.get("/js/services.js")
def js_services(request: Request):
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "js/services.js"))

# favicon
@app.get("/favicon.ico")
def favicon(request: Request):
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "favicon.ico"))

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
