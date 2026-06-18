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


def test_project_direction_marks_phase_one_foundation_complete() -> None:
    direction = Path("docs/PROJECT_DIRECTION.md").read_text(encoding="utf-8")
    assert "React, TypeScript, and Vite foundation" in direction
    assert "Phase 2" in direction
    assert "upload sessions" in direction
    assert "Phase 3 adds deterministic manual cleaning" in direction
    assert "Phase 4 adds uploaded-file validation" in direction
    assert "Phase 5 adds on-demand hybrid suggestions" in direction
    assert "metadata" in direction
    assert "full-table model calls" in direction
