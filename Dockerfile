# ---------- STAGE 1: BUILD ----------
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends sqlite3 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt

# ---------- STAGE 2: RUNTIME ----------
FROM python:3.12-slim

WORKDIR /var/www/network-manager

# Copy only installed packages
COPY --from=builder /install /usr/local

# Copy backend and frontend
COPY backend/ /var/www/network-manager/backend/
COPY frontend/ /var/www/network-manager/frontend/

# Copy entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Default environment variables
ENV DB_PATH=/data/database.db
ENV DB_RESET=0
ENV HTTP_PORT=8000
ENV LOGIN_MAX_ATTEMPTS=5
ENV LOGIN_WINDOW_SECONDS=600
ENV DOMAIN=example.com
ENV PUBLIC_IP=127.0.0.1

# Expose the port dynamically
EXPOSE ${HTTP_PORT}

# Use the env var in the startup command
ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${HTTP_PORT} --proxy-headers"]
