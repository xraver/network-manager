# ---------- STAGE 1: Alpine Build ----------
FROM python:3.12-alpine AS builder

# Install build dependencies
RUN apk add --no-cache build-base libffi-dev openssl-dev

WORKDIR /app

# Copy dependency list
COPY requirements.txt .

# Build wheels to avoid building in final image
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# Copy full application
COPY backend backend
COPY frontend frontend

# ---------- STAGE 2: Alpine Runtime ----------
FROM python:3.12-alpine

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    LANG=C.UTF-8

# librerie runtime
RUN apk add --no-cache libffi openssl sqlite-libs

WORKDIR /app

# Copy application and deps
COPY --from=builder /app /app
COPY --from=builder /wheels /wheels

# Install dependencies inside distroless environment
RUN pip install --no-cache-dir --no-compile /wheels/* && \
    rm -rf /wheels && \
    find /usr/local/lib/python3.12/site-packages -regex '.*\(tests\|test\|docs\|examples\).*' -type d -prune -exec rm -rf {} + && \
    rm -rf /root/.cache

RUN find /usr/local/lib/python3.12 -name '__pycache__' -type d -exec rm -rf {} +

ENTRYPOINT ["python", "-u", "-m", "backend.main"]
