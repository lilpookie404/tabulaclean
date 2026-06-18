"""Hybrid local/model suggestions for uploaded spreadsheet sessions."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime
from typing import Any

import pandas as pd

from .schemas import (
    CleaningAction,
    ColumnDescriptor,
    ConvertNumericAction,
    DetectedIssue,
    DropDuplicatesAction,
    DropEmptyColumnsAction,
    FillMissingAction,
    RenameColumnAction,
    StandardizeDateAction,
    SuggestedAction,
    SuggestionResult,
    TrimWhitespaceAction,
)
from .validation import is_missing

try:  # pragma: no cover - import availability depends on runtime image.
    from openai import OpenAI
except Exception:  # pragma: no cover - local fallback path.
    OpenAI = None  # type: ignore[assignment]


Confidence = str
ModelEnhancement = tuple[list[SuggestedAction], str, str]


def _column_lookup(columns: list[ColumnDescriptor]) -> dict[str, ColumnDescriptor]:
    return {column.id: column for column in columns}


def _present_values(dataframe: pd.DataFrame, column_id: str) -> list[Any]:
    return [value for value in dataframe[column_id].tolist() if not is_missing(value)]


def _suggestion_id(issue_type: str, action: CleaningAction) -> str:
    payload = action.model_dump(mode="json")
    parts = [issue_type, payload["type"]]
    for key in ("column_id", "column_ids", "keep", "strategy", "target_type"):
        value = payload.get(key)
        if isinstance(value, list):
            parts.extend(str(item) for item in value)
        elif value is not None:
            parts.append(str(value))
    return re.sub(r"[^a-zA-Z0-9_-]+", "-", "-".join(parts)).strip("-")


def _make_suggestion(
    issue: DetectedIssue,
    action: CleaningAction,
    *,
    title: str,
    rationale: str,
    confidence: Confidence,
) -> SuggestedAction:
    return SuggestedAction(
        suggestion_id=_suggestion_id(issue.type, action),
        issue_type=issue.type,
        title=title,
        rationale=rationale,
        confidence=confidence,  # type: ignore[arg-type]
        source="local",
        action=action,
    )


def _clean_header_candidate(
    header: str,
    position: int,
    existing: set[str],
) -> str | None:
    candidate = re.sub(r"[\x00-\x1f\x7f]", "", header).strip()
    candidate = re.sub(r"\s+", " ", candidate)
    if not candidate or candidate.casefold().startswith("unnamed:"):
        candidate = f"Column {position + 1}"
    base = candidate
    suffix = 2
    while candidate.strip().casefold() in existing:
        candidate = f"{base} {suffix}"
        suffix += 1
    return candidate if candidate != header else None


def build_local_suggestions(
    *,
    dataframe: pd.DataFrame,
    display_headers: list[str],
    columns: list[ColumnDescriptor],
    issues: list[DetectedIssue],
) -> list[SuggestedAction]:
    suggestions: list[SuggestedAction] = []
    columns_by_id = _column_lookup(columns)
    for issue in issues:
        if issue.type == "whitespace" and issue.affected_columns:
            action = TrimWhitespaceAction(column_ids=list(issue.affected_columns))
            suggestions.append(
                _make_suggestion(
                    issue,
                    action,
                    title="Trim padded text",
                    rationale="Remove leading and trailing spaces from affected text columns.",
                    confidence="high",
                )
            )
        elif issue.type == "duplicate_rows":
            action = DropDuplicatesAction(keep="first")
            suggestions.append(
                _make_suggestion(
                    issue,
                    action,
                    title="Remove repeated rows",
                    rationale="Keep the first exact row and remove later exact duplicates.",
                    confidence="high",
                )
            )
        elif issue.type == "numeric_text":
            for column_id in issue.affected_columns:
                if column_id in columns_by_id:
                    action = ConvertNumericAction(
                        column_id=column_id,
                        target_type="decimal",
                    )
                    suggestions.append(
                        _make_suggestion(
                            issue,
                            action,
                            title=f"Convert {columns_by_id[column_id].name} to numbers",
                            rationale="Convert strongly numeric-looking text into decimal values.",
                            confidence="high",
                        )
                    )
        elif issue.type == "empty_columns" and issue.affected_columns:
            action = DropEmptyColumnsAction(column_ids=list(issue.affected_columns))
            suggestions.append(
                _make_suggestion(
                    issue,
                    action,
                    title="Remove empty columns",
                    rationale="Drop columns where every cell is empty.",
                    confidence="high",
                )
            )
        elif issue.type == "inconsistent_dates":
            for column_id in issue.affected_columns:
                if column_id in columns_by_id:
                    action = StandardizeDateAction(
                        column_id=column_id,
                        date_order="day_first",
                        output_format="YYYY-MM-DD",
                    )
                    suggestions.append(
                        _make_suggestion(
                            issue,
                            action,
                            title=f"Standardize {columns_by_id[column_id].name} dates",
                            rationale="Normalize recognizable dates to YYYY-MM-DD.",
                            confidence="medium",
                        )
                    )
                    break
        elif issue.type == "missing_values":
            for column_id in issue.affected_columns:
                column = columns_by_id.get(column_id)
                if column is None:
                    continue
                present = _present_values(dataframe, column_id)
                if not present:
                    continue
                strategy = (
                    "median"
                    if column.inferred_type in {"integer", "decimal"}
                    else "most_common"
                )
                action = FillMissingAction(column_id=column_id, strategy=strategy)
                suggestions.append(
                    _make_suggestion(
                        issue,
                        action,
                        title=f"Fill blanks in {column.name}",
                        rationale=(
                            "Use the median for numeric blanks."
                            if strategy == "median"
                            else "Use the most common existing value for blanks."
                        ),
                        confidence="medium",
                    )
                )
                break
        elif issue.type == "messy_column_names":
            existing = {
                header.strip().casefold()
                for header in display_headers
                if header.strip()
            }
            for column_id in issue.affected_columns:
                column = columns_by_id.get(column_id)
                if column is None:
                    continue
                existing.discard(column.name.strip().casefold())
                candidate = _clean_header_candidate(
                    column.name,
                    column.position,
                    existing,
                )
                if candidate is None:
                    existing.add(column.name.strip().casefold())
                    continue
                action = RenameColumnAction(
                    column_id=column_id,
                    new_name=candidate,
                )
                suggestions.append(
                    _make_suggestion(
                        issue,
                        action,
                        title=f"Rename {column.name or 'blank column'}",
                        rationale="Clean padding, control characters, or blank column names.",
                        confidence="medium",
                    )
                )
                existing.add(candidate.strip().casefold())
                break
    return suggestions


def build_model_payload(
    *,
    columns: list[ColumnDescriptor],
    issues: list[DetectedIssue],
    candidates: list[SuggestedAction],
) -> dict[str, Any]:
    return {
        "columns": [
            column.model_dump(
                mode="json",
                include={"id", "name", "position", "inferred_type"},
            )
            for column in columns
        ],
        "issues": [
            issue.model_dump(
                mode="json",
                include={
                    "type",
                    "title",
                    "message",
                    "affected_count",
                    "affected_unit",
                    "affected_columns",
                    "example_rows",
                },
            )
            for issue in issues
        ],
        "candidates": [
            candidate.model_dump(
                mode="json",
                include={
                    "suggestion_id",
                    "issue_type",
                    "title",
                    "rationale",
                    "confidence",
                    "action",
                },
            )
            for candidate in candidates
        ],
    }


def _merge_model_suggestions(
    candidates: list[SuggestedAction],
    enhanced: list[SuggestedAction],
) -> list[SuggestedAction]:
    originals = {candidate.suggestion_id: candidate for candidate in candidates}
    merged: list[SuggestedAction] = []
    seen: set[str] = set()
    for suggestion in enhanced:
        original = originals.get(suggestion.suggestion_id)
        if original is None:
            continue
        merged.append(
            original.model_copy(
                update={
                    "title": suggestion.title,
                    "rationale": suggestion.rationale,
                    "confidence": suggestion.confidence,
                    "source": "ai",
                    "action": original.action,
                }
            )
        )
        seen.add(original.suggestion_id)
    merged.extend(
        candidate for candidate in candidates if candidate.suggestion_id not in seen
    )
    return merged


def enhance_with_model(
    payload: dict[str, Any],
    candidates: list[SuggestedAction],
) -> ModelEnhancement:
    token = os.getenv("HF_TOKEN", "").strip()
    if not token or OpenAI is None:
        return candidates, "not_configured", "Model enhancement is not configured."

    try:
        client = OpenAI(
            base_url=os.getenv("API_BASE_URL", "https://router.huggingface.co/v1"),
            api_key=token,
            timeout=8.0,
            max_retries=0,
        )
        response = client.chat.completions.create(
            model=os.getenv("MODEL_NAME", "meta-llama/Llama-3.3-70B-Instruct"),
            temperature=0,
            max_completion_tokens=500,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Return only JSON. Rank and rewrite existing suggestion "
                        "titles/rationales. Do not create or change action payloads."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(payload, ensure_ascii=True),
                },
            ],
        )
        content = response.choices[0].message.content or "{}"
        parsed = json.loads(content)
        raw_suggestions = parsed.get("suggestions", [])
        enhanced = [
            SuggestedAction.model_validate(
                {
                    **candidate.model_dump(mode="json"),
                    **{
                        key: raw.get(key)
                        for key in ("suggestion_id", "title", "rationale", "confidence")
                        if raw.get(key) is not None
                    },
                    "source": "ai",
                }
            )
            for raw in raw_suggestions
            for candidate in candidates
            if raw.get("suggestion_id") == candidate.suggestion_id
        ]
        if not enhanced:
            return candidates, "failed", "Model response did not match local suggestions."
        return enhanced, "used", "Model ranked local suggestions."
    except Exception as exc:  # pragma: no cover - network/runtime dependent.
        return candidates, "failed", f"Model enhancement failed: {type(exc).__name__}."


def generate_suggestion_result(
    *,
    dataframe: pd.DataFrame,
    display_headers: list[str],
    columns: list[ColumnDescriptor],
    issues: list[DetectedIssue],
    revision: int,
    generated_at: datetime,
    use_model: bool,
) -> SuggestionResult:
    local = build_local_suggestions(
        dataframe=dataframe,
        display_headers=display_headers,
        columns=columns,
        issues=issues,
    )
    suggestions = local
    mode = "local"
    model_status = "not_configured"
    model_message = "Model enhancement was not requested."
    if use_model:
        payload = build_model_payload(
            columns=columns,
            issues=issues,
            candidates=local,
        )
        enhanced, model_status, model_message = enhance_with_model(payload, local)
        if model_status == "used":
            suggestions = _merge_model_suggestions(local, enhanced)
            mode = "ai_enhanced"
    return SuggestionResult(
        revision=revision,
        generated_at=generated_at,
        mode=mode,  # type: ignore[arg-type]
        model_status=model_status,  # type: ignore[arg-type]
        model_message=model_message,
        suggestions=suggestions,
    )
