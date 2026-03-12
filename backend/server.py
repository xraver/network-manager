# backend/server.py

# import standard modules
import uvicorn

# Import Settings & Logging
from backend.settings.settings import settings
from backend.log.log import setup_logging, get_logger

# Logger initialization
logger = get_logger(__name__)

# ------------------------------------------------------------------------------
# Starting the server with Uvicorn
# ------------------------------------------------------------------------------
def run_server(app):

    # Uvicorn config da settings with fallback
    host=(settings.HTTP_HOST or "0.0.0.0")
    port=int(settings.HTTP_PORT or 8000)
    log_level=(settings.LOG_LEVEL or "info").lower()
    workers = 1 # GRGR in prod valuta gunicorn+uvicorn workers
    #reload = os.getenv("UVICORN_RELOAD", "false").lower() == "true"
    reload = bool(getattr(settings, "DEV_RELOAD", False))

    logger.info(f"Server running on http://{host}:{port} (reload={reload}, log_level={log_level})")

    uvicorn.run(
        app,
        host=host,
        port=port,
        proxy_headers=True,
        forwarded_allow_ips="*",
        log_level=log_level,
        #access_log=True,
        log_config=None,
        workers=(1 if reload else workers),
        reload=reload,
    )
