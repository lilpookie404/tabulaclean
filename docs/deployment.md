# TabulaClean Deployment

TabulaClean deploys as a Docker-based Hugging Face Space. The production
container builds the React app, installs the FastAPI backend dependencies,
serves `frontend/dist` through FastAPI, and listens on port `7860`.

## Local Docker Build

```bash
docker build -t tabulaclean .
```

## Local Docker Run

```bash
docker run --rm -p 7860:7860 \
  -e APP_ENV=production \
  -e PUBLIC_DEMO_MODE=true \
  -e UPLOAD_SESSION_TTL_MINUTES=30 \
  -e MAX_UPLOAD_MB=10 \
  -e MAX_ACTIVE_SESSIONS=10 \
  tabulaclean
```

The container command is:

```bash
uvicorn server.main:app --host 0.0.0.0 --port 7860
```

## Hugging Face Space Setup

Use the existing Docker Space:

- Space repo: `lilpookie404/tabulaclean`
- Public URL: `https://lilpookie404-tabulaclean.hf.space`
- SDK: Docker
- App port: `7860`

Deployment flow:

```bash
git push origin main
git push space main
```

Hugging Face builds from the root `Dockerfile`. The required public demo
settings are provided by the Docker image defaults and can also be configured
as Space variables.

## Environment Variables

Required production values:

```bash
APP_ENV=production
PUBLIC_DEMO_MODE=true
UPLOAD_SESSION_TTL_MINUTES=30
MAX_UPLOAD_MB=10
MAX_ACTIVE_SESSIONS=10
```

Optional AI suggestion configuration:

```bash
API_BASE_URL=https://router.huggingface.co/v1
MODEL_NAME=<openai-compatible-model-name>
HF_TOKEN=<space-secret-token>
```

If the optional AI configuration is missing, times out, or returns invalid
JSON, TabulaClean keeps working with local deterministic suggestions.

## Smoke Test Checklist

Run these against local Docker at `http://localhost:7860` and again against
the live Space.

- `GET /health`
- `GET /`
- `GET /review`
- `GET /review-changes`
- `GET /model-evaluation`
- `GET /failure-cases`
- Upload a CSV file.
- Upload an XLSX file.
- Use the public sample upload buttons.
- Confirm issue detection appears.
- Generate suggestions.
- Preview and apply a safe fix.
- Preview a risky fix, approve it in Review Changes, and confirm it applies.
- Run validation.
- Download the current CSV.
- Download the validation ZIP after validation.
- Refresh a live session URL and confirm the session restores.
- Confirm an expired or missing session shows friendly fallback UI.

## Production Safety Checklist

- Unexpected production API errors return a generic JSON error.
- API responses do not expose stack traces, local paths, uploaded file
  contents, preview row values, or raw table data.
- Upload size and active-session capacity errors use friendly messages.
- Uploaded files remain temporary process-local session data.
- Public demo copy warns users not to upload sensitive, personal, financial,
  or confidential data.

## Known limitations

- Upload sessions are process-local and expire automatically.
- There are no accounts, persistent storage, or collaborative sessions.
- Hugging Face cold starts can make the first request slower.
- Optional AI suggestions only rank, reword, or explain local candidates; they
  do not create new backend action payloads.
- Public demo limits are intentionally small: `MAX_UPLOAD_MB=10` and
  `MAX_ACTIVE_SESSIONS=10`.
