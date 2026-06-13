"""Production serving for the compiled TabulaClean frontend."""

from __future__ import annotations

from pathlib import Path
from typing import Awaitable, Callable
from urllib.parse import unquote

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from starlette.responses import Response


FRONTEND_DIST_DIR = Path(__file__).resolve().parents[1] / "frontend" / "dist"
RESERVED_FIRST_SEGMENTS = {
    "api",
    "docs",
    "health",
    "mcp",
    "metadata",
    "openapi.json",
    "play",
    "redoc",
    "reset",
    "schema",
    "state",
    "static",
    "step",
    "ws",
}
MISSING_BUILD_MESSAGE = (
    "TabulaClean frontend build is unavailable. Run npm run build in frontend/."
)


def _is_reserved_path(path: str) -> bool:
    first_segment = path.lstrip("/").split("/", 1)[0]
    return first_segment in RESERVED_FIRST_SEGMENTS


def _safe_frontend_file(path: str) -> Path | None:
    relative_path = unquote(path).lstrip("/")
    if not relative_path:
        return None

    dist_dir = FRONTEND_DIST_DIR.resolve()
    candidate = (dist_dir / relative_path).resolve()
    try:
        candidate.relative_to(dist_dir)
    except ValueError:
        return None

    return candidate if candidate.is_file() else None


def install_frontend(app: FastAPI) -> None:
    async def frontend_fallback(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        response = await call_next(request)

        if request.method != "GET" or response.status_code != 404:
            return response
        if _is_reserved_path(request.url.path):
            return response

        static_file = _safe_frontend_file(request.url.path)
        if static_file is not None:
            return FileResponse(static_file)

        accepts_html = "text/html" in request.headers.get("accept", "")
        has_file_suffix = bool(Path(request.url.path).suffix)
        if not accepts_html or has_file_suffix:
            return response

        index_file = FRONTEND_DIST_DIR / "index.html"
        if not index_file.is_file():
            return JSONResponse(
                status_code=503,
                content={"detail": MISSING_BUILD_MESSAGE},
            )

        return FileResponse(index_file)

    app.middleware("http")(frontend_fallback)
