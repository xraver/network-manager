# backend/routes/certificates.py

# import standard modules
from fastapi import APIRouter, Request, Response, HTTPException, status
from fastapi.responses import FileResponse
import ipaddress
import time
import os

# Import local modules
from backend.db.hosts import get_hosts_certificates
from backend.db.aliases import get_aliases_certificates

# Import Settings & Logging
from backend.settings.settings import settings
from backend.log.log import setup_logging, get_logger

# Logger initialization
logger = get_logger(__name__)

# Create Router
router = APIRouter()

# ---------------------------------------------------------
# Prepare the output
# ---------------------------------------------------------
def build_cert_domain(hosts, aliases, domain: str):
    combined = hosts + aliases
    return [f"{item['name']}.{domain}" for item in combined]

# ---------------------------------------------------------
# Get Domain Name with Certificates
# ---------------------------------------------------------
@router.get("/api/certificates",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "List Domain with SSL Enabled"},
        500: {"description": "Internal server error"},
    }
)
def api_get_certificates(request: Request):
    try:
        hosts = get_hosts_certificates()
        aliases = get_aliases_certificates()
        return build_cert_domain(hosts, aliases, settings.DOMAIN)

    except HTTPException:
        raise

    except Exception as err:
        logger.exception("Error getting list host %s", str(err).strip())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "SSL_CERTIFICATES_GET_ERROR",
                "status": "failure",
                "message": "Internal error getting ssl certificates",
            },
        )
