# backend/db/db.py

# Import standard modules
from pathlib import Path
import sqlite3

_connection = None
_db_path: Path | None = None
INIT_REGISTRY = {}

# ---------------------------------------------------------
# Internal: resolve init order based on dependencies
# ---------------------------------------------------------
def _resolve_init_order():
    visited = set()
    visiting = set()
    order = []

    def visit(name):
        if name in visited:
            return
        if name in visiting:
            raise RuntimeError(f"Circular dependency detected: {name}")

        visiting.add(name)

        for dep in INIT_REGISTRY[name]["depends_on"]:
            if dep not in INIT_REGISTRY:
                raise RuntimeError(f"Missing dependency: {dep}")
            visit(dep)

        visiting.remove(name)
        visited.add(name)
        order.append(name)

    for name in INIT_REGISTRY:
        visit(name)

    return order

# -----------------------------
# Register DB Init Function
# -----------------------------
def register_init(name, depends_on=None):
    if depends_on is None:
        depends_on = []

    def decorator(func):
        INIT_REGISTRY[name] = {
            "func": func,
            "depends_on": depends_on
        }
        return func

    return decorator

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

    ordered_names = _resolve_init_order()

    for name in ordered_names:
        func = INIT_REGISTRY[name]["func"]
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
