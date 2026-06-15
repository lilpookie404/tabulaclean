from __future__ import annotations

import pandas as pd
import pytest

from server.uploads.cleaning import apply_action
from server.uploads.errors import UploadError
from server.uploads.schemas import (
    ConvertNumericAction,
    DropDuplicatesAction,
    DropEmptyColumnsAction,
    FillMissingAction,
    RenameColumnAction,
    StandardizeDateAction,
    TrimWhitespaceAction,
)


def _table(
    rows: list[list[object]],
    headers: list[str],
) -> tuple[pd.DataFrame, list[str], list[str]]:
    column_ids = [f"column_{index + 1}" for index in range(len(headers))]
    return pd.DataFrame(rows, columns=column_ids), headers, column_ids


def test_trim_whitespace_returns_low_risk_candidate_and_samples() -> None:
    dataframe, headers, column_ids = _table(
        [[" Aarav ", " Mumbai "], ["Meera", "Delhi"]],
        ["name", "city"],
    )

    result = apply_action(
        dataframe,
        headers,
        column_ids,
        TrimWhitespaceAction(column_ids=["column_1", "column_2"]),
    )

    assert result.risk == "low"
    assert result.affected_count == 2
    assert result.affected_unit == "values"
    assert result.unresolved_count == 0
    assert result.dataframe.iloc[0].tolist() == ["Aarav", "Mumbai"]
    assert result.samples[0].row_number == 2
    assert result.samples[0].before == {"column_1": " Aarav "}
    assert result.samples[0].after == {"column_1": "Aarav"}
    assert dataframe.iloc[0].tolist() == [" Aarav ", " Mumbai "]


def test_rename_column_requires_unique_trimmed_nonblank_name() -> None:
    dataframe, headers, column_ids = _table([["Aarav", "West"]], ["name", "region"])

    result = apply_action(
        dataframe,
        headers,
        column_ids,
        RenameColumnAction(column_id="column_2", new_name=" Territory "),
    )

    assert result.risk == "high"
    assert result.display_headers == ["name", "Territory"]
    assert result.affected_count == 1
    assert result.affected_unit == "column"

    for new_name in ("", " NAME "):
        with pytest.raises(UploadError) as captured:
            apply_action(
                dataframe,
                headers,
                column_ids,
                RenameColumnAction(column_id="column_2", new_name=new_name),
            )
        assert captured.value.status_code == 422


@pytest.mark.parametrize(
    ("strategy", "expected"),
    [
        ("mean", "20"),
        ("median", "20"),
        ("most_common", "10"),
    ],
)
def test_fill_missing_uses_deterministic_calculated_values(
    strategy: str,
    expected: str,
) -> None:
    dataframe, headers, column_ids = _table(
        [["10"], [""], ["30"], ["20"]],
        ["amount"],
    )

    result = apply_action(
        dataframe,
        headers,
        column_ids,
        FillMissingAction(column_id="column_1", strategy=strategy),
    )

    assert result.risk == "high"
    assert result.dataframe.iloc[1, 0] == expected
    assert result.affected_count == 1


def test_fill_missing_accepts_explicit_value_and_rejects_inapplicable_strategy() -> None:
    dataframe, headers, column_ids = _table(
        [["Aarav"], [""], ["Meera"]],
        ["name"],
    )

    result = apply_action(
        dataframe,
        headers,
        column_ids,
        FillMissingAction(
            column_id="column_1",
            strategy="explicit",
            value="Unknown",
        ),
    )
    assert result.dataframe.iloc[1, 0] == "Unknown"

    with pytest.raises(UploadError) as captured:
        apply_action(
            dataframe,
            headers,
            column_ids,
            FillMissingAction(column_id="column_1", strategy="mean"),
        )
    assert captured.value.code == "invalid_action"


def test_drop_duplicates_can_keep_first_or_last() -> None:
    dataframe, headers, column_ids = _table(
        [["Aarav", "West"], ["Meera", "East"], ["Aarav", "West"]],
        ["name", "region"],
    )

    first = apply_action(
        dataframe,
        headers,
        column_ids,
        DropDuplicatesAction(keep="first"),
    )
    last = apply_action(
        dataframe,
        headers,
        column_ids,
        DropDuplicatesAction(keep="last"),
    )

    assert first.affected_count == 1
    assert first.dataframe["column_1"].tolist() == ["Aarav", "Meera"]
    assert last.dataframe["column_1"].tolist() == ["Meera", "Aarav"]


def test_convert_numeric_changes_recognized_values_and_reports_unresolved() -> None:
    dataframe, headers, column_ids = _table(
        [["1,200"], ["oops"], ["30.5"], [""]],
        ["amount"],
    )

    decimal = apply_action(
        dataframe,
        headers,
        column_ids,
        ConvertNumericAction(column_id="column_1", target_type="decimal"),
    )

    assert decimal.affected_count == 2
    assert decimal.unresolved_count == 1
    assert decimal.dataframe["column_1"].tolist() == [1200.0, "oops", 30.5, ""]
    assert decimal.warnings

    with pytest.raises(UploadError) as captured:
        apply_action(
            dataframe,
            headers,
            column_ids,
            ConvertNumericAction(column_id="column_1", target_type="integer"),
        )
    assert captured.value.code == "invalid_action"


def test_drop_empty_columns_requires_empty_columns_and_keeps_one_column() -> None:
    dataframe, headers, column_ids = _table(
        [["Aarav", "", None]],
        ["name", "unused", "also unused"],
    )

    result = apply_action(
        dataframe,
        headers,
        column_ids,
        DropEmptyColumnsAction(column_ids=["column_2", "column_3"]),
    )

    assert result.column_ids == ["column_1"]
    assert result.display_headers == ["name"]
    assert result.affected_count == 2

    with pytest.raises(UploadError):
        apply_action(
            dataframe[["column_2", "column_3"]],
            headers[1:],
            column_ids[1:],
            DropEmptyColumnsAction(column_ids=["column_2", "column_3"]),
        )


def test_standardize_date_uses_selected_order_and_leaves_unrecognized_values() -> None:
    dataframe, headers, column_ids = _table(
        [["03/04/2026"], ["2026-05-06"], ["not a date"], [""]],
        ["joined_date"],
    )

    result = apply_action(
        dataframe,
        headers,
        column_ids,
        StandardizeDateAction(
            column_id="column_1",
            date_order="day_first",
            output_format="YYYY-MM-DD",
        ),
    )

    assert result.dataframe["column_1"].tolist() == [
        "2026-04-03",
        "2026-05-06",
        "not a date",
        "",
    ]
    assert result.affected_count == 2
    assert result.unresolved_count == 1


def test_no_op_and_unknown_column_actions_are_rejected() -> None:
    dataframe, headers, column_ids = _table([["Aarav"]], ["name"])

    for action in (
        TrimWhitespaceAction(column_ids=["column_1"]),
        RenameColumnAction(column_id="column_1", new_name="name"),
        FillMissingAction(
            column_id="column_1",
            strategy="explicit",
            value="Unknown",
        ),
    ):
        with pytest.raises(UploadError) as captured:
            apply_action(dataframe, headers, column_ids, action)
        assert captured.value.code == "action_not_applicable"

    with pytest.raises(UploadError) as captured:
        apply_action(
            dataframe,
            headers,
            column_ids,
            TrimWhitespaceAction(column_ids=["column_99"]),
        )
    assert captured.value.code == "invalid_action"
