# Dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir fastapi uvicorn[standard]

# Copy backend and frontend
COPY backend/ /app/backend/
COPY frontend/ /app/frontend/

# Default environment variables
ENV DB_PATH=/data/database.db
ENV APP_PORT=8000

# Expose the port dynamically (Docker ignores env here but it's good documentation)
EXPOSE ${APP_PORT}

# Use the env var in the startup command
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${APP_PORT}"]
