# Network Manager

Welcome to the **Network Manager Wiki**.

Network Manager is a web-based platform designed to simplify the administration of network infrastructure through a centralized management interface. It integrates DNS, DHCP, and certificate management into a single solution, providing administrators with complete visibility and control over their network environment.

---

## 🌐 What is Network Manager?

Network Manager is an integrated frontend for:

- **BIND DNS**
- **Kea DHCP**
- **Let's Encrypt** certificate management

The application automatically generates and manages network configurations while maintaining a local configuration history that supports auditing and rollback operations. It is designed to reduce operational complexity, eliminate manual configuration errors, and provide a single source of truth for network services management.

---

## ✨ Key Features

### DNS Management

Manage DNS zones and records through a modern web interface.

### DHCP Management

Configure and administer DHCP services and network hosts.

### Automated Configuration Generation

Generate DNS and DHCP configurations automatically from your defined domain and network settings.

### Configuration Versioning

Track changes, review history, and roll back to previous configurations when required.

### Security & Authentication

- Administrator authentication
- Configurable login rate limiting
- Docker Secrets support
- Secure session management with customizable session keys

### Lightweight & Self-Hosted

- SQLite-based persistence
- Minimal infrastructure requirements
- Easy deployment with Docker and Docker Compose

### Centralized Administration

Manage hosts, DNS zones, DHCP leases, and certificates from a single interface.

---

## 🏗 Architecture Overview

```text
┌─────────────────────────┐
│     Web Interface       │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│    Network Manager      │
│      Backend/API        │
└───────┬─────────┬───────┘
        │         │
        ▼         ▼
    BIND DNS   Kea DHCP
        │
        ▼
 Let's Encrypt
```

---

## 🚀 Getting Started

Deploying Network Manager is straightforward:

1. Prepare a Docker environment.
2. Configure application settings through environment variables.
3. Launch the application using Docker Compose.
4. Access the web interface and start managing your network services.

For detailed installation instructions, continue with the **Getting Started** section of this wiki.

---

## 📚 Documentation

### Introduction

- Overview
- Architecture
- Design Principles

### Installation

- Requirements
- Docker Deployment
- Environment Setup

### Configuration

- Environment Variables
- Authentication
- Session Management
- Logging

### Administration

- DNS Management
- DHCP Management
- Host Management
- Certificate Management

### Operations

- Backup & Restore
- Configuration Rollback
- Monitoring & Logs
- Troubleshooting

### Development

- Development Setup
- Project Structure
- Roadmap
- Contributing

---

## 📦 Technology Stack

- Python Backend
- SQLite Database
- BIND DNS
- Kea DHCP
- Let's Encrypt
- Docker
- Docker Compose

---

## 🎯 Project Goals

Network Manager aims to provide:

- A unified interface for network service administration
- Automated generation of service configurations
- Secure and auditable infrastructure management
- Simplified deployment and maintenance
- Reliable configuration tracking and recovery mechanisms

---

## 🚧 Project Status

Network Manager is an actively developed project. New features and improvements are continuously planned and tracked through the project roadmap and TODO list.

---

## 🤝 Contributing

Contributions, bug reports, feature requests, and feedback are welcome.

If you'd like to help improve Network Manager:

1. Open an issue to discuss proposed changes.
2. Fork the repository.
3. Create a feature branch.
4. Submit a pull request.

Together we can build a powerful, modern, and easy-to-use network management platform.

---

**Next:** → [[Getting Started]]
