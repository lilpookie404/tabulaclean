"""FastAPI routes for temporary spreadsheet upload sessions."""

from __future__ import annotations

import csv
from datetime import date, datetime
from io import BytesIO, StringIO
from pathlib import Path
import re
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
import pandas as pd

from .errors import UploadError
from .parser import ParseLimits, parse_upload
from .profiler import profile_table
from .schemas import PreviewRow, SessionSnapshot
from .store import SessionStore, UploadSession


PREVIEW_ROW_LIMIT = 20
parse_limits = ParseLimits()
session_store = SessionStore()
router = APIRouter(prefix="/api", tags=["uploads"])


def _json_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (pd.Timestamp, datetime, date)):
        return value.isoformat()
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    if hasattr(value, "item"):
        return value.item()
    return value


def _snapshot(session: UploadSession) -> SessionSnapshot:
    preview_rows = [
        PreviewRow(
            row_number=int(index) + 2,
            values={
                column_id: _json_value(row[column_id])
                for column_id in session.column_ids
            },
        )
        for index, row in session.current_dataframe.head(PREVIEW_ROW_LIMIT).iterrows()
    ]
    return SessionSnapshot(
        session_id=session.session_id,
        filename=session.filename,
        sheet_name=session.sheet_name,
        row_count=len(session.current_dataframe),
        column_count=len(session.column_ids),
        columns=session.columns,
        preview_rows=preview_rows,
        issues=session.issues,
        issue_count=len(session.issues),
        validation_status=session.validation_status,
        audit_log=session.audit_log,
        expires_at=session.expires_at,
    )


async def upload_error_handler(_: Request, exc: UploadError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.code, "message": exc.message},
    )


@router.post("/uploads", response_model=SessionSnapshot, status_code=201)
async def create_upload_session(file: UploadFile) -> SessionSnapshot:
    filename = file.filename or ""
    payload = await file.read(parse_limits.max_upload_bytes + 1)
    if len(payload) > parse_limits.max_upload_bytes:
        raise UploadError(
            413,
            "file_too_large",
            "Please choose a spreadsheet no larger than 10 MB.",
        )

    parsed = parse_upload(filename, payload, limits=parse_limits)
    session = session_store.create(parsed, profile_table(parsed))
    return _snapshot(session)


@router.get("/sessions/{session_id}", response_model=SessionSnapshot)
def get_upload_session(session_id: str) -> SessionSnapshot:
    return _snapshot(session_store.get(session_id))


def _download_filename(filename: str) -> str:
    stem = Path(filename).stem
    safe_stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("-._")
    return f"{safe_stem or 'spreadsheet'}-current.csv"


def _csv_value(value: Any) -> Any:
    json_value = _json_value(value)
    return "" if json_value is None else json_value


@router.get("/sessions/{session_id}/download")
def download_upload_session(session_id: str) -> StreamingResponse:
    session = session_store.get(session_id)
    text_buffer = StringIO(newline="")
    writer = csv.writer(text_buffer, lineterminator="\n")
    writer.writerow(session.display_headers)
    for row in session.current_dataframe.itertuples(index=False, name=None):
        writer.writerow([_csv_value(value) for value in row])

    payload = text_buffer.getvalue().encode("utf-8-sig")
    filename = _download_filename(session.filename)
    headers = {
        "Content-Disposition": (
            f"attachment; filename=\"{filename}\"; "
            f"filename*=UTF-8''{quote(filename)}"
        )
    }
    return StreamingResponse(
        BytesIO(payload),
        media_type="text/csv; charset=utf-8",
        headers=headers,
    )
