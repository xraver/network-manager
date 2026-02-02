# backend/settings.py

from __future__ import annotations

# import standard modules
import os
import secrets
import datetime
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field, field_validator
# Import Parameters
from . import config, default

# ---------------------------------------------------------
# Convert value to boolean
# ---------------------------------------------------------
def _to_bool(val) -> bool:
    if isinstance(val, bool):
        return val
    if val is None:
        return False
    return str(val).strip().lower() in {"1", "true", "yes", "on"}

# ---------------------------------------------------------
# Read text from file if it exists
# ---------------------------------------------------------
def _read_text_if_exists(path: Optional[str]) -> Optional[str]:
    if not path:
        return None
    p = Path(path)
    if p.exists() and p.is_file():
        try:
            return p.read_text(encoding="utf-8").strip()
        except Exception:
            return None
    return None

# ---------------------------------------------------------
# Settings Model
# ---------------------------------------------------------
class Settings(BaseModel):
    # Naming
    APP_NAME: str = Field(default_factory=lambda: config.APP_NAME)

    # Versioning
    APP_VERSION: str = Field(default_factory=lambda: config.APP_VERSION)
    DEVEL: bool = Field(default_factory=lambda: _to_bool(os.getenv("DEV", False)))

    # Base Image / Docker Image
    BASEIMG_NAME: str = Field(default_factory=lambda: config.BASEIMG_NAME)
    BASEIMG_VERSION: str = Field(default_factory=lambda: config.BASEIMG_VERSION)

    # DATA_PATH
    DATA_PATH: str = Field(default_factory=lambda: os.getenv("DATA_PATH", default.DATA_PATH))

    # Frontend
    FRONTEND_DIR: str = Field(default_factory=lambda: os.getenv("FRONTEND_DIR", default.FRONTEND_DIR))

    # Database
    DB_FILE: str = Field(default_factory=lambda: os.getenv("DB_FILE", default.DB_FILE))
    DB_RESET: bool = Field(default_factory=lambda: _to_bool(os.getenv("DB_RESET", default.DB_RESET)))

    # Log
    LOG_LEVEL: str = Field(default_factory=lambda: os.getenv("LOG_LEVEL", default.LOG_LEVEL))
    LOG_TO_FILE: bool = Field(default_factory=lambda: _to_bool(os.getenv("LOG_TO_FILE", default.LOG_TO_FILE)))
    LOG_FILE: str = Field(default_factory=lambda: os.getenv("LOG_FILE", default.LOG_FILE))
    LOG_ACCESS_FILE: str = Field(default_factory=lambda: os.getenv("LOG_ACCESS_FILE", default.LOG_ACCESS_FILE))

    # Hosts
    DOMAIN: str = Field(default_factory=lambda: os.getenv("DOMAIN", default.DOMAIN))
    PUBLIC_IP: str = Field(default_factory=lambda: os.getenv("PUBLIC_IP", default.DOMAIN))

    # Web
    HTTP_PORT: int = Field(default_factory=lambda: int(os.getenv("HTTP_PORT", default.HTTP_PORT)))
    SECRET_KEY: str = Field(default_factory=lambda: (
        (os.getenv("SESSION_SECRET") or _read_text_if_exists(os.getenv("SECRET_KEY_FILE")) or secrets.token_urlsafe(64)).strip()
    ))
    LOGIN_MAX_ATTEMPTS: int = Field(default_factory=lambda: int(os.getenv("LOGIN_MAX_ATTEMPTS", default.LOGIN_MAX_ATTEMPTS)))
    LOGIN_WINDOW_SECONDS: int = Field(default_factory=lambda: int(os.getenv("LOGIN_WINDOW_SECONDS", default.LOGIN_WINDOW_SECONDS)))

    # Admin
    ADMIN_USER: str = Field(default_factory=lambda: os.getenv("ADMIN_USER", default.ADMIN_USER))
    ADMIN_PASSWORD: str = Field(default_factory=lambda: os.getenv("ADMIN_PASSWORD", default.ADMIN_PASSWORD))
    ADMIN_PASSWORD_HASH_FILE: str = Field(default_factory=lambda: os.getenv("ADMIN_PASSWORD_HASH_FILE", default.ADMIN_PASSWORD_HASH_FILE))
    ADMIN_PASSWORD_HASH: Optional[str] = Field(default_factory=lambda: (
        (os.getenv("ADMIN_PASSWORD_HASH") or _read_text_if_exists(os.getenv("ADMIN_PASSWORD_HASH_FILE", default.ADMIN_PASSWORD_HASH_FILE)) or None)
    ))

    # DNS
    DNS_CFG_PATH: str = Field(default_factory=lambda: os.getenv("DNS_CFG_PATH", default.DNS_CFG_PATH))
    DNS_HOST_FILE: str = Field(default_factory=lambda: os.getenv("DNS_HOST_FILE", default.DNS_HOST_FILE))
    DNS_ALIAS_FILE: str = Field(default_factory=lambda: os.getenv("DNS_ALIAS_FILE", default.DNS_ALIAS_FILE))
    DNS_REVERSE_FILE: str = Field(default_factory=lambda: os.getenv("DNS_REVERSE_FILE", default.DNS_REVERSE_FILE))
    # DHCP
    DHCP_CFG_PATH: str = Field(default_factory=lambda: os.getenv("DHCP_CFG_PATH", default.DHCP_CFG_PATH))
    DHCP4_HOST_FILE: str = Field(default_factory=lambda: os.getenv("DHCP4_HOST_FILE", default.DHCP4_HOST_FILE))
    DHCP6_HOST_FILE: str = Field(default_factory=lambda: os.getenv("DHCP6_HOST_FILE", default.DHCP6_HOST_FILE))

    def model_post_init(self, __context) -> None:
        if self.DEVEL:
            ts = datetime.datetime.now().strftime("%Y%m%d-%H%M")
            object.__setattr__(self, "APP_VERSION", f"{self.APP_VERSION}-dev-{ts}")
        else:
            object.__setattr__(self, "APP_VERSION", self.APP_VERSION)

        # Database
        self.DB_FILE         = self.DATA_PATH + "/" + self.DB_FILE
        self.LOG_FILE        = self.DATA_PATH + "/" + self.LOG_FILE
        self.LOG_ACCESS_FILE = self.DATA_PATH + "/" + self.LOG_ACCESS_FILE

        # Update DNS Files
        if self.DOMAIN.lower() != default.DOMAIN.lower():
            self.DNS_HOST_FILE    = self.DNS_HOST_FILE.replace(default.DOMAIN, self.DOMAIN)
            self.DNS_ALIAS_FILE   = self.DNS_ALIAS_FILE.replace(default.DOMAIN, self.DOMAIN)
            self.DNS_REVERSE_FILE = self.DNS_REVERSE_FILE.replace(default.DOMAIN, self.DOMAIN)
        self.DNS_HOST_FILE    = self.DNS_CFG_PATH + "/" + self.DNS_HOST_FILE
        self.DNS_ALIAS_FILE   = self.DNS_CFG_PATH + "/" + self.DNS_ALIAS_FILE
        self.DNS_REVERSE_FILE = self.DNS_CFG_PATH + "/" + self.DNS_REVERSE_FILE

        # Update DHCP Files
        self.DHCP4_HOST_FILE  = self.DHCP_CFG_PATH + "/" + self.DHCP4_HOST_FILE
        self.DHCP6_HOST_FILE  = self.DHCP_CFG_PATH + "/" + self.DHCP6_HOST_FILE

# ---------------------------------------------------------
# Singleton
# ---------------------------------------------------------
settings = Settings()
