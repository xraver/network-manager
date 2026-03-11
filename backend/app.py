# backend/app.py

# import standard modules
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable
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

# Import Settings & Logging
from settings.settings import settings
from log.log import get_logger

# Logger initialization
logger = get_logger(__name__)

# ------------------------------------------------------------------------------
# Security Headers middleware (basic hardening)
# ------------------------------------------------------------------------------
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
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
# FRONTEND Handlers
# ------------------------------------------------------------------------------
# Homepage
def home(request: Request):
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "hosts.html"))

# CSS variables
def css_variables(request: Request):
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "css/variables.css"))

# CSS Layout
def css_layout(request: Request):
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "css/layout.css"))

# JS Common
def js_common(request: Request):
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "js/common.js"))

# JS Services
def js_services(request: Request):
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "js/services.js"))

# favicon
def favicon(request: Request):
    return FileResponse(os.path.join(settings.FRONTEND_DIR, "favicon.ico"))

# ------------------------------------------------------------------------------
# Creates and configures the FastAPI app
# ------------------------------------------------------------------------------
def create_app() -> FastAPI:

    # App init
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
    )

    # Routers
    app.include_router(about_router)
    app.include_router(backup_router)
    app.include_router(health_router)
    app.include_router(login_router)
    app.include_router(hosts_router)
    app.include_router(aliases_router)
    app.include_router(dns_router)
    app.include_router(dhcp_router)

    # CORS
    cors_origins = [
        f"http://localhost:{settings.HTTP_PORT}",
        f"http://127.0.0.1:{settings.HTTP_PORT}",
        # Aggiungi qui eventuali host reali:
        # "http://miohost:8000", "https://dominio.tld"
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        allow_credentials=True,
    )

    # Security headers (GRGR -> to be enabled in production)
    # app.add_middleware(SecurityHeadersMiddleware)

    # Session/Auth middleware (funzionale)
    app.middleware("http")(session_middleware)

    # Route per file del frontend
    app.add_api_route("/", home, methods=["GET"])
    app.add_api_route("/css/variables.css", css_variables, methods=["GET"])
    app.add_api_route("/css/layout.css", css_layout, methods=["GET"])
    app.add_api_route("/js/common.js", js_common, methods=["GET"])
    app.add_api_route("/js/services.js", js_services, methods=["GET"])
    app.add_api_route("/favicon.ico", favicon, methods=["GET"])

    return app
