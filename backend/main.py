# backend/main.py

# import standard modules
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse
import os
# Import local modules
from backend.security import is_logged_in, apply_session
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
# Middleware to manage Login
# ---------------------------------------------------------

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
        path.endswith(".js") or
        path.endswith(".css") or
        path.endswith(".png") or
        path.endswith(".jpg") or
        path.endswith(".ico")
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

# ---------------------------------------------------------
# FRONTEND PATHS (absolute paths inside Docker)
# ---------------------------------------------------------

# Homepage
@app.get("/")
def home(request: Request):
    return FileResponse(os.path.join(FRONTEND_DIR, "hosts.html"))

# Serve app.js
@app.get("/app.js")
def js():
    return FileResponse(os.path.join(FRONTEND_DIR, "app.js"))
