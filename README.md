# Network Manager
[![Last Commit][last-commit-img]][last-commit-url]
[![License Status][license-img]][license-url]
[![BuyMeCoffee][buymecoffee-img]][buymecoffee-url]

## 🌐 Network management web app

A **unified web app for complete control of your network infrastructure**, designed as an integrated frontend for **BIND** (DNS), **Kea DHCP**, and with automatic support for **Let’s Encrypt** certificates.

The application includes:

- **Integrated frontend**
- **Administrator authentication**
- Simple and lightweight **SQLite database**
- **Automatic generation** of DNS and DHCP configurations from a defined domain
- **Local versioning** of configurations, with change history and rollback capability

This solution allows you to manage hosts, DNS zones, DHCP leases, and certificates from a single centralized interface, reducing manual errors and greatly simplifying operations.

Designed to run easily via **Docker** and **Docker Compose**, with configuration via environment variables.

This project is currently under development. For upcoming tasks and planned improvements, please refer to the [TODO list](TODO.md) file.

---

## ✨ Features

- Static frontend served by the application (`FRONTEND_DIR`)
- Persistent SQLite database (`/data/database.db`)
- Configurable logging to console and/or file
- Login protection with configurable rate-limit
- Admin credentials configurable via env or Docker secrets
- Support for `SESSION_SECRET`: custom key for cookies (if missing, it is generated automatically)

---

## 📦 Requirements
- Docker = 20.x
- Docker Compose = v2

---

## 🚀 Quick start

### 1) Recommended structure
```
project/
+- docker-compose.yml
+- .env
+- secrets/
¦  +- admin_password_hash
+- data/
```

### 2) ⚙️ Configuration via `.env` (optional)
```dotenv
# --- Host & Web ---
DOMAIN=example.com
PUBLIC_IP=127.0.0.1
HTTP_PORT=8000
# --- Admin ---
ADMIN_USER=admin
ADMIN_PASSWORD=admin
# In production use ADMIN_PASSWORD_HASH_FILE
# --- Login rate limit ---
LOGIN_MAX_ATTEMPTS=5
LOGIN_WINDOW_SECONDS=600
# --- Log ---
LOG_LEVEL=INFO
LOG_TO_FILE=false
# --- Session secret (optional but recommended in production) ---
# SESSION_SECRET=****ReplaceWithYourSecret*****
```
If SESSION_SECRET is not set, the app generates a random key on each restart -> existing sessions become invalid.

### 3) 🐳 Example `docker-compose.yml`
```yaml
services:
  network-manager:
    image: your-registry/network-manager:latest
    container_name: network-manager
    restart: unless-stopped
    ports:
      - "${HTTP_PORT:-8000}:8000"
    environment:
      # Frontend
      FRONTEND_DIR: "/app/frontend"
      # Database
      DB_FILE: "/data/database.db"
      DB_RESET: "${DB_RESET:-false}"
      # Log
      LOG_LEVEL: "${LOG_LEVEL:-INFO}"
      LOG_TO_FILE: "${LOG_TO_FILE:-false}"
      LOG_FILE: "/data/app.log"
      LOG_ACCESS_FILE: "/data/access.log"
      # Host
      DOMAIN: "${DOMAIN:-example.com}"
      PUBLIC_IP: "${PUBLIC_IP:-127.0.0.1}"
      # Web
      HTTP_PORT: "${HTTP_PORT:-8000}"
      LOGIN_MAX_ATTEMPTS: "${LOGIN_MAX_ATTEMPTS:-5}"
      LOGIN_WINDOW_SECONDS: "${LOGIN_WINDOW_SECONDS:-600}"
      # Admin
      ADMIN_USER: "${ADMIN_USER:-admin}"
      ADMIN_PASSWORD: "${ADMIN_PASSWORD:-admin}"
      ADMIN_PASSWORD_HASH_FILE: "/run/secrets/admin_password_hash"
      # Session key (optional)
      # SESSION_SECRET: "****ReplaceWithYourSecret*****"
    volumes:
      - ./data:/data
    secrets:
      - admin_password_hash

secrets:
  admin_password_hash:
    file: ./secrets/admin_password_hash
```

---

## 🔧 Supported environment variables
| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_DIR` | /app/frontend | Frontend directory |
| `DB_FILE` | /data/database.db |  SQLite file |
| `DB_RESET` | false |  Reset DB on every startup |
| `LOG_LEVEL` | info |  Log level |
| `LOG_TO_FILE` | false |  Enable file logging |
| `LOG_FILE` | /data/app.log |  Application log file |
| `LOG_ACCESS_FILE` | /data/access.log |  HTTP access log |
| `DOMAIN` | example.com |  Public domain |
| `PUBLIC_IP` | 127.0.0.1 |  Public IP |
| `HTTP_PORT` | 8000 |  Internal HTTP port |
| `LOGIN_MAX_ATTEMPTS` | 5 |  Login attempts |
| `LOGIN_WINDOW_SECONDS` | 600 |  Attempt window |
| `ADMIN_USER` | admin |  Admin username |
| `ADMIN_PASSWORD` | admin |  Admin password (development) |
| `ADMIN_PASSWORD_HASH_FILE` | /run/secrets/admin_password_hash |  Admin password hash |
| `SESSION_SECRET` | (auto-generated) |  Session secret |

---

## 🔐 Admin credential management
### ✔ Development: use variables
```bash
ADMIN_USER=admin
ADMIN_PASSWORD=admin
```

### ✔ Production: use Docker secrets
```bash
python - <<‘PY’
import bcrypt
pwd = b“SecurePassword”
print(bcrypt.hashpw(pwd, bcrypt.gensalt()).decode())
PY
```
Save the hash in `./secrets/admin_password_hash`.

Docker compose will mount it in:
```
/run/secrets/admin_password_hash
```

---

## 🔑 SESSION_SECRET
Used to sign cookies.
If set, the app generates a new key each time and all sessions expire on each restart.
Generate a strong secret:
```bash
openssl rand -base64 64
```
Then:
`SESSION_SECRET`: “paste-the-secret-here”

---

## 💾 Persistence
### Database + Log
Map `/data` as a volume:
```yaml
volumes:
  - ./data:/data
```

---

## 📌 Useful commands
Normal startup:
```bash
docker compose up
```
In the background:
```bash
docker compose up -d
```
Log:
```bash
docker compose logs -f network-manager
```
Container recreation:
```bash
docker compose up -d --force-recreate
```
Container rebuild & recreation:
```
docker compose up --build -d --force-recreate
```

---
## 🔒 Security Checklist
- Use `ADMIN_PASSWORD_HASH_FILE` in production
- Disable `SESSION_SECRET` for automatic generation
- Set `secure=True` on cookies if you use HTTPS
- Use a reverse proxy with TLS
- Do not put passwords in the repository

---  
## 📄 License
[MIT](http://opensource.org/licenses/MIT) – see the local [LICENSE](LICENSE) file © Giorgio Ravera

## ☕ Donate
[![BuyMeCoffee][buymecoffee-button]][buymecoffee-url]

---

[license-img]: https://img.shields.io/github/license/xraver/network-manager
[license-url]: LICENSE
[releases-img]: https://img.shields.io/github/v/release/xraver/network-manager
[releases-url]: https://github.com/xraver/network-manager/releases
[last-commit-img]: https://img.shields.io/github/last-commit/xraver/network-manager
[last-commit-url]: https://github.com/xraver/network-manager/commits/master
[buymecoffee-img]: https://img.shields.io/badge/buy%20me%20a%20coffee-donate-yellow.svg
[buymecoffee-button]: https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg
[buymecoffee-url]: https://www.buymeacoffee.com/raverag