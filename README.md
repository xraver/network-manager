# Network Manager


## 🌐 Webapp di gestione rete

Una **webapp unificata per il controllo completo dell’infrastruttura di rete**, progettata come frontend integrato per **BIND** (DNS), **Kea DHCP** e con supporto automatico ai certificati **Let’s Encrypt**.

L’applicazione include:

- **Frontend integrato**
- **Autenticazione amministratore**
- **Database SQLite** semplice e leggero
- **Generazione automatica** delle configurazioni DNS e DHCP a partire da un dominio definito
- **Versioning locale** delle configurazioni, con storico modifiche e possibilità di rollback

Questa soluzione permette di gestire host, zone DNS, leases DHCP e certificati da un’unica interfaccia centralizzata, riducendo errori manuali e semplificando enormemente l’operatività.

Progettato per essere eseguito facilmente tramite **Docker** e **Docker Compose**, con configurazione tramite variabili d’ambiente.

---

## ✨ Caratteristiche

- Frontend statico servito dall’applicazione (`FRONTEND_DIR`)
- Database SQLite persistente (`/data/database.db`)
- Logging configurabile su console e/o file
- Protezione login con rate-limit configurabile
- Credenziali admin configurabili tramite env o Docker secrets
- Supporto per `SESSION_SECRET`: chiave personalizzata per i cookie (se mancante viene generata automaticamente)

---

## 📦 Requisiti
- Docker = 20.x
- Docker Compose = v2

---

## 🚀 Avvio rapido

### 1) Struttura consigliata
```
project/
+- docker-compose.yml
+- .env
+- secrets/
¦  +- admin_password_hash
+- data/
```

### 2) ⚙️ Configurazione tramite `.env` (opzionale)
```dotenv
# --- Host & Web ---
DOMAIN=example.com
PUBLIC_IP=127.0.0.1
HTTP_PORT=8000
# --- Admin ---
ADMIN_USER=admin
ADMIN_PASSWORD=admin
# In produzione usa ADMIN_PASSWORD_HASH_FILE
# --- Login rate limit ---
LOGIN_MAX_ATTEMPTS=5
LOGIN_WINDOW_SECONDS=600
# --- Log ---
LOG_LEVEL=INFO
LOG_TO_FILE=false
# --- Session secret (opzionale ma consigliato in produzione) ---
# SESSION_SECRET=****ReplaceWithYourSecret*****
```
Se SESSION_SECRET non è impostato, l’app genera una chiave casuale ad ogni riavvio -> le sessioni esistenti diventano invalide.

### 3) 🐳 `docker-compose.yml` di esempio
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
      # Session (opzionale)
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

## 🔧 Variabili d’ambiente supportate
| Variabile | Default | Descrizione |
|----------|-------------|----------|
| `FRONTEND_DIR` | /app/frontend | Directory del frontend |
| `DB_FILE` | /data/database.db |  File SQLite |
| `DB_RESET` | false |  Reset DB a ogni avvio |
| `LOG_LEVEL` | info |  Livello log |
| `LOG_TO_FILE` | false |  Abilita logging su file |
| `LOG_FILE` | /data/app.log |  File log applicativo |
| `LOG_ACCESS_FILE` | /data/access.log |  Access log HTTP |
| `DOMAIN` | example.com |  Dominio pubblico |
| `PUBLIC_IP` | 127.0.0.1 |  IP pubblico |
| `HTTP_PORT` | 8000 |  Porta HTTP interna |
| `LOGIN_MAX_ATTEMPTS` | 5 |  Tentativi login |
| `LOGIN_WINDOW_SECONDS` | 600 |  Finestra tentativi |
| `ADMIN_USER` | admin |  Username admin |
| `ADMIN_PASSWORD` | admin |  Password admin (sviluppo) |
| `ADMIN_PASSWORD_HASH_FILE` | /run/secrets/admin_password_hash |  Hash password admin |
| `SESSION_SECRET` | (auto‑generata) |  Secret sessione |

---

## 🔐 Gestione credenziali admin
### ✔ Sviluppo: usare variabili
```bash
ADMIN_USER=admin
ADMIN_PASSWORD=admin
```

### ✔ Produzione: usare Docker secrets
```bash
python - <<'PY'
import bcrypt
pwd = b"PasswordSicura"
print(bcrypt.hashpw(pwd, bcrypt.gensalt()).decode())
PY
```
Salvare l’hash in `./secrets/admin_password_hash`.

Docker compose lo monterà in:
```
/run/secrets/admin_password_hash
```

---

## 🔑 SESSION_SECRET
Serve a firmare i cookie.
Se impostato, l’app genera una chiave nuova ogni volta e tutte le sessioni decadono ad ogni restart.
Genera un secret forte:
```bash
openssl rand -base64 64
```
Poi:
SESSION_SECRET: "incolla-il-secret-qui"

---

## 💾 Persistenza
### Database + Log
Mappare `/data` come volume:
```yaml
volumes:
  - ./data:/data
```

---

## 📌 Comandi utili
Avvio normale:
```bash
docker compose up
```
In background:
```bash
docker compose up -d
```
Log:
```bash
docker compose logs -f network-manager
```
Ricreare il container:
```bash
docker compose up -d --force-recreate
```

---
## 🔒 Checklist Sicurezza
- Usare *ADMIN_PASSWORD_HASH_FILE* in produzione
- Disabilitare *SESSION_SECRET* per generazione automatica
- Impostare secure=True sui cookie se usi HTTPS
- Usare un reverse proxy con TLS
- Non mettere password nel repository