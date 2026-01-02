#!/bin/bash
set -euo pipefail

# ================================
# Variables
# ================================
DB_FILE="${DB_PATH:-database.db}"
DB_RESET="${DB_RESET:-0}"
DOMAIN="${DOMAIN:-example.com}"
PUBLIC_IP="${PUBLIC_IP:-127.0.0.1}"

function create_db() {
    # Reset database if requested
    if [[ $DB_RESET -eq 1 && -f "$DB_FILE" ]]; then
        echo "INFO:     [*] Removing existing database..."
        rm -f "$DB_FILE"
    fi

    # Skip creation if DB already exists
    if [[ -f "$DB_FILE" ]]; then
        echo "INFO:     [✓] Database already exists. Nothing to do."
        return 0
    fi

    echo "INFO:     [*] Creating database: $DB_FILE"

    # Create DB with dynamic settings
    sqlite3 "$DB_FILE" <<EOF
PRAGMA foreign_keys = ON;

-- ============================================
--  GLOBAL SETTINGS
-- ============================================
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

INSERT INTO settings (key, value) VALUES ('domain', '${DOMAIN}');
INSERT INTO settings (key, value) VALUES ('external_ipv4', '${PUBLIC_IP}');

-- ============================================
--  HOSTS
-- ============================================
CREATE TABLE hosts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    ipv4 TEXT,
    ipv6 TEXT,
    mac TEXT,
    note TEXT,
    ssl_enabled INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_hosts_name ON hosts(name);

-- ============================================
--  ALIASES
-- ============================================
CREATE TABLE aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    host_id INTEGER NOT NULL,
    alias TEXT NOT NULL,
    note TEXT,
    ssl_enabled INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (host_id) REFERENCES hosts(id)
);

CREATE INDEX idx_aliases_host ON aliases(host_id);

-- ============================================
--  TXT RECORDS
-- ============================================
CREATE TABLE txt_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    note TEXT,
    host_id INTEGER,
    FOREIGN KEY (host_id) REFERENCES hosts(id)
);

CREATE INDEX idx_txt_host ON txt_records(host_id);
EOF

    echo "INFO:     [✓] Database initialized successfully for $DOMAIN."
    echo "INFO:     [✓] Public IP: $PUBLIC_IP."
}

# ================================
# Parse arguments
# ================================
while [[ $# -gt 0 ]]; do
    case "$1" in
        --reset)
            DB_RESET=1
            shift
            ;;
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --public-ip)
            PUBLIC_IP="$2"
            shift 2
            ;;
        --)
            shift
            break
            ;;
        *)
            break
            ;;
    esac
done

create_db

# ================================
# Continue to CMD
# ================================
exec "$@"
