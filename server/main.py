"""Production-compatible FastAPI entrypoint."""

from __future__ import annotations

from .app import app


def main(host: str = "0.0.0.0", port: int = 7860) -> None:
    import uvicorn

    uvicorn.run(app, host=host, port=port)

__all__ = ["app", "main"]
