# backend/db/db.py

# Import standard modules
import os
import sqlite3
# Import Settings
from settings.settings import settings
# Import Log
from log.log import get_logger

_connection = None
_init_functions = []

def register_init(func):
    _init_functions.append(func)
    return func

# -----------------------------
# Connect to the database
# -----------------------------
def get_db():
    global _connection
    if _connection is None:
        os.makedirs(os.path.dirname(settings.DB_FILE) or ".", exist_ok=True)
        _connection = sqlite3.connect(settings.DB_FILE, check_same_thread=False)
        _connection.row_factory = sqlite3.Row
        _connection.execute("PRAGMA foreign_keys = ON;")
    return _connection

# -----------------------------
# Init Database
# -----------------------------
def init_db():
    logger = get_logger(__name__)
    logger.info("Starting DB Initialization")

    conn = get_db()
    cur = conn.cursor()

    for func in _init_functions:
        func(cur)

    conn.commit()
    conn.close()

    logger.info("DB Initialization Completed")
