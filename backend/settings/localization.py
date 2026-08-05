# backend/settings/localization.py

# Import standard modules
import json

# Import Settings
from backend.settings.settings import settings
from backend.settings import default

# Import Logging
from backend.log.log import get_logger

# Logger initialization
logger = get_logger(__name__)

LOCALES_DIR = settings.FRONTEND_PATH / "locales"

_translations = {}

def load_language(lang: str, fallback: bool = True):
    if lang in _translations:
        return _translations[lang]

    file_path = LOCALES_DIR / f"{lang}.json"

    try:
        with open(file_path, encoding="utf-8") as f:
            _translations[lang] = json.load(f)

    except (FileNotFoundError, json.JSONDecodeError):
        if fallback and lang != default.LANGUAGE:
            logger.warning("Invalid language '%s', using default '%s'", lang, default.LANGUAGE)
            return load_language(default.LANGUAGE, False)

        raise

    return _translations[lang]

def t(key: str, lang: str):
    translations = load_language(lang)
    return translations.get(key, key)
