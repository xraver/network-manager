# backend/settings/settings.py

from __future__ import annotations

# import standard modules
import os
import secrets
import datetime
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field

# Import Parameters
from . import config, default
from backend.utils import to_int, to_bool

# ---------------------------------------------------------
# Internal: load secret
# ---------------------------------------------------------
def _load_secret_key() -> str:
    key = (
        os.getenv("SESSION_SECRET")
        or _read_text_if_exists(os.getenv("SECRET_KEY_FILE"))
    )

    if not key:
        if not to_bool(os.getenv("DEV"), False):
            print("WARNING: SECRET_KEY auto-generated (not safe for production)")
        key = secrets.token_urlsafe(64)

    return key.strip()

# ---------------------------------------------------------
# Internal: load admin hash
# ---------------------------------------------------------
def _load_admin_hash() -> Optional[str]:
    env = os.getenv("ADMIN_PASSWORD_HASH")
    if env:
        return env

    file_env = os.getenv("ADMIN_PASSWORD_HASH_FILE")
    if file_env:
        return _read_text_if_exists(file_env)

    return _read_text_if_exists(default.ADMIN_PASSWORD_HASH_FILE)

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
    DEVEL: bool = Field(default_factory=lambda: to_bool(os.getenv("DEV"), False))

    # DATA_PATH
    DATA_PATH: Path = Field(default_factory=lambda: Path(os.getenv("DATA_PATH", default.DATA_PATH)))

    # Frontend
    FRONTEND_PATH: Path = Field(default_factory=lambda: Path(os.getenv("FRONTEND_PATH", default.FRONTEND_PATH)))

    # Database
    DB_FILE: Path = Field(default_factory=lambda: Path(os.getenv("DB_FILE", default.DB_FILE)))
    DB_RESET: bool = Field(default_factory=lambda: to_bool(os.getenv("DB_RESET"), default.DB_RESET))

    # Log
    LOG_LEVEL: str = Field(default_factory=lambda: os.getenv("LOG_LEVEL", default.LOG_LEVEL))
    LOG_TO_FILE: bool = Field(default_factory=lambda: to_bool(os.getenv("LOG_TO_FILE"), default.LOG_TO_FILE))
    LOG_FILE: Path = Field(default_factory=lambda: Path(os.getenv("LOG_FILE", default.LOG_FILE)))
    LOG_ACCESS_FILE: Path = Field(default_factory=lambda: Path(os.getenv("LOG_ACCESS_FILE", default.LOG_ACCESS_FILE)))

    # Hosts
    DOMAIN: str = Field(default_factory=lambda: os.getenv("DOMAIN", default.DOMAIN))
    EXTERNAL_NAME: str = Field(default_factory=lambda: os.getenv("EXTERNAL_NAME", default.EXTERNAL_NAME))

    # Web
    HTTP_HOST: str = Field(default_factory=lambda: os.getenv("HTTP_HOST", default.HTTP_HOST))
    HTTP_PORT: int = Field(default_factory=lambda: to_int(os.getenv("HTTP_PORT"), default.HTTP_PORT))
    SECRET_KEY: str = Field(default_factory=_load_secret_key)
    LOGIN_MAX_ATTEMPTS: int = Field(default_factory=lambda: to_int(os.getenv("LOGIN_MAX_ATTEMPTS"), default.LOGIN_MAX_ATTEMPTS))
    LOGIN_WINDOW_SECONDS: int = Field(default_factory=lambda: to_int(os.getenv("LOGIN_WINDOW_SECONDS"), default.LOGIN_WINDOW_SECONDS))

    # Admin
    ADMIN_USER: str = Field(default_factory=lambda: os.getenv("ADMIN_USER", default.ADMIN_USER))
    ADMIN_PASSWORD: str = Field(default_factory=lambda: os.getenv("ADMIN_PASSWORD", default.ADMIN_PASSWORD))
    ADMIN_PASSWORD_HASH_FILE: Path = Field(default_factory=lambda: Path(os.getenv("ADMIN_PASSWORD_HASH_FILE", default.ADMIN_PASSWORD_HASH_FILE)))
    ADMIN_PASSWORD_HASH: Optional[str] = Field(default_factory=_load_admin_hash)

    # DNS
    DNS_HOST_FILE: Path = Field(default_factory=lambda: Path(os.getenv("DNS_HOST_FILE", default.DNS_HOST_FILE)))
    DNS_ALIAS_FILE: Path = Field(default_factory=lambda: Path(os.getenv("DNS_ALIAS_FILE", default.DNS_ALIAS_FILE)))
    DNS_REVERSE_FILE: Path = Field(default_factory=lambda: Path(os.getenv("DNS_REVERSE_FILE", default.DNS_REVERSE_FILE)))
    # DHCP
    DHCP4_HOST_FILE: Path = Field(default_factory=lambda: Path(os.getenv("DHCP4_HOST_FILE", default.DHCP4_HOST_FILE)))
    DHCP4_LEASES_FILE: Path = Field(default_factory=lambda: Path(os.getenv("DHCP4_LEASES_FILE", default.DHCP4_LEASES_FILE)))
    DHCP6_HOST_FILE: Path = Field(default_factory=lambda: Path(os.getenv("DHCP6_HOST_FILE", default.DHCP6_HOST_FILE)))
    DHCP6_LEASES_FILE: Path = Field(default_factory=lambda: Path(os.getenv("DHCP6_LEASES_FILE", default.DHCP6_LEASES_FILE)))

    # Backup
    BACKUP_PATH: Path = Field(default_factory=lambda: Path(os.getenv("BACKUP_PATH", default.BACKUP_PATH)))

    # APP Features
    PING_WORKERS: int = Field(default_factory=lambda: to_int(os.getenv("PING_WORKERS"), default.PING_WORKERS))

    # ---------------------------------------------------------
    # Post init process
    # ---------------------------------------------------------
    def model_post_init(self, __context) -> None:
        if self.DEVEL:
            ts = datetime.datetime.now().strftime("%Y%m%d-%H%M")
            object.__setattr__(self, "APP_VERSION", f"{self.APP_VERSION}-dev-{ts}")

        # Folder Data Creation
        self.DATA_PATH.mkdir(parents=True, exist_ok=True)

        # Update DB file path including DATA_PATH
        if not self.DB_FILE.is_absolute():
            object.__setattr__(self, "DB_FILE", self.DATA_PATH / self.DB_FILE)

        # Update Log files path including DATA_PATH
        if not self.LOG_FILE.is_absolute():
            object.__setattr__(self, "LOG_FILE", self.DATA_PATH / self.LOG_FILE)
        if not self.LOG_ACCESS_FILE.is_absolute():
            object.__setattr__(self, "LOG_ACCESS_FILE", self.DATA_PATH / self.LOG_ACCESS_FILE)

        # Updated Backup Path
        if not self.BACKUP_PATH.is_absolute():
            object.__setattr__(self, "BACKUP_PATH", self.DATA_PATH / self.BACKUP_PATH)
        self.BACKUP_PATH.parent.mkdir(parents=True, exist_ok=True)

        # Update DNS references based on domain name
        if "{domain}" in str(self.DNS_HOST_FILE):
            object.__setattr__(
                self,
                "DNS_HOST_FILE",
                Path(str(self.DNS_HOST_FILE).format(domain=self.DOMAIN)),
            )
        if "{domain}" in str(self.DNS_ALIAS_FILE):
            object.__setattr__(
                self,
                "DNS_ALIAS_FILE",
                Path(str(self.DNS_ALIAS_FILE).format(domain=self.DOMAIN)),
            )

# ---------------------------------------------------------
# Singleton
# ---------------------------------------------------------
settings = Settings()
