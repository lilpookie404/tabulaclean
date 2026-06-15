from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd
import pytest

from server.uploads.errors import UploadError
from server.uploads.parser import ParsedTable
from server.uploads.profiler import profile_table
from server.uploads.schemas import (
    RenameColumnAction,
    TrimWhitespaceAction,
)
from server.uploads.store import SessionStore


def _parsed() -> ParsedTable:
    dataframe = pd.DataFrame(
        [[" Aarav ", "10"], ["Meera", "20"]],
        columns=["column_1", "column_2"],
    )
    return ParsedTable(
        filename="contacts.csv",
        sheet_name=None,
        display_headers=["name", "amount"],
        column_ids=["column_1", "column_2"],
        dataframe=dataframe,
        memory_bytes=int(dataframe.memory_usage(index=True, deep=True).sum()),
    )


def _session(store: SessionStore):
    parsed = _parsed()
    return store.create(parsed, profile_table(parsed))


def test_preview_is_non_mutating_and_bound_to_revision() -> None:
    store = SessionStore()
    session = _session(store)

    preview = store.preview_change(
        session.session_id,
        expected_revision=0,
        action=TrimWhitespaceAction(column_ids=["column_1"]),
    )

    assert preview.risk == "low"
    assert preview.affected_count == 1
    assert store.get(session.session_id).revision == 0
    assert store.get(session.session_id).current_dataframe.iloc[0, 0] == " Aarav "

    with pytest.raises(UploadError) as captured:
        store.preview_change(
            session.session_id,
            expected_revision=1,
            action=TrimWhitespaceAction(column_ids=["column_1"]),
        )
    assert captured.value.status_code == 409
    assert captured.value.code == "stale_revision"


def test_safe_change_applies_atomically_and_updates_profile_and_audit() -> None:
    store = SessionStore()
    session = _session(store)

    updated = store.create_change(
        session.session_id,
        expected_revision=0,
        action=TrimWhitespaceAction(column_ids=["column_1"]),
    )

    assert updated.revision == 1
    assert updated.current_dataframe.iloc[0, 0] == "Aarav"
    assert updated.pending_change is None
    assert len(updated.active_actions) == 1
    assert updated.audit_log[-1].status == "applied"
    assert "whitespace" not in {issue.type for issue in updated.issues}


def test_risky_change_waits_for_approval_then_applies() -> None:
    store = SessionStore()
    session = _session(store)

    pending_session = store.create_change(
        session.session_id,
        expected_revision=0,
        action=RenameColumnAction(column_id="column_1", new_name="Customer Name"),
    )

    assert pending_session.revision == 0
    assert pending_session.display_headers == ["name", "amount"]
    assert pending_session.pending_change is not None
    assert pending_session.pending_change.summary == "Rename a column"
    change_id = pending_session.pending_change.change_id

    approved = store.approve_change(
        session.session_id,
        change_id,
        expected_revision=0,
    )

    assert approved.revision == 1
    assert approved.display_headers == ["Customer Name", "amount"]
    assert approved.pending_change is None
    assert approved.audit_log[-1].status == "approved"


def test_reject_discards_pending_without_advancing_revision() -> None:
    store = SessionStore()
    session = _session(store)
    pending = store.create_change(
        session.session_id,
        expected_revision=0,
        action=RenameColumnAction(column_id="column_1", new_name="Customer Name"),
    ).pending_change
    assert pending is not None

    rejected = store.reject_change(
        session.session_id,
        pending.change_id,
        expected_revision=0,
    )

    assert rejected.revision == 0
    assert rejected.pending_change is None
    assert rejected.display_headers == ["name", "amount"]
    assert rejected.audit_log[-1].status == "rejected"


def test_pending_change_blocks_new_changes_and_undo() -> None:
    store = SessionStore()
    session = _session(store)
    store.create_change(
        session.session_id,
        expected_revision=0,
        action=RenameColumnAction(column_id="column_1", new_name="Customer Name"),
    )

    for operation in (
        lambda: store.create_change(
            session.session_id,
            expected_revision=0,
            action=TrimWhitespaceAction(column_ids=["column_1"]),
        ),
        lambda: store.undo(session.session_id, expected_revision=0),
    ):
        with pytest.raises(UploadError) as captured:
            operation()
        assert captured.value.status_code == 409
        assert captured.value.code == "change_pending"


def test_undo_replays_remaining_actions_and_reset_restores_original() -> None:
    store = SessionStore()
    session = _session(store)
    trimmed = store.create_change(
        session.session_id,
        expected_revision=0,
        action=TrimWhitespaceAction(column_ids=["column_1"]),
    )
    pending = store.create_change(
        session.session_id,
        expected_revision=1,
        action=RenameColumnAction(column_id="column_1", new_name="Customer Name"),
    ).pending_change
    assert pending is not None
    renamed = store.approve_change(
        session.session_id,
        pending.change_id,
        expected_revision=1,
    )

    undone = store.undo(session.session_id, expected_revision=renamed.revision)
    assert undone.revision == 3
    assert undone.display_headers == ["name", "amount"]
    assert undone.current_dataframe.iloc[0, 0] == "Aarav"
    assert len(undone.active_actions) == 1

    reset = store.reset(session.session_id, expected_revision=undone.revision)
    assert reset.revision == 4
    assert reset.current_dataframe.iloc[0, 0] == " Aarav "
    assert reset.active_actions == []
    assert reset.audit_log[-1].status == "reset"
    assert trimmed.original_dataframe.iloc[0, 0] == " Aarav "


def test_action_and_audit_limits_are_enforced() -> None:
    store = SessionStore(max_active_actions=1, max_audit_entries=2)
    session = _session(store)
    pending = store.create_change(
        session.session_id,
        expected_revision=0,
        action=RenameColumnAction(column_id="column_1", new_name="Customer Name"),
    ).pending_change
    assert pending is not None
    approved = store.approve_change(
        session.session_id,
        pending.change_id,
        expected_revision=0,
    )

    with pytest.raises(UploadError) as captured:
        store.create_change(
            session.session_id,
            expected_revision=approved.revision,
            action=RenameColumnAction(column_id="column_1", new_name="Name Again"),
        )
    assert captured.value.code == "action_history_full"

    reset = store.reset(session.session_id, expected_revision=approved.revision)
    for new_name in ("First", "Second", "Third"):
        pending = store.create_change(
            session.session_id,
            expected_revision=reset.revision,
            action=RenameColumnAction(column_id="column_1", new_name=new_name),
        ).pending_change
        assert pending is not None
        reset = store.reject_change(
            session.session_id,
            pending.change_id,
            expected_revision=reset.revision,
        )

    assert len(reset.audit_log) == 2
    assert all(entry.timestamp <= datetime.now(timezone.utc) for entry in reset.audit_log)


def test_failed_capacity_check_leaves_session_unchanged(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    store = SessionStore()
    session = _session(store)

    def reject_memory(*_args, **_kwargs):
        raise UploadError(
            503,
            "session_capacity",
            "Not enough temporary memory.",
        )

    monkeypatch.setattr(store, "_memory_bytes", reject_memory)

    with pytest.raises(UploadError):
        store.create_change(
            session.session_id,
            expected_revision=0,
            action=TrimWhitespaceAction(column_ids=["column_1"]),
        )

    restored = store.get(session.session_id)
    assert restored.revision == 0
    assert restored.current_dataframe.iloc[0, 0] == " Aarav "
    assert restored.active_actions == []
    assert restored.audit_log == []
