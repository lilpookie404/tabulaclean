from __future__ import annotations

from pathlib import Path


def test_readme_contains_core_commands() -> None:
    readme = Path("README.md").read_text(encoding="utf-8")
    assert "# TabulaClean" in readme
    assert "## Project Direction" in readme
    assert "quality checks" in readme
    assert "openenv validate" in readme
    assert "docker build" in readme
    assert "python3 inference.py" in readme
    assert "requirements-dev.txt" in readme
    assert "frontend" in readme
    assert "npm ci" in readme
    assert "npm run dev" in readme
    assert "npm run build" in readme
    assert "docker build -t tabulaclean" in readme
    assert "Phase 2" in readme
    assert "Phase 3" in readme
    assert "change-previews" in readme
    assert "Phase 4" in readme
    assert "validated-export" in readme
    assert "validation ZIP" in readme
    assert "Phase 5" in readme
    assert "suggestions" in readme
    assert "metadata-only model" in readme
    assert "Phase 6" in readme
    assert "Live Demo: https://lilpookie404-tabulaclean.hf.space" in readme
    assert "## Screenshots" in readme
    assert "## Tech Stack" in readme
    assert "GitHub Issues" in readme


def test_deployment_docs_cover_public_release_workflow() -> None:
    deployment = Path("docs/deployment.md").read_text(encoding="utf-8")

    assert "docker build -t tabulaclean" in deployment
    assert "docker run --rm -p 7860:7860" in deployment
    assert "uvicorn server.main:app --host 0.0.0.0 --port 7860" in deployment
    assert "lilpookie404/tabulaclean" in deployment
    assert "APP_ENV=production" in deployment
    assert "PUBLIC_DEMO_MODE=true" in deployment
    assert "UPLOAD_SESSION_TTL_MINUTES=30" in deployment
    assert "MAX_UPLOAD_MB=10" in deployment
    assert "MAX_ACTIVE_SESSIONS=10" in deployment
    assert "API_BASE_URL" in deployment
    assert "MODEL_NAME" in deployment
    assert "HF_TOKEN" in deployment
    assert "/health" in deployment
    assert "/review" in deployment
    assert "Known limitations" in deployment


def test_project_direction_marks_phase_one_foundation_complete() -> None:
    direction = Path("docs/PROJECT_DIRECTION.md").read_text(encoding="utf-8")
    assert "React, TypeScript, and Vite foundation" in direction
    assert "Phase 2" in direction
    assert "upload sessions" in direction
    assert "Phase 3 adds deterministic manual cleaning" in direction
    assert "Phase 4 adds uploaded-file validation" in direction
    assert "Phase 5 adds on-demand hybrid suggestions" in direction
    assert "Phase 6 removes internal placeholder pages from the primary navigation" in direction
    assert "metadata" in direction
    assert "full-table model calls" in direction
