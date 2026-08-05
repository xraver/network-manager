# backend/routes/localization.py

# import standard modules
from fastapi import APIRouter, Request, Response, HTTPException, status
from fastapi.responses import FileResponse

# Import Settings & Config
from backend.settings.settings import settings
from backend.db.settings import get_config
# Import Logging
from backend.log.log import get_logger
# Import Localization
from backend.settings.localization import load_language

# Logger initialization
logger = get_logger(__name__)

# Create Router
router = APIRouter()

# ---------------------------------------------------------
# FRONTEND PATHS (absolute paths inside Docker)
# ---------------------------------------------------------
# Serve i18n.js
@router.get("/js/i18n.js")
def i18n_js(request: Request):
    return FileResponse(settings.FRONTEND_PATH / "js/i18n.js")

# Serve backendMessages.js
@router.get("/js/backendMessages.js")
def i18n_js(request: Request):
    return FileResponse(settings.FRONTEND_PATH / "js/backendMessages.js")

# ---------------------------------------------------------
# Returns the translation dictionary
# ---------------------------------------------------------
@router.get("/api/i18n",
    status_code=status.HTTP_200_OK,
    summary="Get UI translations",
    description="Returns the translation dictionary for the currently configured application language.",
    tags=["Localization"]
)
def get_translations():
    lang = get_config("LANGUAGE")
    return load_language(lang)

# ---------------------------------------------------------
# Returns a specific translation dictionary
# ---------------------------------------------------------
@router.get(
    "/api/i18n/{lang}",
    status_code=status.HTTP_200_OK,
    responses={
        200: {"description": "Translations loaded"},
        404: {"description": "Language not found"},
        500: {"description": "Internal server error"},
    },
    summary="Get translations",
    description="Returns all translations for the specified language.",
    tags=["Localization"],
)
def get_translations(lang: str):
    try:
        translations = load_language(lang, fallback=False)
        return translations

    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "LANGUAGE_NOT_FOUND",
                "status": "failure",
                "message": f"Language '{lang}' not found",
            },
        )

    except Exception as err:
        logger.exception("Error loading translations: %s", str(err).strip())

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "TRANSLATION_ERROR",
                "status": "failure",
                "message": "Internal error loading translations",
            },
        )
