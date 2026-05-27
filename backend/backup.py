# backend/backup.py

# import standard modules
from datetime import datetime, timezone
import hashlib
import json
import os
import time
from typing import List, Dict, Any, Optional

# Import local modules
from backend.db.hosts import get_hosts, add_host, reset_hosts_db
from backend.db.aliases import get_aliases, add_alias, reset_aliases_db

# Import Settings & Logging
from backend.settings.settings import settings
from backend.settings import config
from backend.log.log import get_logger

# Logger initialization
logger = get_logger(__name__)

# Timestamp used for backup file naming
TIMESTAMP = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

# ---------------------------------------------------------
# Internal: Calculate file checksum
# ---------------------------------------------------------
def file_checksum(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

# ---------------------------------------------------------
# Save Hosts DB
# ---------------------------------------------------------
def store_hosts(timestamp: Optional[str] = None) -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    path = os.path.join(settings.BACKUP_PATH, config.BACKUP_HOSTS_FILE)
    count_stored = 0
    count_loaded = 0
    errors: List[str] = []

    try:
        # Get Hosts List
        hosts = get_hosts()
        count_loaded = len(hosts)

        with open(path, "w", encoding="utf-8") as f:
            data = {
                "generated_at": timestamp or TIMESTAMP,
                "count": count_loaded,
                "hosts": hosts,
            }
            json.dump(data, f, ensure_ascii=False, indent=2)

    except Exception as e:
        logger.exception("store_hosts failed saving records: %s", str(e).strip())
        errors.append(str(e))

    took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

    if errors:
        result: Dict[str, Any] = {
            "status": "failure",
            "file": path,
            "errors": errors,
            "took_ms": took_ms,
        }
    else:
        count_stored = count_loaded
        result: Dict[str, Any] = {
            "status": "success",
            "file": path,
            "count_loaded": count_loaded,
            "count_stored": count_stored,
            "took_ms": took_ms,
        }

    return result

# ---------------------------------------------------------
# Restore Hosts DB
# ---------------------------------------------------------
def restore_hosts(file: Optional[str] = None) -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    if file is None:
        file = config.BACKUP_HOSTS_FILE
    path = os.path.join(settings.BACKUP_PATH, file)
    count_restored = 0
    count_loaded = 0
    hosts: List[Dict[str, Any]] = []
    errors: List[str] = []

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            hosts = data.get("hosts", [])
            count_loaded = data.get("count", 0)

        for r in hosts:
            add_host(r)
            count_restored += 1

    except Exception as e:
        logger.exception("restore_hosts failed applying records: %s", str(e).strip())
        errors.append(str(e));

    took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

    if errors:
        result: Dict[str, Any] = {
            "status": "failure",
            "file": path,
            "errors": errors,
            "took_ms": took_ms,
        }
    else:
        count_stored = count_loaded
        result: Dict[str, Any] = {
            "status": "success",
            "file": path,
            "count_loaded": count_loaded,
            "count_stored": count_stored,
            "took_ms": took_ms,
        }

    return result

# ---------------------------------------------------------
# Save Aliases DB
# ---------------------------------------------------------
def store_aliases(timestamp: Optional[str] = None) -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    path = os.path.join(settings.BACKUP_PATH, config.BACKUP_ALIASES_FILE)
    count_stored = 0
    count_loaded = 0
    errors: List[str] = []

    try:
        # Get Aliases List
        aliases = get_aliases()
        count_loaded = len(aliases)

        # Backup Aliases DB
        path = os.path.join(settings.BACKUP_PATH, config.BACKUP_ALIASES_FILE)
        with open(path, "w", encoding="utf-8") as f:
            data = {
                "generated_at": timestamp or TIMESTAMP,
                "count": count_loaded,
                "aliases": aliases,
            }
            json.dump(data, f, ensure_ascii=False, indent=2)

    except Exception as e:
        logger.exception("store_aliases failed saving records: %s", str(e).strip())
        errors.append(str(e))

    took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

    if errors:
        result: Dict[str, Any] = {
            "status": "failure",
            "file": path,
            "errors": errors,
            "took_ms": took_ms,
        }
    else:
        count_stored = count_loaded
        result: Dict[str, Any] = {
            "status": "success",
            "file": path,
            "count_loaded": count_loaded,
            "count_stored": count_stored,
            "took_ms": took_ms,
        }

    return result

# ---------------------------------------------------------
# Restore Aliases DB
# ---------------------------------------------------------
def restore_aliases(file: Optional[str] = None) -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    if file is None:
        file = config.BACKUP_ALIASES_FILE
    path = os.path.join(settings.BACKUP_PATH, file)
    count_restored = 0
    count_loaded = 0
    aliases: List[Dict[str, Any]] = []
    errors: List[str] = []

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            aliases = data.get("aliases", [])
            count_loaded = data.get("count", 0)

        for r in aliases:
            add_alias(r)
            count_restored += 1

    except Exception as e:
        logger.exception("restore_aliases failed applying records: %s", str(e).strip())
        errors.append(str(e));

    took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

    if errors:
        result: Dict[str, Any] = {
            "status": "failure",
            "file": path,
            "errors": errors,
            "took_ms": took_ms,
        }
    else:
        count_stored = count_loaded
        result: Dict[str, Any] = {
            "status": "success",
            "file": path,
            "count_loaded": count_loaded,
            "count_stored": count_stored,
            "took_ms": took_ms,
        }

    return result

# ---------------------------------------------------------
# Save Metadata DB
# ---------------------------------------------------------
def store_metadata(timestamp: Optional[str] = None) -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    path = os.path.join(settings.BACKUP_PATH, config.BACKUP_METADATA_FILE)
    errors: List[str] = []

    try:
        with open(path, "w", encoding="utf-8") as f:
            data = {
                "generated_at": timestamp or TIMESTAMP,
                "backup_version": config.BACKUP_VERSION,
                "db_structure_version": config.BACKUP_DB_STRUCTURE_VERSION,
                "file_count": 2,
                "files": [
                    {
                        "name": "hosts",
                        "file": config.BACKUP_HOSTS_FILE,
                        "sha256": file_checksum(os.path.join(settings.BACKUP_PATH, config.BACKUP_HOSTS_FILE)),
                    },
                    {
                        "name": "aliases",
                        "file": config.BACKUP_ALIASES_FILE,
                        "sha256": file_checksum(os.path.join(settings.BACKUP_PATH, config.BACKUP_ALIASES_FILE)),
                    },
                ]
            }
            json.dump(data, f, ensure_ascii=False, indent=2)

    except Exception as e:
        logger.exception("store_metadata failed saving records: %s", str(e).strip())
        errors.append(str(e))

    took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

    if errors:
        result: Dict[str, Any] = {
            "status": "failure",
            "file": path,
            "version": config.BACKUP_VERSION,
            "db_structure_version": config.BACKUP_DB_STRUCTURE_VERSION,
            "errors": errors,
            "took_ms": took_ms,
        }
    else:
        result: Dict[str, Any] = {
            "status": "success",
            "file": path,
            "version": config.BACKUP_VERSION,
            "db_structure_version": config.BACKUP_DB_STRUCTURE_VERSION,
            "file_count": 2,
            "took_ms": took_ms,
        }

    return result

# ---------------------------------------------------------
# Check Metadata
# ---------------------------------------------------------
def check_metadata() -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    path = os.path.join(settings.BACKUP_PATH, config.BACKUP_METADATA_FILE)

    try:
        with open(path, "r", encoding="utf-8") as f:
            metadata = json.load(f)

        # Validate structure
        if "files" not in metadata or not isinstance(metadata["files"], list):
            raise ValueError("Invalid metadata: missing or invalid 'files'")

        # Validate versions
        if metadata.get("backup_version") != config.BACKUP_VERSION:
            raise ValueError("Backup version mismatch")

        if metadata.get("db_structure_version") != config.BACKUP_DB_STRUCTURE_VERSION:
            raise ValueError("DB structure not compatible")

        # Validate files
        for file_meta in metadata["files"]:

            if not isinstance(file_meta, dict):
                raise ValueError("Invalid metadata entry: must be an object")

            if "file" not in file_meta:
                raise ValueError("Invalid metadata entry: missing 'file'")

            if "sha256" not in file_meta:
                raise ValueError(f"Missing checksum for file: {file_meta.get('file')}")

            file_path = os.path.join(settings.BACKUP_PATH, file_meta["file"])

            if not os.path.isfile(file_path):
                raise FileNotFoundError(f"Backup file not found: {file_meta['file']}")

            if file_checksum(file_path) != file_meta["sha256"]:
                raise ValueError(f"Checksum mismatch for file: {file_meta['file']}")

        result: Dict[str, Any] = {
            "status": "success",
            "file": path,
            "version": metadata.get("backup_version"),
            "db_structure_version": metadata.get("db_structure_version"),
            "file_count": metadata.get("file_count"),
            "files": metadata.get("files"),
            "took_ms": (time.monotonic_ns() - start_ns) / 1_000_000,
        }

    except Exception as e:
        logger.exception("check_metadata failed reading metadata: %s", str(e).strip())
        result = {
            "status": "failure",
            "file": path,
            "errors": [str(e)],
            "took_ms": (time.monotonic_ns() - start_ns) / 1_000_000,
        }

    return result

# ---------------------------------------------------------
# Backup DB
# ---------------------------------------------------------
def backup() -> Dict[str, Any]:

    # Ensure backup directory exists
    os.makedirs(settings.BACKUP_PATH, exist_ok=True)

    # Timestamp used for backup file naming
    timestamp = TIMESTAMP

    hosts_result = store_hosts(timestamp)
    aliases_result = store_aliases(timestamp)
    metadata_result = store_metadata(timestamp)
    errors = ((metadata_result.get("errors") or [])
            + (hosts_result.get("errors") or [])
            + (aliases_result.get("errors") or [])
    )

    # Collect errors and results
    result = {
        "metadata": metadata_result,
        "hosts": hosts_result,
        "aliases": aliases_result,
    }

    # Compute summary
    operations = [metadata_result, hosts_result, aliases_result]
    summary = {
        "total": len(operations),
        "success": sum(1 for op in operations if op.get("status") == "success"),
        "failed": sum(1 for op in operations if op.get("status") == "failure"),
    }

    result = {
        "metadata": metadata_result,
        "hosts": hosts_result,
        "aliases": aliases_result,
        "summary": summary,
    }

    return result

# ---------------------------------------------------------
# Restore DB
# ---------------------------------------------------------
def restore(cleanup: bool = True) -> Dict[str, Any]:

    # Check metadata first to ensure backup is valid before applying changes
    metadata_result = check_metadata()
    if(metadata_result.get("status") != "success"):
        return {
            "metadata": metadata_result,
            "hosts": None,
            "aliases": None,
            "summary": {
                "total": 1,
                "success": 0,
                "failed": 1,
            },
        }

    if cleanup:
        try:
            reset_hosts_db()
            reset_aliases_db()

        except Exception as e:
            logger.exception("Cleanup failed %s", str(e).strip())
            raise

    for f in metadata_result["files"]:
        if f["name"] == "hosts":
            hosts_result = restore_hosts(f["file"])

        elif f["name"] == "aliases":
            aliases_result = restore_aliases(f["file"])

    errors = ((metadata_result.get("errors") or [])
            + (hosts_result.get("errors") or [])
            + (aliases_result.get("errors") or [])
    )

    # Compute summary
    operations = [metadata_result, hosts_result, aliases_result]
    summary = {
        "total": len(operations),
        "success": sum(1 for op in operations if op.get("status") == "success"),
        "failed": sum(1 for op in operations if op.get("status") == "failure"),
    }

    result = {
        "metadata": metadata_result,
        "hosts": hosts_result,
        "aliases": aliases_result,
        "summary": summary,
    }

    return result
