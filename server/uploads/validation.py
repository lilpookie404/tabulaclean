"""Revisioned uploaded-file validation for temporary sessions."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable

import pandas as pd

from .schemas import DetectedIssue, DownloadWarning, ValidationCheck, ValidationResult


def is_missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    try:
        return bool(pd.isna(value))
    except (TypeError, ValueError):
        return False


def row_numbers(mask: pd.Series) -> list[int]:
    return [int(index) + 2 for index in mask[mask].index[:5]]


def formula_download_warnings(dataframe: pd.DataFrame) -> list[DownloadWarning]:
    formula_like_count = sum(
        1
        for row in dataframe.itertuples(index=False, name=None)
        for value in row
        if isinstance(value, str) and value.startswith(("=", "+", "-", "@"))
    )
    if not formula_like_count:
        return []
    return [
        DownloadWarning(
            code="formula_like_values",
            title="Some text may open as a spreadsheet formula",
            message=(
                f"{formula_like_count} values begin with characters that spreadsheet "
                "software may interpret as formulas. TabulaClean has not changed them."
            ),
            affected_count=formula_like_count,
        )
    ]


def _pending_review_check(has_pending_change: bool) -> ValidationCheck:
    if has_pending_change:
        return ValidationCheck(
            check_id="pending_review",
            title="Pending change review",
            status="failed",
            severity="error",
            message="Approve or reject the pending risky change before trusting this file.",
            affected_count=1,
        )
    return ValidationCheck(
        check_id="pending_review",
        title="Pending change review",
        status="passed",
        severity="info",
        message="No risky change is waiting for review.",
    )


def _required_columns_check(
    dataframe: pd.DataFrame,
    required_column_ids: list[str],
) -> ValidationCheck:
    affected_columns: list[str] = []
    example_rows: list[int] = []
    affected_count = 0
    for column_id in required_column_ids:
        mask = dataframe[column_id].map(is_missing)
        column_count = int(mask.sum())
        if column_count:
            affected_columns.append(column_id)
            affected_count += column_count
            example_rows.extend(row_numbers(mask))

    if affected_count:
        return ValidationCheck(
            check_id="required_columns",
            title="Required columns",
            status="failed",
            severity="error",
            message=f"{affected_count} required cells are still blank.",
            affected_count=affected_count,
            affected_columns=affected_columns,
            example_rows=list(dict.fromkeys(example_rows))[:5],
        )
    return ValidationCheck(
        check_id="required_columns",
        title="Required columns",
        status="passed",
        severity="info",
        message="Required columns are filled.",
        affected_columns=list(required_column_ids),
    )


def _remaining_issues_check(issues: Iterable[DetectedIssue]) -> ValidationCheck:
    issue_list = list(issues)
    if issue_list:
        return ValidationCheck(
            check_id="remaining_issues",
            title="Remaining quality warnings",
            status="warning",
            severity="warning",
            message=f"{len(issue_list)} quality issue groups still deserve review.",
            affected_count=len(issue_list),
            affected_columns=list(
                dict.fromkeys(
                    column_id
                    for issue in issue_list
                    for column_id in issue.affected_columns
                )
            ),
            example_rows=list(
                dict.fromkeys(
                    row for issue in issue_list for row in issue.example_rows
                )
            )[:5],
        )
    return ValidationCheck(
        check_id="remaining_issues",
        title="Remaining quality warnings",
        status="passed",
        severity="info",
        message="No remaining quality issue groups were detected.",
    )


def _download_warning_check(warnings: list[DownloadWarning]) -> ValidationCheck:
    affected_count = sum(warning.affected_count for warning in warnings)
    if affected_count:
        return ValidationCheck(
            check_id="download_warnings",
            title="Download warnings",
            status="warning",
            severity="warning",
            message=f"{affected_count} cells may need attention when opened in spreadsheet software.",
            affected_count=affected_count,
        )
    return ValidationCheck(
        check_id="download_warnings",
        title="Download warnings",
        status="passed",
        severity="info",
        message="No spreadsheet download warnings were detected.",
    )


def validate_upload_table(
    *,
    dataframe: pd.DataFrame,
    required_column_ids: list[str],
    has_pending_change: bool,
    issues: list[DetectedIssue],
    download_warnings: list[DownloadWarning],
    revision: int,
    ran_at: datetime,
) -> ValidationResult:
    checks = [
        _pending_review_check(has_pending_change),
        _required_columns_check(dataframe, required_column_ids),
        _remaining_issues_check(issues),
        _download_warning_check(download_warnings),
    ]
    errors = sum(
        1 for check in checks if check.status == "failed" and check.severity == "error"
    )
    warnings = sum(1 for check in checks if check.status == "warning")
    return ValidationResult(
        status="failed" if errors else "passed",
        revision=revision,
        required_column_ids=list(required_column_ids),
        ran_at=ran_at,
        checks=checks,
        summary={
            "errors": errors,
            "warnings": warnings,
            "passed": sum(1 for check in checks if check.status == "passed"),
        },
    )
