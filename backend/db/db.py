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
    global _db_path, _connection

    if _connection is not None:
        raise RuntimeError("Database already initialized")

    _db_path = path


# -----------------------------
# Init Database
# -----------------------------
def init_db():
    conn = get_db()
    cur = conn.cursor()

    for func in sorted(_init_functions, key=lambda f: f.__name__):
        func(cur)

    conn.commit()

# -----------------------------
# Create Database
# -----------------------------
def create_db(reset: bool = False):
    global _connection

    if _db_path is None:
        raise RuntimeError("Database not configured. Call configure_db() first.")

    if reset:
        if _connection is not None:
            _connection.close()
            _connection = None

        if _db_path.exists():
            _db_path.unlink()

    # check if db exists
    existed_before = _db_path.exists()

    # ensure connection (creates DB file if missing)
    get_db()

    # ensure schema
    init_db()

    return not existed_before

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
