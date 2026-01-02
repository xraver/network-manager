# Dockerfile
FROM python:3.12-slim

WORKDIR /var/www/network-manager

# Install dependencies
RUN pip install --no-cache-dir fastapi uvicorn[standard]

# Copy backend and frontend
COPY backend/ /var/www/network-manager/backend/
COPY frontend/ /var/www/network-manager/frontend/

# Default environment variables
ENV DB_PATH=/data/database.db
ENV HTTP_PORT=8000

# Expose the port dynamically
EXPOSE ${HTTP_PORT}

# Use the env var in the startup command
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${HTTP_PORT}"]
