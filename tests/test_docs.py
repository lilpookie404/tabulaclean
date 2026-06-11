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
