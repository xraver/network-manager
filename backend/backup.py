# backend/backup.py

# import standard modules
import json
import os
import time
from typing import Iterable, List, Tuple, Dict, Any

# Import local modules
from backend.db.hosts import get_hosts, add_host, reset_hosts_db
from backend.db.aliases import get_aliases, add_alias, reset_aliases_db

# Import Settings & Logging
from backend.settings.settings import settings
from backend.log.log import get_logger

# Logger initialization
logger = get_logger(__name__)

# ---------------------------------------------------------
# Internal: load NDJSON utility
# ---------------------------------------------------------
def _load_ndjson(path: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    records: List[Dict[str, Any]] = []
    errors: List[str] = []

    if not os.path.exists(path):
        errors.append(f"File not found: {path}")
        return records, errors

    with open(path, "r", encoding="utf-8") as f:
        for lineno, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                if isinstance(obj, dict):
                    records.append(obj)
                else:
                    errors.append(f"{os.path.basename(path)}:{lineno} -> JSON is not an object")
            except json.JSONDecodeError as e:
                errors.append(f"{os.path.basename(path)}:{lineno} -> JSON decode error: {str(e)}")

    return records, errors

# ---------------------------------------------------------
# Save Hosts DB
# ---------------------------------------------------------
def store_hosts() -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    path = os.path.join(settings.DATA_PATH, "hosts.json")
    stored = 0
    count_loaded = 0
    errors: List[str] = []

    try:
        # Get Hosts List
        hosts = get_hosts()
        count_loaded = len(hosts)

        with open(path, "w", encoding="utf-8") as f:
            for h in hosts:
                f.write(json.dumps(h, ensure_ascii=False) + "\n")
                stored += 1

    except Exception as e:
        logger.exception("store_hosts failed saving records: %s", str(e).strip())
        errors.append(str(e))

    took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

    result: Dict[str, Any] = {
        "file": path,
        "count_loaded": count_loaded,
        "count_stored": stored,
        "took_ms": took_ms,
    }

    if errors:
        result["errors"] = errors

    return result

# ---------------------------------------------------------
# Restore Hosts DB
# ---------------------------------------------------------
def restore_hosts() -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    path = os.path.join(settings.DATA_PATH, "hosts.json")
    restored = 0

    # load records from NDJSON file
    records, errors = _load_ndjson(path)

    try:
        for r in records:
            add_host(r)
            restored += 1

    except Exception as e:
        logger.exception("restore_hosts failed applying records: %s", str(e).strip())
        errors.append(str(e));

    took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
    return {
        "file": path,
        "count_loaded": len(records),
        "count_restored": restored,
        "errors": errors,
        "took_ms": took_ms,
    }

# ---------------------------------------------------------
# Save Aliases DB
# ---------------------------------------------------------
def store_aliases() -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    path = os.path.join(settings.DATA_PATH, "hosts.json")
    stored = 0
    count_loaded = 0
    errors: List[str] = []

    try:
        # Get Aliases List
        aliases = get_aliases()
        count_loaded = len(aliases)

        # Backup Aliases DB
        path = os.path.join(settings.DATA_PATH, "aliases.json")
        with open(path, "w", encoding="utf-8") as f:
            for a in aliases:
                f.write(json.dumps(a, ensure_ascii=False) + "\n")
                stored += 1

    except Exception as e:
        logger.exception("store_aliases failed saving records: %s", str(e).strip())
        errors.append(str(e))

    took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

    result: Dict[str, Any] = {
        "file": path,
        "count_loaded": count_loaded,
        "count_stored": stored,
        "took_ms": took_ms,
    }

    if errors:
        result["errors"] = errors

    return result

# ---------------------------------------------------------
# Restore Aliases DB
# ---------------------------------------------------------
def restore_aliases() -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    src_path = os.path.join(settings.DATA_PATH, "aliases.json")
    restored = 0

    # load records from NDJSON file
    records, errors = _load_ndjson(src_path)

    try:
        for r in records:
            add_alias(r)
            restored += 1

    except Exception as e:
        logger.exception("restore_aliases failed applying records: %s", str(e).strip())
        errors.append(str(e));

    took_ms = (time.monotonic_ns() - start_ns) / 1_000_000
    return {
        "file": src_path,
        "count_loaded": len(records),
        "count_restored": restored,
        "errors": errors,
        "took_ms": took_ms,
    }

# ---------------------------------------------------------
# Backup DB
# ---------------------------------------------------------
def backup() -> Dict[str, Any]:
    
    hosts_result = store_hosts()
    aliases_result = store_aliases()
    errors = (hosts_result.get("errors") or []) + (aliases_result.get("errors") or [])

    result = {
        "hosts": hosts_result,
        "aliases": aliases_result,
    }

    if errors:
        result["errors"] = errors

    return result

# ---------------------------------------------------------
# Restore DB
# ---------------------------------------------------------
def restore(cleanup: bool = True) -> Dict[str, Any]:

    if cleanup:
        try:
            reset_hosts_db()
            reset_aliases_db()

        except Exception as e:
            logger.exception("Cleanup failed %s", str(e).strip())
            raise
 
    hosts_result = restore_hosts()
    aliases_result = restore_aliases()
    errors = (hosts_result.get("errors") or []) + (aliases_result.get("errors") or [])

    result = {
        "cleanup": cleanup,
        "hosts": hosts_result,
        "aliases": aliases_result,
    }

    if errors:
        result["errors"] = errors
        # GRGR -> reset db in caso di errori

    return result

