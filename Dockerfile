# Dockerfile
FROM python:3.12-slim

WORKDIR /var/www/network-manager

# Install system dependencies 
RUN apt-get update && apt-get install -y sqlite3 && rm -rf /var/lib/apt/lists/*

# Install dependencies
RUN pip install --no-cache-dir fastapi uvicorn[standard]

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
ENV DOMAIN=example.com
ENV PUBLIC_IP=127.0.0.1

# Expose the port dynamically
EXPOSE ${HTTP_PORT}

# Use the env var in the startup command
ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${HTTP_PORT}"]
