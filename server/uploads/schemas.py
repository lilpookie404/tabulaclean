"""Public response models for upload sessions."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


FriendlyType = Literal[
    "text",
    "integer",
    "decimal",
    "boolean",
    "date",
    "datetime",
    "mixed",
    "empty",
]


class ColumnDescriptor(BaseModel):
    id: str
    name: str
    position: int
    inferred_type: FriendlyType


class PreviewRow(BaseModel):
    row_number: int
    values: dict[str, Any]


class DetectedIssue(BaseModel):
    type: str
    title: str
    message: str
    affected_count: int
    affected_unit: str
    affected_columns: list[str] = Field(default_factory=list)
    example_rows: list[int] = Field(default_factory=list)


class SessionSnapshot(BaseModel):
    session_id: str
    filename: str
    sheet_name: str | None = None
    row_count: int
    column_count: int
    columns: list[ColumnDescriptor]
    preview_rows: list[PreviewRow]
    issues: list[DetectedIssue]
    issue_count: int
    validation_status: str = "not_run"
    audit_log: list[dict[str, Any]] = Field(default_factory=list)
    expires_at: datetime
