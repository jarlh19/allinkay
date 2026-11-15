# Stage 1: build the frontend
FROM node:24-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# Stage 2: run the API, which also serves the built frontend
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ALLINKAY_STATIC_DIR=/app/web \
    ALLINKAY_DB_PATH=/tmp/allinkay.db
WORKDIR /app
COPY backend/requirements.lock backend/requirements.lock
RUN pip install --no-cache-dir -r backend/requirements.lock
COPY backend/app backend/app
COPY data/osdr data/osdr
COPY --from=web /web/dist web
# The project website, served by the app at /site/ while the repository is private.
COPY site web/site
RUN useradd --create-home --uid 10001 allinkay
USER allinkay
EXPOSE 10000
CMD ["sh", "-c", "uvicorn app.main:create_app --factory --app-dir backend --host 0.0.0.0 --port ${PORT:-10000}"]
