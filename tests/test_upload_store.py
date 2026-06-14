from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

import pandas as pd
import pytest

from server.uploads.errors import UploadError
from server.uploads.parser import ParsedTable
from server.uploads.profiler import profile_table
from server.uploads.store import SessionStore


class MutableClock:
    def __init__(self) -> None:
        self.value = datetime(2026, 6, 14, 12, 0, tzinfo=timezone.utc)

    def __call__(self) -> datetime:
        return self.value

    def advance(self, **kwargs: int) -> None:
        self.value += timedelta(**kwargs)


def _parsed(name: str = "contacts.csv") -> ParsedTable:
    dataframe = pd.DataFrame(
        [["Aarav", "10"], ["Meera", "20"]],
        columns=["column_1", "column_2"],
    )
    return ParsedTable(
        filename=name,
        sheet_name=None,
        display_headers=["name", "amount"],
        column_ids=["column_1", "column_2"],
        dataframe=dataframe,
        memory_bytes=int(dataframe.memory_usage(index=True, deep=True).sum()),
    )


def test_store_creates_uuid_session_with_independent_dataframe_copies() -> None:
    parsed = _parsed()
    store = SessionStore()

    session = store.create(parsed, profile_table(parsed))
    session.current_dataframe.iloc[0, 0] = "Changed"

    UUID(session.session_id)
    assert session.original_dataframe.iloc[0, 0] == "Aarav"
    assert session.current_dataframe.iloc[0, 0] == "Changed"
    assert session.audit_log == []
    assert session.validation_status == "not_run"


def test_get_refreshes_sliding_expiry() -> None:
    clock = MutableClock()
    store = SessionStore(clock=clock, ttl=timedelta(minutes=30))
    session = store.create(_parsed(), profile_table(_parsed()))
    first_expiry = session.expires_at

    clock.advance(minutes=20)
    refreshed = store.get(session.session_id)

    assert refreshed.expires_at == clock.value + timedelta(minutes=30)
    assert refreshed.expires_at > first_expiry


def test_expired_sessions_are_removed_and_return_not_found() -> None:
    clock = MutableClock()
    store = SessionStore(clock=clock, ttl=timedelta(minutes=30))
    session = store.create(_parsed(), profile_table(_parsed()))

    clock.advance(minutes=31)

    with pytest.raises(UploadError) as captured:
        store.get(session.session_id)

    assert captured.value.status_code == 404
    assert captured.value.code == "session_not_found"
    assert store.active_count == 0


def test_store_rejects_new_session_without_evicting_live_session() -> None:
    store = SessionStore(max_sessions=1)
    first_parsed = _parsed("first.csv")
    first = store.create(first_parsed, profile_table(first_parsed))
    second_parsed = _parsed("second.csv")

    with pytest.raises(UploadError) as captured:
        store.create(second_parsed, profile_table(second_parsed))

    assert captured.value.status_code == 503
    assert captured.value.code == "session_capacity"
    assert store.get(first.session_id).filename == "first.csv"
    assert store.active_count == 1


def test_store_removes_expired_session_before_capacity_check() -> None:
    clock = MutableClock()
    store = SessionStore(
        clock=clock,
        ttl=timedelta(minutes=30),
        max_sessions=1,
    )
    first_parsed = _parsed("first.csv")
    first = store.create(first_parsed, profile_table(first_parsed))
    clock.advance(minutes=31)
    second_parsed = _parsed("second.csv")

    second = store.create(second_parsed, profile_table(second_parsed))

    assert second.filename == "second.csv"
    assert store.active_count == 1
    with pytest.raises(UploadError):
        store.get(first.session_id)


def test_store_enforces_total_dataframe_memory_budget() -> None:
    parsed = _parsed()
    store = SessionStore(max_total_bytes=(parsed.memory_bytes * 2) - 1)

    with pytest.raises(UploadError) as captured:
        store.create(parsed, profile_table(parsed))

    assert captured.value.status_code == 503
    assert captured.value.code == "session_capacity"
    assert store.active_count == 0


def test_store_rejects_estimated_capacity_before_copying_dataframe(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    parsed = _parsed()
    profile = profile_table(parsed)
    store = SessionStore(max_total_bytes=(parsed.memory_bytes * 2) - 1)

    def fail_copy(*_args, **_kwargs):
        raise AssertionError("Capacity should be checked before DataFrames are copied.")

    monkeypatch.setattr(pd.DataFrame, "copy", fail_copy)

    with pytest.raises(UploadError) as captured:
        store.create(parsed, profile)

    assert captured.value.code == "session_capacity"
