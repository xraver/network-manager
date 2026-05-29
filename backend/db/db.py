# backend/db/db.py

# Import standard modules
from pathlib import Path
import sqlite3

_connection = None
_db_path: Path | None = None
_init_functions = []

# -----------------------------
# Register DB Init Function
# -----------------------------
def register_init(func):
    _init_functions.append(func)
    return func

# -----------------------------
# Configure database (path)
# -----------------------------
def configure_db(path: Path):
    global _db_path
    _db_path = path

# -----------------------------
# Init Database
# -----------------------------
def init_db():

    conn = get_db()
    cur = conn.cursor()

    for func in _init_functions:
        func(cur)

    conn.commit()

# -----------------------------
# Init Database
# -----------------------------
def create_db(db_path: Path, reset: bool = False):
    if reset and db_path.exists():
        db_path.unlink()

    created = not db_path.exists()

    db_path.parent.mkdir(parents=True, exist_ok=True)

    init_db()

    return created

# -----------------------------
# Connect to the database
# -----------------------------
def get_db():
    global _connection

    if _connection is None:
        if _db_path is None:
            raise RuntimeError("Database path not configured")

        _db_path.parent.mkdir(parents=True, exist_ok=True)

        _connection = sqlite3.connect(_db_path, check_same_thread=False)
        _connection.row_factory = sqlite3.Row

        _connection.execute("PRAGMA foreign_keys = ON;")
        # opzionale ma consigliato
        _connection.execute("PRAGMA journal_mode=WAL;")

    return _connection
