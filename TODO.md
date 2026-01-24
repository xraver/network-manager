
## 📝 To‑Do List / Workflow Operativo (Estesa)

---

### 🔄 Gestione DB all’avvio

- [ ] **Se il database è vuoto**
  - Importare YAML iniziale
  - Popolare il database

- [ ] **Se il database esiste**
  - Ignorare YAML **a meno che il file del repository sia cambiato**
  - Se YAML è variato → aggiornare il DB

---

### 🛠️ Aggiornamenti effettuati dalla Webapp

- [ ] Applicare modifiche al database
- [ ] Rigenerare YAML dal DB
- [ ] Effettuare **commit + push** su Git
- [ ] Rigenerare **da zero**:
  - [ ] Configurazione **BIND (DNS)**
  - [ ] Configurazione **Kea (DHCP)**
- [ ] Eseguire reload dei servizi:
  - [ ] BIND
  - [ ] Kea

---

### 🔍 YAML ↔ DB Coerenza Periodica

- [ ] Calcolare **checksum atteso** YAML
- [ ] Confrontare con **checksum reale**
- [ ] Determinare quale elemento è variato

#### Regole di sincronizzazione
- [ ] YAML cambiato → aggiornare DB
- [ ] DB cambiato → rigenerare YAML

---

## 🧩 Generazione configurazioni

### 🧪 BIND (DNS)
- [ ] Ricostruire zone forward e reverse
- [ ] Ricostruire tutti i record (A, AAAA, CNAME)
- [ ] Validazione sintassi (`named-checkconf`, `named-checkzone`)
- [ ] Gestione rollback in caso di errori

### 🧪 Kea (DHCP)
- [ ] Rigenerare subnet, pool, opzioni globali e host reservations
- [ ] Validare config JSON (`kea-dhcp4 -t`)
- [ ] Rollback se la sintassi non è valida

---

## 🧭 Versioning Git

- [ ] Controllare modifiche locali (`git status`)
- [ ] Applicare commit automatico con messaggi standard
- [ ] Push verso il repository remoto
- [ ] Tenere traccia delle versioni YAML generate
- [ ] Usare Git come audit delle modifiche

---

## 🩺 Controllo Servizi (Health Check)

### 🔎 BIND
- [ ] Controllo stato servizio
- [ ] Verifica log per errori

### 🔎 Kea
- [ ] Controllo stato DHCP4/DHCP6
- [ ] Verifica errori da log agent

---

# 🔐 Hardening Sicurezza Web

### 🔒 Sessioni & Cookie
- [ ] Impostare `secure=True` quando si usa HTTPS  
- [ ] Impostare `httponly=True` per prevenire accesso via JS  
- [ ] Impostare `samesite=Strict` o `Lax` a seconda dell’uso  
- [ ] Rotazione controllata di `SESSION_SECRET` (manuale o programmata)

### 🛡 Protezione HTTP
- [ ] Headers di sicurezza:
  - [ ] `Content-Security-Policy`
  - [ ] `Strict-Transport-Security`
  - [ ] `X-Frame-Options`
  - [ ] `X-Content-Type-Options`
  - [ ] `Referrer-Policy`
- [ ] Abilitare TLS tramite reverse proxy
- [ ] Rate limiting aggiuntivo su IP e endpoint sensibili

### 🔥 Protezione applicativa
- [ ] Validazione input DNS/DHCP (hostname, IP, subnet)
- [ ] Sanitizzazione input contro injection YAML/XML/JSON
- [ ] Audit log delle modifiche critiche
- [ ] Protezione contro brute force (ce l’hai già 👍)

### 🔧 Backup & Recovery
- [ ] Backup periodico del DB SQLite
- [ ] Backup del repository Git su remoto
- [ ] Backup delle configurazioni generate

---

# 👥 Gestione Utenti (RBAC)

### 🎛 Ruoli previsti
- [ ] **admin** — accesso completo a tutto  
- [ ] **operator** — può modificare host/DNS/DHCP ma non gestione utenti  
- [ ] **viewer** — sola lettura

### 🧩 Funzionalità da implementare
- [ ] Creazione utenti  
- [ ] Reset password  
- [ ] Disabilitazione utenti  
- [ ] Cambio password admin  
- [ ] Autenticazione basata su hash (bcrypt o argon2)  
- [ ] Audit log (chi ha fatto cosa, quando)  
- [ ] Timeout sessioni  
- [ ] Protezione contro session hijacking  
- [ ] Logout globale / invalidazione sessioni

---

# ⭐ Checklist finale

- [ ] Gestione DB ↔ YAML completa
- [ ] Generazione BIND/Kea con validazione & rollback
- [ ] Versioning Git
- [ ] Health-check BIND/Kea
- [ ] Hardening sicurezza web
- [ ] Gestione utenti + ruoli
- [ ] Notifiche (email/webhook)
- [ ] Backup DB + backup Git
- [ ] Test automatici
