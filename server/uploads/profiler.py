"""Friendly type inference and read-only spreadsheet issue detection."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
import re
from typing import Any, Iterable

import pandas as pd

from .parser import ParsedTable
from .schemas import ColumnDescriptor, DetectedIssue, FriendlyType


BOOLEAN_VALUES = {"true", "false", "yes", "no"}
DATE_NAME_RE = re.compile(
    r"(^|[_\s-])(date|time|timestamp|datetime|created|updated|joined|dob)($|[_\s-])",
    re.IGNORECASE,
)
IDENTIFIER_NAME_RE = re.compile(
    r"(^|[_\s-])(id|code|zip|postal|phone|account|reference|ref)($|[_\s-])",
    re.IGNORECASE,
)
CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]")
INTEGER_RE = re.compile(r"^[+-]?\d+$")
DECIMAL_RE = re.compile(r"^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$")
LEADING_ZERO_RE = re.compile(r"^[+-]?0\d+$")


@dataclass(frozen=True)
class TableProfile:
    columns: list[ColumnDescriptor]
    issues: list[DetectedIssue]


def _is_missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    try:
        return bool(pd.isna(value))
    except (TypeError, ValueError):
        return False


def _present_values(values: Iterable[Any]) -> list[Any]:
    return [value for value in values if not _is_missing(value)]


def _numeric_text(value: Any) -> str | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and not pd.isna(value):
        return str(value)
    if not isinstance(value, str):
        return None
    text = value.strip().replace(",", "").replace("$", "")
    if text.endswith("%"):
        text = text[:-1]
    return text if DECIMAL_RE.fullmatch(text) else None


def _date_format(value: Any) -> tuple[str, bool] | None:
    if isinstance(value, pd.Timestamp):
        return ("native_datetime" if value.time().isoformat() != "00:00:00" else "native_date", True)
    if isinstance(value, datetime):
        return ("native_datetime", True)
    if isinstance(value, date):
        return ("native_date", False)
    if not isinstance(value, str):
        return None

    text = value.strip()
    patterns = (
        (r"^\d{4}-\d{2}-\d{2}$", "iso_date", False),
        (r"^\d{4}/\d{2}/\d{2}$", "year_slash_date", False),
        (r"^\d{2}/\d{2}/\d{4}$", "slash_date", False),
        (r"^\d{2}-\d{2}-\d{4}$", "dash_date", False),
        (r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?$", "iso_datetime", True),
    )
    for pattern, label, includes_time in patterns:
        if re.fullmatch(pattern, text):
            try:
                pd.to_datetime(text, errors="raise")
            except (TypeError, ValueError):
                return None
            return label, includes_time
    return None


def _infer_type(header: str, values: Iterable[Any]) -> FriendlyType:
    present = _present_values(values)
    if not present:
        return "empty"

    lowered = [value.strip().lower() for value in present if isinstance(value, str)]
    if len(lowered) == len(present) and all(value in BOOLEAN_VALUES for value in lowered):
        return "boolean"

    date_formats = [_date_format(value) for value in present]
    if all(candidate is not None for candidate in date_formats):
        return "datetime" if any(candidate[1] for candidate in date_formats if candidate) else "date"

    numeric = [_numeric_text(value) for value in present]
    numeric_count = sum(value is not None for value in numeric)
    if numeric_count == len(present):
        normalized = [value for value in numeric if value is not None]
        return "integer" if all(INTEGER_RE.fullmatch(value) for value in normalized) else "decimal"
    if numeric_count:
        return "mixed"

    native_types = {type(value) for value in present}
    if len(native_types) > 1:
        return "mixed"
    del header
    return "text"


def _row_numbers(mask: pd.Series) -> list[int]:
    return [int(index) + 2 for index in mask[mask].index[:5]]


def _missing_issue(parsed: ParsedTable) -> DetectedIssue | None:
    affected_columns: list[str] = []
    example_rows: list[int] = []
    count = 0
    for column_id in parsed.column_ids:
        mask = parsed.dataframe[column_id].map(_is_missing)
        column_count = int(mask.sum())
        if column_count:
            affected_columns.append(column_id)
            count += column_count
            example_rows.extend(_row_numbers(mask))
    if not count:
        return None
    return DetectedIssue(
        type="missing_values",
        title="Some cells are empty",
        message=f"{count} empty cells were found across {len(affected_columns)} columns.",
        affected_count=count,
        affected_unit="cells",
        affected_columns=affected_columns,
        example_rows=list(dict.fromkeys(example_rows))[:5],
    )


def _duplicate_issue(parsed: ParsedTable) -> DetectedIssue | None:
    mask = parsed.dataframe.duplicated(keep="first")
    count = int(mask.sum())
    if not count:
        return None
    return DetectedIssue(
        type="duplicate_rows",
        title="Some rows may be repeated",
        message=f"{count} rows exactly repeat an earlier row.",
        affected_count=count,
        affected_unit="rows",
        affected_columns=[],
        example_rows=_row_numbers(mask),
    )


def _whitespace_issue(parsed: ParsedTable) -> DetectedIssue | None:
    affected_columns: list[str] = []
    example_rows: list[int] = []
    count = 0
    for column_id in parsed.column_ids:
        mask = parsed.dataframe[column_id].map(
            lambda value: isinstance(value, str) and value != value.strip()
        )
        column_count = int(mask.sum())
        if column_count:
            affected_columns.append(column_id)
            count += column_count
            example_rows.extend(_row_numbers(mask))
    if not count:
        return None
    return DetectedIssue(
        type="whitespace",
        title="Extra spaces were detected",
        message=f"{count} values contain leading or trailing spaces.",
        affected_count=count,
        affected_unit="values",
        affected_columns=affected_columns,
        example_rows=list(dict.fromkeys(example_rows))[:5],
    )


def _messy_columns_issue(parsed: ParsedTable) -> DetectedIssue | None:
    normalized = [header.strip().casefold() for header in parsed.display_headers]
    duplicate_names = {
        name for name in normalized if name and normalized.count(name) > 1
    }
    affected = [
        column_id
        for column_id, header, normalized_name in zip(
            parsed.column_ids,
            parsed.display_headers,
            normalized,
            strict=True,
        )
        if (
            not normalized_name
            or header != header.strip()
            or normalized_name in duplicate_names
            or bool(CONTROL_RE.search(header))
            or normalized_name.startswith("unnamed:")
        )
    ]
    if not affected:
        return None
    return DetectedIssue(
        type="messy_column_names",
        title="Some column names need attention",
        message=f"{len(affected)} column names are blank, repeated, or padded with spaces.",
        affected_count=len(affected),
        affected_unit="columns",
        affected_columns=affected,
        example_rows=[],
    )


def _numeric_text_issue(parsed: ParsedTable) -> DetectedIssue | None:
    affected: list[str] = []
    example_rows: list[int] = []
    affected_values = 0
    for column_id, header in zip(parsed.column_ids, parsed.display_headers, strict=True):
        normalized_header = header.strip()
        if IDENTIFIER_NAME_RE.search(normalized_header) or DATE_NAME_RE.search(normalized_header):
            continue
        present = _present_values(parsed.dataframe[column_id])
        if len(present) < 2 or not all(isinstance(value, str) for value in present):
            continue
        stripped = [value.strip().replace(",", "").replace("$", "") for value in present]
        if any(LEADING_ZERO_RE.fullmatch(value) for value in stripped):
            continue
        numeric_flags = [DECIMAL_RE.fullmatch(value.rstrip("%")) is not None for value in stripped]
        ratio = sum(numeric_flags) / len(numeric_flags)
        if ratio < 0.8:
            continue
        affected.append(column_id)
        affected_values += sum(numeric_flags)
        mask = parsed.dataframe[column_id].map(
            lambda value: isinstance(value, str)
            and DECIMAL_RE.fullmatch(value.strip().replace(",", "").replace("$", "").rstrip("%"))
            is not None
        )
        example_rows.extend(_row_numbers(mask))
    if not affected:
        return None
    return DetectedIssue(
        type="numeric_text",
        title="Numbers appear to be stored as text",
        message=f"{len(affected)} columns contain strongly numeric-looking text values.",
        affected_count=affected_values,
        affected_unit="values",
        affected_columns=affected,
        example_rows=list(dict.fromkeys(example_rows))[:5],
    )


def _empty_columns_issue(parsed: ParsedTable) -> DetectedIssue | None:
    affected = [
        column_id
        for column_id in parsed.column_ids
        if parsed.dataframe[column_id].map(_is_missing).all()
    ]
    if not affected:
        return None
    return DetectedIssue(
        type="empty_columns",
        title="Some columns are completely empty",
        message=f"{len(affected)} columns do not contain any values.",
        affected_count=len(affected),
        affected_unit="columns",
        affected_columns=affected,
        example_rows=[],
    )


def _inconsistent_dates_issue(parsed: ParsedTable) -> DetectedIssue | None:
    affected: list[str] = []
    example_rows: list[int] = []
    affected_values = 0
    for column_id, header in zip(parsed.column_ids, parsed.display_headers, strict=True):
        present = _present_values(parsed.dataframe[column_id])
        if len(present) < 2:
            continue
        candidates = [_date_format(value) for value in present]
        recognized = [candidate for candidate in candidates if candidate is not None]
        strong_evidence = len(recognized) / len(present) >= 0.8
        if not DATE_NAME_RE.search(header.strip()) and not strong_evidence:
            continue
        formats = {candidate[0] for candidate in recognized}
        if len(formats) < 2:
            continue
        affected.append(column_id)
        affected_values += len(recognized)
        mask = parsed.dataframe[column_id].map(lambda value: _date_format(value) is not None)
        example_rows.extend(_row_numbers(mask))
    if not affected:
        return None
    return DetectedIssue(
        type="inconsistent_dates",
        title="Date formats may be inconsistent",
        message=f"{len(affected)} columns use more than one recognizable date format.",
        affected_count=affected_values,
        affected_unit="values",
        affected_columns=affected,
        example_rows=list(dict.fromkeys(example_rows))[:5],
    )


def profile_table(parsed: ParsedTable) -> TableProfile:
    columns = [
        ColumnDescriptor(
            id=column_id,
            name=header,
            position=position,
            inferred_type=_infer_type(header, parsed.dataframe[column_id].tolist()),
        )
        for position, (column_id, header) in enumerate(
            zip(parsed.column_ids, parsed.display_headers, strict=True)
        )
    ]
    issue_builders = (
        _missing_issue,
        _duplicate_issue,
        _whitespace_issue,
        _messy_columns_issue,
        _numeric_text_issue,
        _empty_columns_issue,
        _inconsistent_dates_issue,
    )
    issues = [
        issue
        for builder in issue_builders
        if (issue := builder(parsed)) is not None
    ]
    return TableProfile(columns=columns, issues=issues)
