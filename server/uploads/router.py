"""FastAPI routes for temporary spreadsheet upload sessions."""

from __future__ import annotations

import csv
import json
from datetime import date, datetime
from io import BytesIO, StringIO
from pathlib import Path
import re
from typing import Any, Callable
from urllib.parse import quote
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import APIRouter, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
import pandas as pd

from .errors import UploadError
from .parser import ParseLimits, parse_upload
from .profiler import profile_table
from .schemas import (
    ChangePreview,
    ChangeRequest,
    DownloadWarning,
    PreviewRow,
    RevisionRequest,
    SessionSnapshot,
    ValidationRequest,
)
from .store import SessionStore, UploadSession
from .validation import formula_download_warnings


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
        validation_result=session.validation_result,
        audit_log=session.audit_log,
        revision=session.revision,
        pending_change=session.pending_change,
        applied_change_count=len(session.active_actions),
        can_undo=bool(session.active_actions) and session.pending_change is None,
        download_warnings=_download_warnings(session),
        expires_at=session.expires_at,
    )


def _session_snapshot(session_id: str) -> SessionSnapshot:
    return session_store.read(session_id, _snapshot)


def _mutated_snapshot(
    session_id: str,
    mutation: Callable[[], UploadSession],
) -> SessionSnapshot:
    return session_store.read(session_id, lambda _: _snapshot(mutation()))


def _download_warnings(session: UploadSession) -> list[DownloadWarning]:
    return formula_download_warnings(session.current_dataframe)


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
    return _session_snapshot(session.session_id)


@router.get("/sessions/{session_id}", response_model=SessionSnapshot)
def get_upload_session(session_id: str) -> SessionSnapshot:
    return _session_snapshot(session_id)


@router.post(
    "/sessions/{session_id}/change-previews",
    response_model=ChangePreview,
)
def preview_upload_change(
    session_id: str,
    request: ChangeRequest,
) -> ChangePreview:
    return session_store.preview_change(
        session_id,
        expected_revision=request.expected_revision,
        action=request.action,
    )


@router.post("/sessions/{session_id}/changes", response_model=SessionSnapshot)
def create_upload_change(
    session_id: str,
    request: ChangeRequest,
) -> SessionSnapshot:
    return _mutated_snapshot(
        session_id,
        lambda: session_store.create_change(
            session_id,
            expected_revision=request.expected_revision,
            action=request.action,
        ),
    )


@router.post(
    "/sessions/{session_id}/changes/{change_id}/approve",
    response_model=SessionSnapshot,
)
def approve_upload_change(
    session_id: str,
    change_id: str,
    request: RevisionRequest,
) -> SessionSnapshot:
    return _mutated_snapshot(
        session_id,
        lambda: session_store.approve_change(
            session_id,
            change_id,
            expected_revision=request.expected_revision,
        ),
    )


@router.post(
    "/sessions/{session_id}/changes/{change_id}/reject",
    response_model=SessionSnapshot,
)
def reject_upload_change(
    session_id: str,
    change_id: str,
    request: RevisionRequest,
) -> SessionSnapshot:
    return _mutated_snapshot(
        session_id,
        lambda: session_store.reject_change(
            session_id,
            change_id,
            expected_revision=request.expected_revision,
        ),
    )


@router.post("/sessions/{session_id}/undo", response_model=SessionSnapshot)
def undo_upload_change(
    session_id: str,
    request: RevisionRequest,
) -> SessionSnapshot:
    return _mutated_snapshot(
        session_id,
        lambda: session_store.undo(
            session_id,
            expected_revision=request.expected_revision,
        ),
    )


@router.post("/sessions/{session_id}/reset", response_model=SessionSnapshot)
def reset_upload_changes(
    session_id: str,
    request: RevisionRequest,
) -> SessionSnapshot:
    return _mutated_snapshot(
        session_id,
        lambda: session_store.reset(
            session_id,
            expected_revision=request.expected_revision,
        ),
    )


@router.post("/sessions/{session_id}/validations", response_model=SessionSnapshot)
def validate_upload_session(
    session_id: str,
    request: ValidationRequest,
) -> SessionSnapshot:
    return _mutated_snapshot(
        session_id,
        lambda: session_store.validate(
            session_id,
            expected_revision=request.expected_revision,
            required_column_ids=request.required_column_ids,
        ),
    )


def _download_filename(filename: str) -> str:
    stem = Path(filename).stem
    safe_stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("-._")
    return f"{safe_stem or 'spreadsheet'}-current.csv"


def _csv_value(value: Any) -> Any:
    json_value = _json_value(value)
    return "" if json_value is None else json_value


def _csv_bytes(session: UploadSession) -> bytes:
    text_buffer = StringIO(newline="")
    writer = csv.writer(text_buffer, lineterminator="\n")
    writer.writerow(session.display_headers)
    for row in session.current_dataframe.itertuples(index=False, name=None):
        writer.writerow([_csv_value(value) for value in row])
    return text_buffer.getvalue().encode("utf-8-sig")


@router.get("/sessions/{session_id}/download")
def download_upload_session(session_id: str) -> StreamingResponse:
    def build_download(session: UploadSession) -> tuple[bytes, str]:
        return (
            _csv_bytes(session),
            _download_filename(session.filename),
        )

    payload, filename = session_store.read(session_id, build_download)
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


def _zip_filename(filename: str) -> str:
    stem = Path(_download_filename(filename)).stem.removesuffix("-current")
    return f"{stem or 'spreadsheet'}-validated.zip"


@router.get("/sessions/{session_id}/validated-export")
def download_validated_export(session_id: str) -> StreamingResponse:
    def build_export(session: UploadSession) -> tuple[bytes, str]:
        result = session.validation_result
        if result is None or result.revision != session.revision:
            raise UploadError(
                409,
                "validation_not_run",
                "Run validation for the current table before downloading the validated export.",
            )

        buffer = BytesIO()
        with ZipFile(buffer, "w", compression=ZIP_DEFLATED) as archive:
            archive.writestr("cleaned.csv", _csv_bytes(session))
            archive.writestr(
                "validation-report.json",
                json.dumps(result.model_dump(mode="json"), indent=2).encode("utf-8"),
            )
            archive.writestr(
                "audit-log.json",
                json.dumps(
                    [entry.model_dump(mode="json") for entry in session.audit_log],
                    indent=2,
                ).encode("utf-8"),
            )
        return buffer.getvalue(), _zip_filename(session.filename)

    payload, filename = session_store.read(session_id, build_export)
    headers = {
        "Content-Disposition": (
            f"attachment; filename=\"{filename}\"; "
            f"filename*=UTF-8''{quote(filename)}"
        )
    }
    return StreamingResponse(
        BytesIO(payload),
        media_type="application/zip",
        headers=headers,
    )
