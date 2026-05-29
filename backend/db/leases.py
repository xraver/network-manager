# backend/routes/dhcp.py

# import standard modules
import csv
from pathlib import Path
from typing import Any, Dict, List, Optional

# Import local modules
from backend.utils import to_bool, to_int

# Import Settings
from backend.settings.settings import settings
# Import Logging
from backend.log.log import get_logger

ALIASES_MAP = {
    "client_id": "client-id",
    "valid_lifetime": "valid-lft",
    "subnet_id": "subnet-id",
    "fqdn_fwd": "fqdn-fwd",
    "fqdn_rev": "fqdn-rev",
    "user_context": "user-context",
    "pool_id": "pool-id",
}

# -----------------------------
# Normalizes column names to expected keys
# -----------------------------
def _norm(col: str) -> str:
    return ALIASES_MAP.get((col or "").strip(), col)

# Logger initialization
logger = get_logger(__name__)

# -----------------------------
# SELECT ALL LEASES
# -----------------------------
def get_leases(filter_devices: bool = False) -> List[Dict[str, Any]]:
    leases = []
    index = 1  # 1-based id for frontend

    path = settings.DHCP4_LEASES_FILE
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    # Open the file in lettura (non locking): ok per kea memfile
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            return []

        for raw in reader:
            rec = {_norm(k): (v if v is not None else "") for k, v in raw.items()}

            base = {
                "ipv4": rec.get("address", "").strip() or None,
                "mac": rec.get("hwaddr", "").strip().lower() or None,
                "name": rec.get("hostname", "").strip() or None,
                "dhcp_state": rec.get("state", "").strip() or None,
            }

            if not filter_devices:
                item = {
                    "id": index,
                    **base,
                    "client_id": rec.get("client-id", "").strip() or None,
                    "valid_lifetime": to_int(rec.get("valid-lft", "")),
                    "expire": rec.get("expire", "").strip() or None,
                    "subnet_id": to_int(rec.get("subnet-id", "")),
                    "fqdn_fwd": to_bool(rec.get("fqdn-fwd", "")),
                    "fqdn_rev": to_bool(rec.get("fqdn-rev", "")),
                    "user_context": rec.get("user-context", "").strip() or None,
                    "pool_id": to_int(rec.get("pool-id", "")),
                }
            else:
                item = {
                    "id": f"d-{index}",  # Frontend requires this format
                    **base,
                }

            leases.append(item)
            index += 1

    return leases

# -----------------------------
# SELECT SINGLE LEASE
# -----------------------------
def get_lease(lease_id: int) -> Optional[Dict[str, Any]]:
    path = settings.DHCP4_LEASES_FILE
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            return None

        for index, raw in enumerate(reader, start=1):
            if index == lease_id:
                rec = {_norm(k): (v if v is not None else "") for k, v in raw.items()}

                return {
                    "id":             index,
                    "ipv4":           rec.get("address", "").strip() or None,
                    "mac":            rec.get("hwaddr", "").strip().lower() or None,
                    "client_id":      rec.get("client-id", "").strip() or None,
                    "valid_lifetime": to_int(rec.get("valid-lft", "")),
                    "expire":         rec.get("expire", "").strip() or None,
                    "subnet_id":      to_int(rec.get("subnet-id", "")),
                    "fqdn_fwd":       to_bool(rec.get("fqdn-fwd", "")),
                    "fqdn_rev":       to_bool(rec.get("fqdn-rev", "")),
                    "name":           rec.get("hostname", "").strip() or None,
                    "dhcp_state":     rec.get("state", "").strip() or None,
                    "user_context":   rec.get("user-context", "").strip() or None,
                    "pool_id":        to_int(rec.get("pool-id", "")),
                }

    return None

# -----------------------------
# DELETE LEASE
# -----------------------------
def delete_lease(lease_id: int):

    path = settings.DHCP4_LEASES_FILE
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    with path.open("r", encoding="utf-8", newline="") as f:
        lines = f.readlines()

    # file empty or only header
    if len(lines) < 2:
        raise ValueError(f"Lease file is empty: {path}")

    header = lines[0]
    data_lines = lines[1:]
    index = lease_id - 1  # lease_id is 1-based, index is 0-based

    # Index out of range
    if index < 0 or index >= len(data_lines):
        raise ValueError(f"Lease index out of range: {lease_id}")

    # delete the line
    data_lines.pop(index)

    # Rewrite the file without the deleted line
    with path.open("w", encoding="utf-8", newline="") as f:
        f.writelines([header] + data_lines)
