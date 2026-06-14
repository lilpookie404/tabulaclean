from __future__ import annotations

import pandas as pd

from server.uploads.parser import ParsedTable
from server.uploads.profiler import profile_table


def _parsed(headers: list[str], rows: list[list[object]]) -> ParsedTable:
    column_ids = [f"column_{index + 1}" for index in range(len(headers))]
    dataframe = pd.DataFrame(rows, columns=column_ids)
    return ParsedTable(
        filename="sample.csv",
        sheet_name=None,
        display_headers=headers,
        column_ids=column_ids,
        dataframe=dataframe,
        memory_bytes=int(dataframe.memory_usage(index=True, deep=True).sum()),
    )


def test_profile_table_infers_friendly_semantic_types() -> None:
    parsed = _parsed(
        [
            "empty",
            "count",
            "amount",
            "enabled",
            "joined_date",
            "updated_at",
            "label",
            "mixed",
        ],
        [
            ["", "1", "1.25", "true", "2026-01-02", "2026-01-02T10:30:00", "A", "1"],
            [None, "2", "2.50", "false", "2026-02-03", "2026-02-03T11:45:00", "B", "word"],
        ],
    )

    profile = profile_table(parsed)

    assert [column.inferred_type for column in profile.columns] == [
        "empty",
        "integer",
        "decimal",
        "boolean",
        "date",
        "datetime",
        "text",
        "mixed",
    ]


def test_profile_table_detects_all_required_issue_groups() -> None:
    parsed = _parsed(
        [" Customer ", "", "Customer", "amount", "empty", "signup_date"],
        [
            [" Alice ", "", "Alias", "10", "", "2026-01-01"],
            ["Bob", "", "Bobby", "20", "", "01/02/2026"],
            ["Bob", "", "Bobby", "20", "", "01/02/2026"],
        ],
    )

    profile = profile_table(parsed)
    issues = {issue.type: issue for issue in profile.issues}

    assert set(issues) == {
        "missing_values",
        "duplicate_rows",
        "whitespace",
        "messy_column_names",
        "numeric_text",
        "empty_columns",
        "inconsistent_dates",
    }
    assert issues["missing_values"].affected_count == 6
    assert issues["duplicate_rows"].affected_count == 1
    assert issues["duplicate_rows"].example_rows == [4]
    assert issues["whitespace"].affected_columns == ["column_1"]
    assert issues["messy_column_names"].affected_columns == [
        "column_1",
        "column_2",
        "column_3",
    ]
    assert issues["numeric_text"].affected_columns == ["column_4"]
    assert issues["empty_columns"].affected_columns == ["column_2", "column_5"]
    assert issues["inconsistent_dates"].affected_columns == ["column_6"]
    assert all(len(issue.example_rows) <= 5 for issue in profile.issues)


def test_numeric_text_detection_avoids_identifiers_and_leading_zero_codes() -> None:
    parsed = _parsed(
        ["customer_id", "postal_code", "quantity"],
        [
            ["1001", "00123", "10"],
            ["1002", "00456", "20"],
            ["1003", "00789", "30"],
        ],
    )

    profile = profile_table(parsed)
    numeric_issue = next(issue for issue in profile.issues if issue.type == "numeric_text")

    assert numeric_issue.affected_columns == ["column_3"]


def test_date_detection_does_not_scan_ordinary_text_without_strong_evidence() -> None:
    parsed = _parsed(
        ["notes"],
        [["2026-01-01"], ["call customer"], ["01/02/2026"]],
    )

    profile = profile_table(parsed)

    assert all(issue.type != "inconsistent_dates" for issue in profile.issues)
