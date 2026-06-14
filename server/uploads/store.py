"""Thread-safe, process-local storage for temporary upload sessions."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from threading import RLock
from typing import Any, Callable
from uuid import uuid4

import pandas as pd

from .errors import UploadError
from .parser import ParsedTable
from .profiler import TableProfile
from .schemas import ColumnDescriptor, DetectedIssue


Clock = Callable[[], datetime]


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class UploadSession:
    session_id: str
    filename: str
    sheet_name: str | None
    display_headers: list[str]
    column_ids: list[str]
    columns: list[ColumnDescriptor]
    issues: list[DetectedIssue]
    original_dataframe: pd.DataFrame
    current_dataframe: pd.DataFrame
    memory_bytes: int
    created_at: datetime
    last_accessed_at: datetime
    expires_at: datetime
    validation_status: str = "not_run"
    audit_log: list[dict[str, Any]] = field(default_factory=list)


class SessionStore:
    def __init__(
        self,
        *,
        clock: Clock = _utc_now,
        ttl: timedelta = timedelta(minutes=30),
        max_sessions: int = 10,
        max_total_bytes: int = 500 * 1024 * 1024,
    ) -> None:
        self._clock = clock
        self._ttl = ttl
        self._max_sessions = max_sessions
        self._max_total_bytes = max_total_bytes
        self._sessions: dict[str, UploadSession] = {}
        self._lock = RLock()

    @property
    def active_count(self) -> int:
        with self._lock:
            self._remove_expired(self._clock())
            return len(self._sessions)

    @property
    def total_memory_bytes(self) -> int:
        with self._lock:
            self._remove_expired(self._clock())
            return sum(session.memory_bytes for session in self._sessions.values())

    def _remove_expired(self, now: datetime) -> None:
        expired_ids = [
            session_id
            for session_id, session in self._sessions.items()
            if session.expires_at <= now
        ]
        for session_id in expired_ids:
            del self._sessions[session_id]

    def create(self, parsed: ParsedTable, profile: TableProfile) -> UploadSession:
        with self._lock:
            now = self._clock()
            self._remove_expired(now)

            original = parsed.dataframe.copy(deep=True)
            current = parsed.dataframe.copy(deep=True)
            memory_bytes = int(
                original.memory_usage(index=True, deep=True).sum()
                + current.memory_usage(index=True, deep=True).sum()
            )
            used_bytes = sum(
                session.memory_bytes for session in self._sessions.values()
            )
            if (
                len(self._sessions) >= self._max_sessions
                or used_bytes + memory_bytes > self._max_total_bytes
            ):
                raise UploadError(
                    503,
                    "session_capacity",
                    "TabulaClean is temporarily holding the maximum number of active files. Please try again shortly.",
                )

            session = UploadSession(
                session_id=str(uuid4()),
                filename=parsed.filename,
                sheet_name=parsed.sheet_name,
                display_headers=list(parsed.display_headers),
                column_ids=list(parsed.column_ids),
                columns=list(profile.columns),
                issues=list(profile.issues),
                original_dataframe=original,
                current_dataframe=current,
                memory_bytes=memory_bytes,
                created_at=now,
                last_accessed_at=now,
                expires_at=now + self._ttl,
            )
            self._sessions[session.session_id] = session
            return session

    def get(self, session_id: str) -> UploadSession:
        with self._lock:
            now = self._clock()
            self._remove_expired(now)
            session = self._sessions.get(session_id)
            if session is None:
                raise UploadError(
                    404,
                    "session_not_found",
                    "This temporary upload session is no longer available.",
                )
            session.last_accessed_at = now
            session.expires_at = now + self._ttl
            return session

    def clear(self) -> None:
        with self._lock:
            self._sessions.clear()
