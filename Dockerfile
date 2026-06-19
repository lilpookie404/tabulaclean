FROM node:22.16.0-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV APP_ENV=production
ENV PUBLIC_DEMO_MODE=true
ENV UPLOAD_SESSION_TTL_MINUTES=30
ENV MAX_UPLOAD_MB=10
ENV MAX_ACTIVE_SESSIONS=10

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY app.py inference.py openenv.yaml /app/
COPY server /app/server
COPY tabular_cleaning_env /app/tabular_cleaning_env
COPY tasks /app/tasks
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:7860/health')" || exit 1

CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "7860"]
