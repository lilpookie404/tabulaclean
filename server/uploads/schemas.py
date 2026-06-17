"""Public response models for upload sessions."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal

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


class TrimWhitespaceAction(BaseModel):
    type: Literal["trim_whitespace"] = "trim_whitespace"
    column_ids: list[str] = Field(min_length=1)


class RenameColumnAction(BaseModel):
    type: Literal["rename_column"] = "rename_column"
    column_id: str
    new_name: str


class FillMissingAction(BaseModel):
    type: Literal["fill_missing"] = "fill_missing"
    column_id: str
    strategy: Literal["explicit", "mean", "median", "most_common"]
    value: Any | None = None


class DropDuplicatesAction(BaseModel):
    type: Literal["drop_duplicates"] = "drop_duplicates"
    keep: Literal["first", "last"] = "first"


class ConvertNumericAction(BaseModel):
    type: Literal["convert_numeric"] = "convert_numeric"
    column_id: str
    target_type: Literal["integer", "decimal"]


class DropEmptyColumnsAction(BaseModel):
    type: Literal["drop_empty_columns"] = "drop_empty_columns"
    column_ids: list[str] = Field(min_length=1)


class StandardizeDateAction(BaseModel):
    type: Literal["standardize_date"] = "standardize_date"
    column_id: str
    date_order: Literal["month_first", "day_first"]
    output_format: Literal["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"]


CleaningAction = Annotated[
    TrimWhitespaceAction
    | RenameColumnAction
    | FillMissingAction
    | DropDuplicatesAction
    | ConvertNumericAction
    | DropEmptyColumnsAction
    | StandardizeDateAction,
    Field(discriminator="type"),
]


class ChangeSample(BaseModel):
    row_number: int | None = None
    before: dict[str, Any] = Field(default_factory=dict)
    after: dict[str, Any] = Field(default_factory=dict)


class ChangePreview(BaseModel):
    base_revision: int
    action_type: str
    summary: str
    risk: Literal["low", "high"]
    affected_count: int
    affected_unit: str
    unresolved_count: int = 0
    samples: list[ChangeSample] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class PendingChange(ChangePreview):
    change_id: str
    action: CleaningAction
    created_at: datetime


class AuditEntry(BaseModel):
    event_id: str
    change_id: str | None = None
    action_type: str
    summary: str
    risk: Literal["low", "high"] | None = None
    status: Literal["applied", "pending", "approved", "rejected", "undone", "reset"]
    affected_count: int = 0
    affected_unit: str = "changes"
    column_ids: list[str] = Field(default_factory=list)
    timestamp: datetime
    revision: int


class DownloadWarning(BaseModel):
    code: str
    title: str
    message: str
    affected_count: int


class ValidationCheck(BaseModel):
    check_id: str
    title: str
    status: Literal["passed", "failed", "warning"]
    severity: Literal["error", "warning", "info"]
    message: str
    affected_count: int = 0
    affected_columns: list[str] = Field(default_factory=list)
    example_rows: list[int] = Field(default_factory=list)


class ValidationResult(BaseModel):
    status: Literal["passed", "failed"]
    revision: int
    required_column_ids: list[str] = Field(default_factory=list)
    ran_at: datetime
    checks: list[ValidationCheck]
    summary: dict[str, int]


class ChangeRequest(BaseModel):
    expected_revision: int = Field(ge=0)
    action: CleaningAction


class RevisionRequest(BaseModel):
    expected_revision: int = Field(ge=0)


class ValidationRequest(BaseModel):
    expected_revision: int = Field(ge=0)
    required_column_ids: list[str] = Field(default_factory=list)


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
    validation_result: ValidationResult | None = None
    audit_log: list[AuditEntry] = Field(default_factory=list)
    revision: int = 0
    pending_change: PendingChange | None = None
    applied_change_count: int = 0
    can_undo: bool = False
    download_warnings: list[DownloadWarning] = Field(default_factory=list)
    expires_at: datetime
