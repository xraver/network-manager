# backend/backup.py

# import standard modules
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import time
from typing import List, Dict, Any, Optional, Union
import zipfile

# Import local modules
from backend.db.hosts import get_hosts, add_host, reset_hosts_db
from backend.db.aliases import get_aliases, add_alias, reset_aliases_db

# Import Settings & Config
from backend.settings.settings import settings
from backend.db.settings import get_config
# Import Logging
from backend.log.log import get_logger

# Logger initialization
logger = get_logger(__name__)

# Backup files to include in the archive (must match metadata structure)
backup_files = [
    settings.BACKUP_METADATA_FILE,
    settings.BACKUP_HOSTS_FILE,
    settings.BACKUP_ALIASES_FILE,
]

 # Set to True to remove individual backup files after creating the archive (optional, can be set to False for debugging)
remove_backup_files = True

# ---------------------------------------------------------
# Internal: Generate Filestamp
# ---------------------------------------------------------
def generate_timestamps() -> dict:
    now = datetime.now(timezone.utc)

    return {
        "iso": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "file": now.strftime("%Y%m%d_%H%M%S"),
    }

# ---------------------------------------------------------
# Internal: Build summary JSON
# ---------------------------------------------------------
def build_result(operations: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:

    summary = {
        "total": len(operations),
        "success": sum(1 for op in operations.values() if op.get("status") == "success"),
        "failed": sum(1 for op in operations.values() if op.get("status") == "failure"),
    }

    errors = sum(
        ((op.get("errors") or []) for op in operations.values()),
        []
    )

    return {
        **operations,
        "summary": summary,
        "errors": errors,
    }

# ---------------------------------------------------------
# Internal: Calculate file checksum
# ---------------------------------------------------------
def file_checksum(path: Union[str, Path]) -> str:
    path = Path(path)
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

# ---------------------------------------------------------
# Internal: Create Backup Archive (ZIP)
# ---------------------------------------------------------
def create_backup_archive(
    *,
    zip_name: Optional[str] = None,
    zip_dir: Optional[str] = None,
    files_dir: Optional[str] = None,
    remove_files: bool = False
) -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    count = 0
    errors: List[str] = []

    try:
        # --- Paths ---
        base_zip_dir = Path(zip_dir or get_config("BACKUP_PATH"))
        base_files_dir = Path(files_dir or get_config("BACKUP_PATH"))
        base_zip_dir.mkdir(parents=True, exist_ok=True)

        # zip name
        if not zip_name:
            ts = time.strftime("%Y%m%d_%H%M%S")
            zip_name = f"backup_{ts}.zip"
        zip_file = base_zip_dir / zip_name

        # --- Create ZIP ---
        with zipfile.ZipFile(zip_file, "w", compression=zipfile.ZIP_DEFLATED) as z:
            for fname in backup_files:
                fpath = base_files_dir / fname
                if not fpath.is_file():
                    raise FileNotFoundError(f"Missing file for archive: {fname}")
                z.write(fpath, arcname=fname)
                count += 1

        # --- Checksum ---
        archive_sha256 = file_checksum(zip_file)

        # --- Cleanup ---
        if remove_files:
            for fname in backup_files:
                fpath = base_files_dir / fname
                fpath.unlink(missing_ok=True)
            # Remove folder if empty
            p = base_files_dir
            if p.is_dir() and not any(p.iterdir()):
                p.rmdir()

    except Exception as e:
        logger.exception("create_backup_archive failed: %s", str(e).strip())
        errors.append(str(e))

    took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

    return {
        "status": "failure" if errors else "success",
        "file": str(zip_file) if not errors else None,
        "count": count if not errors else 0,
        "sha256": archive_sha256 if not errors else None,
        "errors": errors,
        "took_ms": took_ms,
    }

# ---------------------------------------------------------
# Internal: Unzip Backup Archive (ZIP)
# ---------------------------------------------------------
def unzip_backup_archive(
    *,
    zip_path: Optional[str] = None,
    zip_name: Optional[str] = None,
    zip_dir: Optional[str] = None,
    extract_dir: Optional[str] = None
) -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    count = 0
    errors: List[str] = []

    try:
        # --- Resolve paths ---
        base_zip_dir = zip_dir or get_config("BACKUP_PATH")

        if not zip_path:
            if not zip_name:
                raise ValueError("Either zip_path or zip_name must be provided")

            zip_path = Path(base_zip_dir) / zip_name

        base_extract_dir = extract_dir or get_config("BACKUP_PATH")
        Path(base_extract_dir).mkdir(parents=True, exist_ok=True)

        # --- Unzip ---
        with zipfile.ZipFile(zip_path, "r") as z:
            z.extractall(base_extract_dir)
            count = len(z.namelist())

    except Exception as e:
        logger.exception("unzip_backup_archive failed: %s", str(e).strip())
        errors.append(str(e))

    took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

    return {
        "status": "failure" if errors else "success",
        "file": str(zip_path),
        "extract_dir": str(base_extract_dir) if not errors else None,
        "count": count if not errors else 0,
        "errors": errors,
        "took_ms": took_ms,
    }

# ---------------------------------------------------------
# Save Hosts DB
# ---------------------------------------------------------
def store_hosts(
    *,
    timestamp: str,
    filename: Optional[str] = None,
    filepath: Optional[str] = None,
) -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    filepath = Path(filepath or get_config("BACKUP_PATH"))
    filename = filename or settings.BACKUP_HOSTS_FILE
    file = filepath / filename
    filepath.mkdir(parents=True, exist_ok=True)
    count_stored = 0
    count_loaded = 0
    errors: List[str] = []

    try:
        # Get Hosts List
        hosts = get_hosts()
        count_loaded = len(hosts)

        # Backup Hosts DB
        with open(file, "w", encoding="utf-8") as f:
            data = {
                "generated_at": timestamp,
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
            "file": str(file),
            "errors": errors,
            "took_ms": took_ms,
        }
    else:
        count_stored = count_loaded
        result: Dict[str, Any] = {
            "status": "success",
            "file": str(file),
            "count_loaded": count_loaded,
            "count_stored": count_stored,
            "took_ms": took_ms,
        }

    return result

# ---------------------------------------------------------
# Restore Hosts DB
# ---------------------------------------------------------
def restore_hosts(
    filepath: Optional[str] = None,
    filename: Optional[str] = None,
    remove_file: bool = False
) -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    filepath = Path(filepath or get_config("BACKUP_PATH"))
    filename = filename or settings.BACKUP_HOSTS_FILE
    file = filepath / filename
    count_restored = 0
    count_loaded = 0
    hosts: List[Dict[str, Any]] = []
    errors: List[str] = []

    try:
        with open(file, "r", encoding="utf-8") as f:
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
            "file": str(file),
            "errors": errors,
            "took_ms": took_ms,
        }
    else:
        count_stored = count_loaded
        result: Dict[str, Any] = {
            "status": "success",
            "file": str(file),
            "count_loaded": count_loaded,
            "count_stored": count_stored,
            "took_ms": took_ms,
        }

    # --- Cleanup ---
    if remove_file:
        file.unlink(missing_ok=True)

    return result

# ---------------------------------------------------------
# Save Aliases DB
# ---------------------------------------------------------
def store_aliases(
    *,
    timestamp: str,
    filename: Optional[str] = None,
    filepath: Optional[str] = None,
) -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    filepath = Path(filepath or get_config("BACKUP_PATH"))
    filepath.mkdir(parents=True, exist_ok=True)
    filename = filename or settings.BACKUP_ALIASES_FILE
    file = filepath / filename
    count_stored = 0
    count_loaded = 0
    errors: List[str] = []

    try:
        # Get Aliases List
        aliases = get_aliases()
        count_loaded = len(aliases)

        # Backup Aliases DB
        with open(file, "w", encoding="utf-8") as f:
            data = {
                "generated_at": timestamp,
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
            "file": str(file),
            "errors": errors,
            "took_ms": took_ms,
        }
    else:
        count_stored = count_loaded
        result: Dict[str, Any] = {
            "status": "success",
            "file": str(file),
            "count_loaded": count_loaded,
            "count_stored": count_stored,
            "took_ms": took_ms,
        }

    return result

# ---------------------------------------------------------
# Restore Aliases DB
# ---------------------------------------------------------
def restore_aliases(
    filepath: Optional[str] = None,
    filename: Optional[str] = None,
    remove_file: bool = False
) -> Dict[str, Any]:


    # Initialization
    start_ns = time.monotonic_ns()
    filepath = Path(filepath or get_config("BACKUP_PATH"))
    filename = filename or settings.BACKUP_ALIASES_FILE
    file = filepath / filename
    count_restored = 0
    count_loaded = 0
    aliases: List[Dict[str, Any]] = []
    errors: List[str] = []

    try:
        with open(file, "r", encoding="utf-8") as f:
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
            "file": str(file),
            "errors": errors,
            "took_ms": took_ms,
        }
    else:
        count_stored = count_loaded
        result: Dict[str, Any] = {
            "status": "success",
            "file": str(file),
            "count_loaded": count_loaded,
            "count_stored": count_stored,
            "took_ms": took_ms,
        }


    # --- Cleanup ---
    if remove_file:
        file.unlink(missing_ok=True)

    return result

# ---------------------------------------------------------
# Save Metadata
# ---------------------------------------------------------
def store_metadata(
    *,
    timestamp: str,
    filename: Optional[str] = None,
    filepath: Optional[str] = None,
) -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    filepath = Path(filepath or get_config("BACKUP_PATH"))
    filepath.mkdir(parents=True, exist_ok=True)
    filename = filename or settings.BACKUP_METADATA_FILE
    file = filepath / filename
    errors: List[str] = []

    try:
        with open(file, "w", encoding="utf-8") as f:
            data = {
                "generated_at": timestamp,
                "backup_version": settings.BACKUP_VERSION,
                "db_structure_version": settings.BACKUP_DB_STRUCTURE_VERSION,
                "file_count": 2,
                "files": [
                    {
                        "name": "hosts",
                        "file": settings.BACKUP_HOSTS_FILE,
                        "sha256": file_checksum(filepath / settings.BACKUP_HOSTS_FILE),
                    },
                    {
                        "name": "aliases",
                        "file": settings.BACKUP_ALIASES_FILE,
                        "sha256": file_checksum(filepath / settings.BACKUP_ALIASES_FILE),
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
            "file": str(file),
            "version": settings.BACKUP_VERSION,
            "db_structure_version": settings.BACKUP_DB_STRUCTURE_VERSION,
            "errors": errors,
            "took_ms": took_ms,
        }
    else:
        result: Dict[str, Any] = {
            "status": "success",
            "file": str(file),
            "version": settings.BACKUP_VERSION,
            "db_structure_version": settings.BACKUP_DB_STRUCTURE_VERSION,
            "file_count": 2,
            "took_ms": took_ms,
        }

    return result

# ---------------------------------------------------------
# Check Metadata
# ---------------------------------------------------------
def check_metadata(
    filepath: Optional[str] = None,
    filename: Optional[str] = None,
    remove_file: bool = False
) -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    filepath = Path(filepath or get_config("BACKUP_PATH"))
    filename = filename or settings.BACKUP_METADATA_FILE
    file = filepath / filename

    try:
        with open(file, "r", encoding="utf-8") as f:
            metadata = json.load(f)

        # Validate structure
        if "files" not in metadata or not isinstance(metadata["files"], list):
            raise ValueError("Invalid metadata: missing or invalid 'files'")

        # Validate versions
        if metadata.get("backup_version") != settings.BACKUP_VERSION:
            raise ValueError("Backup version mismatch")

        if metadata.get("db_structure_version") != settings.BACKUP_DB_STRUCTURE_VERSION:
            raise ValueError("DB structure not compatible")

        # Validate files
        for file_meta in metadata["files"]:

            if not isinstance(file_meta, dict):
                raise ValueError("Invalid metadata entry: must be an object")

            if "file" not in file_meta:
                raise ValueError("Invalid metadata entry: missing 'file'")

            if "sha256" not in file_meta:
                raise ValueError(f"Missing checksum for file: {file_meta.get('file')}")

            backup_file = filepath / file_meta["file"]
            if not backup_file.is_file():
                raise FileNotFoundError(f"Backup file not found: {file_meta['file']}")

            if file_checksum(backup_file) != file_meta["sha256"]:
                raise ValueError(f"Checksum mismatch for file: {file_meta['file']}")

        result: Dict[str, Any] = {
            "status": "success",
            "file": str(file),
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
            "file": str(file),
            "errors": [str(e)],
            "took_ms": (time.monotonic_ns() - start_ns) / 1_000_000,
        }

    # --- Cleanup ---
    if remove_file:
        file.unlink(missing_ok=True)

    return result

# ---------------------------------------------------------
# Backup DB
# ---------------------------------------------------------
def backup_create() -> Dict[str, Any]:

    # Ensure backup directory exists
    base_dir = Path(get_config("BACKUP_PATH"))
    base_dir.mkdir(parents=True, exist_ok=True)

    # Timestamp used for backup file naming
    ts = generate_timestamps()
    timestamp = ts["iso"]           # per metadata/API
    file_timestamp = ts["file"]      # per filename

    # Create zip folder
    zip_name = f"backup_{file_timestamp}.zip"
    backup_path=base_dir / f"backup_{file_timestamp}"
    backup_path.mkdir(parents=True, exist_ok=True)

    # Init struttura unica
    operations = {
        "metadata": {},
        "hosts": {},
        "aliases": {},
        "archive": {},
    }

    # --- STEP ---
    operations["hosts"] = store_hosts(timestamp=timestamp, filepath=backup_path)
    operations["aliases"] = store_aliases(timestamp=timestamp, filepath=backup_path)
    operations["metadata"] = store_metadata(timestamp=timestamp, filepath=backup_path)

    # Zip Creation
    operations["archive"] = create_backup_archive(zip_name=zip_name, files_dir=backup_path, remove_files=remove_backup_files)

    return build_result(operations)

# ---------------------------------------------------------
# Get list of available backup files in backup directory
# ---------------------------------------------------------
def backup_list() -> List[Dict[str, Any]]:

    # Initialization
    backup_dir = Path(get_config("BACKUP_PATH"))
    backups = []

    if backup_dir.is_dir():
        for filepath in backup_dir.iterdir():
            if filepath.name.startswith("backup_") and filepath.suffix == ".zip":
                backups.append({
                    "file": str(filepath),
                    "name": filepath.name,
                    "created_at": datetime.fromtimestamp(filepath.stat().st_mtime, timezone.utc).isoformat(),
                    "size_bytes": filepath.stat().st_size,
                })

    return backups

# ---------------------------------------------------------
# Restore DB
# ---------------------------------------------------------
def backup_restore(backup_id: str, cleanup: bool = True) -> Dict[str, Any]:

    # Init struttura unica
    operations = {
        "archive": {},
        "metadata": {},
        "hosts": {},
        "aliases": {},
    }

    # Check if backup file exists
    backup_dir = Path(get_config("BACKUP_PATH"))
    backup_file = backup_dir / backup_id
    extract_dir = backup_dir / Path(backup_id).stem

    if not backup_file.is_file():
        logger.error(f"Backup file not found: {backup_file}")
        raise FileNotFoundError("Backup file not found")

    # --- ARCHIVE ---
    operations["archive"] = unzip_backup_archive(zip_name=backup_id, extract_dir=extract_dir)
    if operations["archive"].get("status") != "success":
        return build_result(operations)

    # --- METADATA ---
    operations["metadata"] = check_metadata(filepath=extract_dir, remove_file=remove_backup_files)
    if operations["metadata"].get("status") != "success":
        return build_result(operations)

    # --- CLEANUP ---
    if cleanup:
        try:
            reset_hosts_db()
            reset_aliases_db()
        except Exception as e:
            logger.exception("Cleanup failed %s", str(e).strip())
            raise

    # --- RESTORE FILES ---
    for f in operations["metadata"]["files"]:
        if f["name"] == "hosts":
            operations["hosts"] = restore_hosts(filepath=extract_dir, filename=f["file"], remove_file=remove_backup_files)

        elif f["name"] == "aliases":
            operations["aliases"] = restore_aliases(filepath=extract_dir, filename=f["file"], remove_file=remove_backup_files)

    if remove_backup_files:
        p = Path(extract_dir)
        if p.is_dir() and not any(p.iterdir()):
            p.rmdir()

    return build_result(operations)

# ---------------------------------------------------------
# Delete Backup Archive
# ---------------------------------------------------------
def backup_delete(backup_id: str) -> Dict[str, Any]:

    # Initialization
    start_ns = time.monotonic_ns()
    errors: List[str] = []

    backup_dir = Path(get_config("BACKUP_PATH"))
    backup_file = backup_dir / backup_id

    try:
        # Check if file exists
        if not backup_file.is_file():
            raise FileNotFoundError(f"Backup file not found: {backup_id}")

        # Remove file
        backup_file.unlink()

    except Exception as e:
        logger.exception("delete_backup failed: %s", str(e).strip())
        errors.append(str(e))

    took_ms = (time.monotonic_ns() - start_ns) / 1_000_000

    return {
        "status": "failure" if errors else "success",
        "file": str(backup_file) if not errors else None,
        "errors": errors,
        "took_ms": took_ms,
    }
