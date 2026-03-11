# backend/main.py

# Import standard modules
import os
# Import backend modules
from backend.bootstrap import bootstrap
from backend.app import create_app
from backend.server import run_server

# ------------------------------------------------------------------------------
# Main: entry point of the application
# ------------------------------------------------------------------------------
def main():

    # 1) System Initialization (Settings, Logging, DB, etc.)
    bootstrap()

    # 2) Costruzione app FastAPI
    app = create_app()

    # 4) Uvicorn Start
    run_server(app)

if __name__ == "__main__":
    main()
