# Quick Start

This guide deploys a persistent Network Manager instance for homelab or small network environments.
For production deployments, review the security recommendations before exposing the application to untrusted networks.

## Prerequisites

- Docker Engine with the Compose plugin, or another compatible container runtime.
- TCP port 8000 available on the host.
- A writable data volume for the SQLite database, backups, and logs.
- A modern web browser.

## Option 1: Docker Compose

Download the homelab Compose file and start WebSSH:

```bash
mkdir network-manager-deployment
cd network-manager-deployment
curl -O https://raw.githubusercontent.com/xraver/network-manager/main/docker-compose.yaml
docker compose up -d
```

PowerShell:

```powershell
New-Item -ItemType Directory -Path network-manager-deployment
Set-Location network-manager-deployment
Invoke-WebRequest `
  https://raw.githubusercontent.com/xraver/network-manager/main/docker-compose.yaml `
  -OutFile docker-compose.yml
docker compose up -d
```

Open `http://localhost:8000` or replace `localhost` with the host address.

## Option 2: Docker run

```bash
docker run -d \
  --name network-manager \
  -p 8000:8000 \
  -e DOMAIN=example.com \
  -e EXTERNAL_NAME=dyndns.example.com \
  -e ADMIN_USER=admin \
  -e ADMIN_PASSWORD=admin \
  -v network_manager_data:/data \
  --restart unless-stopped \
  ghcr.io/xraver/network-manager:latest
```

The persistent volume is essential. It stores:
- SQLite database
- Configuration data
- Backups
- Application logs

Removing the volume will permanently remove all stored data.

## Administrator Password

By default, the application creates the administrator account using the configured environment variables:
```bash
ADMIN_USER=admin
ADMIN_PASSWORD=admin
```
For production environments, avoid plaintext passwords and use a Docker secret containing a bcrypt password hash.

Generate a password hash:
```python
python - <<'PY'
import bcrypt

password = b"SecurePassword"
print(bcrypt.hashpw(password, bcrypt.gensalt()).decode())
PY
```
Save the result to:
```bash
./secrets/admin_password_hash
```

and reference it through:
```bash
ADMIN_PASSWORD_HASH_FILE: /run/secrets/admin_password_hash
```

## Verify the instance

Check container state and readiness:

```bash
docker compose ps
curl -fsS http://localhost:8000/about
curl -fsS http://localhost:8000/api/health
```

You should receive an HTTP response from the application.

```json
{
  "app": {
    "name": "network-manager",
    "version": "1.0.0"
  },
  "domain": "example.org",
  "server_time": "2026-08-31T05:33:19.344005+00:00"
}
```

```json
{
  "status": "healthy",
  "latency_ms": 0.69,
  "database": {
    "status": "healthy",
    "version": "3.53.2",
    "tables": 6,
    "size_mb": 0.07
  }
}
```

Review logs:
```bash
docker compose logs --tail=200 network-manager
```

Open the web interface and log in using the configured administrator account.

## Next steps

- [Docker and Docker Compose](Docker-and-Docker-Compose)
- [Production Deployment](Production-Deployment)
- [Users and Account Management](Users-and-Account-Management)
- [Backup, Restore and Secret Rotation](Backup-Restore-and-Secret-Rotation)
