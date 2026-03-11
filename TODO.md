
## 📝 To-Do List / Operational Workflow (Extended)

---

### 🔄 DB management at startup

- [X] **If the database is empty**
  - [ ] Import initial YAML
  - [X] Populate the database

- [X] **If the database exists**
  - [ ] Ignore YAML **unless the repository file has changed**
  - [ ] If YAML has changed → update the DB

---

### 🛠️ Updates made by the Webapp

- [X] Apply changes to the database
- [ ] Regenerate YAML from the DB
- [ ] Perform **commit + push** on Git
- [ ] Regenerate **from scratch**:
  - [ ] **BIND (DNS)** configuration
    - [X] hosts configuration
    - [X] alias configuration
    - [X] reverse configuration
    - [ ] IPv6 configuration
  - [X] **Kea (DHCP)** configuration
    - [X] IPv4 configuration
    - [X] IPv6 configuration
- [ ] Reload services:
  - [ ] BIND
  - [ ] Kea

---

### 🔍 YAML ↔ DB Periodic Consistency

- [ ] Calculate YAML **expected checksum**
- [ ] Compare with **actual checksum**
- [ ] Determine which element has changed

#### Synchronization rules
- [ ] YAML changed → update DB
- [ ] DB changed → regenerate YAML

---

## 🧩 Configuration Generation

### 🧪 BIND (DNS)
- [X] Rebuild forward and reverse zones
- [X] Rebuild all records (A, AAAA, CNAME)
- [X] Support DNS views (local, global, alias -> CNAME to dyndns/external IP)
- [ ] Syntax validation (`named-checkconf`, `named-checkzone`)
- [ ] Rollback management in case of errors
- [ ] Update external DNS
  - [ ] Dedicated file
  - [ ] OVH
  - [ ] Cloudflare

### 🧪 Kea (DHCP)
- [X] Regenerate subnets, pools, global options, and host reservations
- [ ] Validate JSON configuration (`kea-dhcp4 -t`)
- [ ] Rollback if syntax is invalid

---

## 🧭 Git versioning

- [ ] Check local changes (`git status`)
- [ ] Apply automatic commit with standard messages
- [ ] Push to remote repository
- [ ] Keep track of generated YAML versions
- [ ] Use Git as an audit of changes

---

## 🩺 Service Check (Health Check)

### 🔎 BIND
- [ ] Service status check
- [ ] Check logs for errors

### 🔎 Kea
- [ ] DHCP4/DHCP6 status check
- [ ] Check agent logs for errors

---

# 🔐 Web Security Hardening

### 🔒 Sessions & Cookies
- [ ] Set `secure=True` when using HTTPS
- [ ] Set `httponly=True` to prevent access via JS
- [ ] Set `samesite=Strict` or `Lax` depending on use
- [ ] Controlled rotation of `SESSION_SECRET` (manual or scheduled)

### 🛡 HTTP Protection
- [ ] Security headers:
  - [ ] `Content-Security-Policy`
  - [ ] `Strict-Transport-Security`
  - [ ] `X-Frame-Options`
  - [ ] `X-Content-Type-Options`
  - [ ] `Referrer-Policy`
- [ ] Enable TLS via reverse proxy
- [ ] Additional rate limiting on sensitive IPs and endpoints

### 🔥 Application protection
- [ ] DNS/DHCP input validation (hostname, IP, subnet)
- [ ] Input sanitization against YAML/XML/JSON injection
- [ ] Audit log of critical changes
- [ ] Brute force protection (you already have this 👍)

### 🔧 Backup & Recovery
- [X] Backup generation
- [ ] Periodic backup of SQLite DB
- [ ] Remote Git repository backup
- [ ] Backup of generated configurations

### 🌍 Language
- [ ] Localization

---

# 👥 User Management (RBAC)

### 🎛 Planned roles
- [ ] **admin** — full access to everything
- [ ] **operator** — can modify host/DNS/DHCP but not user management
- [ ] **viewer** — read-only

### 🧩 Features to be implemented
- [ ] User creation
- [ ] Password reset
- [ ] User disabling
- [ ] Admin password change
- [ ] Hash-based authentication (bcrypt or argon2)
- [ ] Audit log (who did what, when)
- [ ] Session timeout
- [ ] Protection against session hijacking
- [ ] Global logout / session invalidation

---

# ⭐ Final checklist

- [ ] Complete DB ↔ YAML management
- [ ] BIND/Kea generation with validation & rollback
- [ ] Git versioning
- [ ] BIND/Kea health check
- [ ] Web security hardening
- [ ] User + role management
- [ ] Notifications (email/webhook)
- [ ] DB backup + Git backup
- [ ] Automatic tests
