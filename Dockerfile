# ---------- STAGE 1: BUILD ----------
FROM python:3.12-slim AS builder

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends sqlite3 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt

WORKDIR /app

# Copy backend, frontend, entrypoint
COPY backend backend
COPY frontend frontend
COPY entrypoint.py entrypoint.py
COPY log log
COPY settings settings
RUN chmod 755 entrypoint.py

# ---------- STAGE 2: DISTROLESS ----------
FROM gcr.io/distroless/base-debian13

# Copy Python runtime from builder
COPY --from=builder /usr/local /usr/local

# Copy libs
COPY --from=builder /lib/x86_64-linux-gnu/libsqlite3.so.0 /lib/x86_64-linux-gnu/
COPY --from=builder /lib/x86_64-linux-gnu/libz.so.1 /lib/x86_64-linux-gnu/
COPY --from=builder /lib/x86_64-linux-gnu/libbz2.so.1.0 /lib/x86_64-linux-gnu/
COPY --from=builder /lib/x86_64-linux-gnu/liblzma.so.5 /lib/x86_64-linux-gnu/
COPY --from=builder /lib/x86_64-linux-gnu/libgcc_s.so.1 /lib/x86_64-linux-gnu/

# Copy installed Python packages
COPY --from=builder /install /usr/local

WORKDIR /app

# Copy application
COPY --from=builder /app/backend backend
COPY --from=builder /app/frontend frontend
COPY --from=builder /app/entrypoint.py entrypoint.py
COPY --from=builder /app/log log
COPY --from=builder /app/settings settings

# Ensure Python sees the installed packages
ENV PYTHONPATH="/usr/local/lib/python3.12/site-packages"

ENTRYPOINT ["/app/entrypoint.py"]
CMD ["python3", "-u", "-m", "backend.main"]
