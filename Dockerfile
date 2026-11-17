# EcoRoute – single container: React frontend + FastAPI backend + SQLite
# Build:  docker build -t ecoroute .
# Run:    docker run -p 8000:8000 ecoroute   → http://localhost:8000

# ── Stage 1: build the React frontend ──
FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python backend that also serves the built site ──
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 STATIC_DIR=/app/static
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend /frontend/dist ./static
EXPOSE 8000
# Render (and most hosts) pass the port in $PORT
CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
