"""Pure, deterministic cleaning actions for uploaded spreadsheet sessions."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
import math
import re
from typing import Any, Literal

import pandas as pd

from .errors import UploadError
from .schemas import (
    ChangeSample,
    CleaningAction,
    ConvertNumericAction,
    DropDuplicatesAction,
    DropEmptyColumnsAction,
    FillMissingAction,
    RenameColumnAction,
    StandardizeDateAction,
    TrimWhitespaceAction,
)


RiskLevel = Literal["low", "high"]
SAMPLE_LIMIT = 5
NUMERIC_RE = re.compile(r"^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$")
DATE_OUTPUT_FORMATS = {
    "YYYY-MM-DD": "%Y-%m-%d",
    "MM/DD/YYYY": "%m/%d/%Y",
    "DD/MM/YYYY": "%d/%m/%Y",
}


@dataclass(frozen=True)
class ActionResult:
    dataframe: pd.DataFrame
    display_headers: list[str]
    column_ids: list[str]
    risk: RiskLevel
    affected_count: int
    affected_unit: str
    unresolved_count: int
    samples: list[ChangeSample]
    warnings: list[str]


def _invalid(message: str) -> UploadError:
    return UploadError(422, "invalid_action", message)


def _not_applicable(message: str) -> UploadError:
    return UploadError(422, "action_not_applicable", message)


def _is_missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    try:
        return bool(pd.isna(value))
    except (TypeError, ValueError):
        return False


def _json_value(value: Any) -> Any:
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


def _require_columns(column_ids: list[str], selected: list[str]) -> None:
    unknown = [column_id for column_id in selected if column_id not in column_ids]
    if unknown:
        raise _invalid("The selected column is no longer available.")
    if len(set(selected)) != len(selected):
        raise _invalid("Select each column only once.")


def _cell_samples(
    dataframe: pd.DataFrame,
    changes: list[tuple[int, str, Any, Any]],
) -> list[ChangeSample]:
    del dataframe
    return [
        ChangeSample(
            row_number=int(index) + 2,
            before={column_id: _json_value(before)},
            after={column_id: _json_value(after)},
        )
        for index, column_id, before, after in changes[:SAMPLE_LIMIT]
    ]


def _trim_whitespace(
    dataframe: pd.DataFrame,
    headers: list[str],
    column_ids: list[str],
    action: TrimWhitespaceAction,
) -> ActionResult:
    _require_columns(column_ids, action.column_ids)
    candidate = dataframe.copy(deep=True)
    changes: list[tuple[int, str, Any, Any]] = []
    for column_id in action.column_ids:
        for index, value in dataframe[column_id].items():
            if isinstance(value, str) and value != value.strip():
                trimmed = value.strip()
                candidate.at[index, column_id] = trimmed
                changes.append((int(index), column_id, value, trimmed))
    if not changes:
        raise _not_applicable("No leading or trailing spaces remain in those columns.")
    return ActionResult(
        dataframe=candidate,
        display_headers=list(headers),
        column_ids=list(column_ids),
        risk="low",
        affected_count=len(changes),
        affected_unit="values",
        unresolved_count=0,
        samples=_cell_samples(dataframe, changes),
        warnings=[],
    )


def _rename_column(
    dataframe: pd.DataFrame,
    headers: list[str],
    column_ids: list[str],
    action: RenameColumnAction,
) -> ActionResult:
    _require_columns(column_ids, [action.column_id])
    new_name = action.new_name.strip()
    if not new_name:
        raise _invalid("Enter a nonblank column name.")
    current_position = column_ids.index(action.column_id)
    if headers[current_position] == new_name:
        raise _not_applicable("That column already uses this name.")
    duplicate = any(
        index != current_position and header.strip().casefold() == new_name.casefold()
        for index, header in enumerate(headers)
    )
    if duplicate:
        raise _invalid("Choose a column name that is not already in use.")
    updated_headers = list(headers)
    updated_headers[current_position] = new_name
    return ActionResult(
        dataframe=dataframe.copy(deep=True),
        display_headers=updated_headers,
        column_ids=list(column_ids),
        risk="high",
        affected_count=1,
        affected_unit="column",
        unresolved_count=0,
        samples=[
            ChangeSample(
                before={action.column_id: headers[current_position]},
                after={action.column_id: new_name},
            )
        ],
        warnings=[],
    )


def _numeric_value(value: Any) -> float | None:
    if isinstance(value, bool) or _is_missing(value):
        return None
    if isinstance(value, (int, float)) and not pd.isna(value):
        return float(value)
    if not isinstance(value, str):
        return None
    normalized = value.strip().replace(",", "").replace("$", "")
    if normalized.endswith("%"):
        normalized = normalized[:-1]
    if not NUMERIC_RE.fullmatch(normalized):
        return None
    return float(normalized)


def _format_calculated(value: float) -> str:
    if math.isfinite(value) and value.is_integer():
        return str(int(value))
    return format(value, ".15g")


def _most_common(values: list[Any]) -> Any:
    counts: list[tuple[Any, int]] = []
    for value in values:
        for index, (known, count) in enumerate(counts):
            if value == known:
                counts[index] = (known, count + 1)
                break
        else:
            counts.append((value, 1))
    return max(counts, key=lambda item: item[1])[0]


def _fill_missing(
    dataframe: pd.DataFrame,
    headers: list[str],
    column_ids: list[str],
    action: FillMissingAction,
) -> ActionResult:
    _require_columns(column_ids, [action.column_id])
    missing_mask = dataframe[action.column_id].map(_is_missing)
    if not bool(missing_mask.any()):
        raise _not_applicable("This column no longer contains missing values.")

    present = [
        value for value in dataframe[action.column_id].tolist() if not _is_missing(value)
    ]
    if action.strategy == "explicit":
        replacement = action.value
        if _is_missing(replacement):
            raise _invalid("Enter a replacement value that is not blank.")
    elif action.strategy in {"mean", "median"}:
        numeric = [_numeric_value(value) for value in present]
        if not numeric or any(value is None for value in numeric):
            raise _invalid("This calculated fill requires a numeric column.")
        series = pd.Series([value for value in numeric if value is not None])
        calculated = float(series.mean() if action.strategy == "mean" else series.median())
        replacement = _format_calculated(calculated)
    else:
        if not present:
            raise _invalid("A most-common fill requires at least one existing value.")
        replacement = _most_common(present)

    candidate = dataframe.copy(deep=True)
    changes: list[tuple[int, str, Any, Any]] = []
    for index in dataframe.index[missing_mask]:
        before = dataframe.at[index, action.column_id]
        candidate.at[index, action.column_id] = replacement
        changes.append((int(index), action.column_id, before, replacement))
    return ActionResult(
        dataframe=candidate,
        display_headers=list(headers),
        column_ids=list(column_ids),
        risk="high",
        affected_count=len(changes),
        affected_unit="cells",
        unresolved_count=0,
        samples=_cell_samples(dataframe, changes),
        warnings=[],
    )


def _drop_duplicates(
    dataframe: pd.DataFrame,
    headers: list[str],
    column_ids: list[str],
    action: DropDuplicatesAction,
) -> ActionResult:
    duplicate_mask = dataframe.duplicated(keep=action.keep)
    affected = dataframe[duplicate_mask]
    if affected.empty:
        raise _not_applicable("No exact duplicate rows remain.")
    samples = [
        ChangeSample(
            row_number=int(index) + 2,
            before={
                column_id: _json_value(row[column_id]) for column_id in column_ids
            },
            after={},
        )
        for index, row in affected.head(SAMPLE_LIMIT).iterrows()
    ]
    return ActionResult(
        dataframe=dataframe.loc[~duplicate_mask].copy(deep=True),
        display_headers=list(headers),
        column_ids=list(column_ids),
        risk="high",
        affected_count=int(duplicate_mask.sum()),
        affected_unit="rows",
        unresolved_count=0,
        samples=samples,
        warnings=[],
    )


def _convert_numeric(
    dataframe: pd.DataFrame,
    headers: list[str],
    column_ids: list[str],
    action: ConvertNumericAction,
) -> ActionResult:
    _require_columns(column_ids, [action.column_id])
    candidate = dataframe.copy(deep=True)
    candidate[action.column_id] = candidate[action.column_id].astype(object)
    changes: list[tuple[int, str, Any, Any]] = []
    unresolved = 0
    for index, value in dataframe[action.column_id].items():
        if _is_missing(value):
            continue
        numeric = _numeric_value(value)
        if numeric is None:
            unresolved += 1
            continue
        if action.target_type == "integer":
            if not numeric.is_integer():
                raise _invalid(
                    "Some recognized values contain decimals and cannot be converted to integers."
                )
            converted: int | float = int(numeric)
        else:
            converted = float(numeric)
        if type(value) is type(converted) and value == converted:
            continue
        candidate.at[index, action.column_id] = converted
        changes.append((int(index), action.column_id, value, converted))
    if not changes:
        raise _not_applicable("No numeric-looking text values remain in this column.")
    warnings = (
        [f"{unresolved} non-empty values could not be converted and will stay unchanged."]
        if unresolved
        else []
    )
    return ActionResult(
        dataframe=candidate,
        display_headers=list(headers),
        column_ids=list(column_ids),
        risk="high",
        affected_count=len(changes),
        affected_unit="values",
        unresolved_count=unresolved,
        samples=_cell_samples(dataframe, changes),
        warnings=warnings,
    )


def _drop_empty_columns(
    dataframe: pd.DataFrame,
    headers: list[str],
    column_ids: list[str],
    action: DropEmptyColumnsAction,
) -> ActionResult:
    _require_columns(column_ids, action.column_ids)
    if len(action.column_ids) >= len(column_ids):
        raise _invalid("Keep at least one column in the spreadsheet.")
    for column_id in action.column_ids:
        if not bool(dataframe[column_id].map(_is_missing).all()):
            raise _invalid("Only columns that are currently empty can be removed.")
    kept_ids = [
        column_id for column_id in column_ids if column_id not in action.column_ids
    ]
    kept_headers = [
        header
        for column_id, header in zip(column_ids, headers, strict=True)
        if column_id in kept_ids
    ]
    removed_names = {
        column_id: headers[column_ids.index(column_id)]
        for column_id in action.column_ids
    }
    return ActionResult(
        dataframe=dataframe[kept_ids].copy(deep=True),
        display_headers=kept_headers,
        column_ids=kept_ids,
        risk="high",
        affected_count=len(action.column_ids),
        affected_unit="columns",
        unresolved_count=0,
        samples=[ChangeSample(before=removed_names, after={})],
        warnings=[],
    )


def _parse_date(value: Any, *, day_first: bool) -> pd.Timestamp | None:
    if isinstance(value, pd.Timestamp):
        return value
    if isinstance(value, datetime):
        return pd.Timestamp(value)
    if isinstance(value, date):
        return pd.Timestamp(value)
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    if re.fullmatch(r"\d{4}[-/]\d{2}[-/]\d{2}", text):
        parsed = pd.to_datetime(text, errors="coerce", yearfirst=True)
        return None if pd.isna(parsed) else pd.Timestamp(parsed)
    parsed = pd.to_datetime(
        text,
        errors="coerce",
        dayfirst=day_first,
        format="mixed",
    )
    return None if pd.isna(parsed) else pd.Timestamp(parsed)


def _standardize_date(
    dataframe: pd.DataFrame,
    headers: list[str],
    column_ids: list[str],
    action: StandardizeDateAction,
) -> ActionResult:
    _require_columns(column_ids, [action.column_id])
    candidate = dataframe.copy(deep=True)
    changes: list[tuple[int, str, Any, Any]] = []
    recognized = 0
    unresolved = 0
    output_format = DATE_OUTPUT_FORMATS[action.output_format]
    for index, value in dataframe[action.column_id].items():
        if _is_missing(value):
            continue
        parsed = _parse_date(value, day_first=action.date_order == "day_first")
        if parsed is None:
            unresolved += 1
            continue
        recognized += 1
        formatted = parsed.strftime(output_format)
        if value == formatted:
            continue
        candidate.at[index, action.column_id] = formatted
        changes.append((int(index), action.column_id, value, formatted))
    if not changes:
        raise _not_applicable("No recognized dates require this output format.")
    warnings = (
        [f"{unresolved} non-empty values were not recognized and will stay unchanged."]
        if unresolved
        else []
    )
    return ActionResult(
        dataframe=candidate,
        display_headers=list(headers),
        column_ids=list(column_ids),
        risk="high",
        affected_count=recognized,
        affected_unit="values",
        unresolved_count=unresolved,
        samples=_cell_samples(dataframe, changes),
        warnings=warnings,
    )


def apply_action(
    dataframe: pd.DataFrame,
    display_headers: list[str],
    column_ids: list[str],
    action: CleaningAction,
) -> ActionResult:
    """Return a cleaned candidate without mutating the supplied table."""

    if len(display_headers) != len(column_ids) or list(dataframe.columns) != column_ids:
        raise _invalid("The spreadsheet columns are not in a valid state.")
    if isinstance(action, TrimWhitespaceAction):
        return _trim_whitespace(dataframe, display_headers, column_ids, action)
    if isinstance(action, RenameColumnAction):
        return _rename_column(dataframe, display_headers, column_ids, action)
    if isinstance(action, FillMissingAction):
        return _fill_missing(dataframe, display_headers, column_ids, action)
    if isinstance(action, DropDuplicatesAction):
        return _drop_duplicates(dataframe, display_headers, column_ids, action)
    if isinstance(action, ConvertNumericAction):
        return _convert_numeric(dataframe, display_headers, column_ids, action)
    if isinstance(action, DropEmptyColumnsAction):
        return _drop_empty_columns(dataframe, display_headers, column_ids, action)
    if isinstance(action, StandardizeDateAction):
        return _standardize_date(dataframe, display_headers, column_ids, action)
    raise _invalid("This cleaning action is not supported.")


def action_summary(action: CleaningAction) -> str:
    if isinstance(action, TrimWhitespaceAction):
        return "Trim extra spaces"
    if isinstance(action, RenameColumnAction):
        return "Rename a column"
    if isinstance(action, FillMissingAction):
        return "Fill missing values"
    if isinstance(action, DropDuplicatesAction):
        return "Remove exact duplicate rows"
    if isinstance(action, ConvertNumericAction):
        return "Convert numeric text"
    if isinstance(action, DropEmptyColumnsAction):
        return "Remove empty columns"
    if isinstance(action, StandardizeDateAction):
        return "Standardize dates"
    raise _invalid("This cleaning action is not supported.")


def action_column_ids(action: CleaningAction) -> list[str]:
    if isinstance(action, (TrimWhitespaceAction, DropEmptyColumnsAction)):
        return list(action.column_ids)
    if isinstance(
        action,
        (
            RenameColumnAction,
            FillMissingAction,
            ConvertNumericAction,
            StandardizeDateAction,
        ),
    ):
        return [action.column_id]
    return []
