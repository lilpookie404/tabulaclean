"""Thread-safe, process-local storage for temporary upload sessions."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from threading import RLock
from typing import Callable, TypeVar
from uuid import uuid4

import pandas as pd

from .cleaning import (
    ActionResult,
    action_column_ids,
    action_summary,
    apply_action,
)
from .errors import UploadError
from .parser import ParsedTable
from .profiler import TableProfile, profile_table
from .schemas import (
    AuditEntry,
    ChangePreview,
    CleaningAction,
    ColumnDescriptor,
    DetectedIssue,
    PendingChange,
    ValidationResult,
)
from .validation import formula_download_warnings, validate_upload_table


Clock = Callable[[], datetime]
ReadResult = TypeVar("ReadResult")


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class UploadSession:
    session_id: str
    filename: str
    sheet_name: str | None
    original_display_headers: list[str]
    original_column_ids: list[str]
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
    validation_result: ValidationResult | None = None
    revision: int = 0
    active_actions: list[AppliedAction] = field(default_factory=list)
    pending_change: PendingChange | None = None
    audit_log: list[AuditEntry] = field(default_factory=list)


@dataclass(frozen=True)
class AppliedAction:
    change_id: str
    action: CleaningAction
    summary: str
    risk: str
    affected_count: int
    affected_unit: str
    column_ids: list[str]
    applied_at: datetime


class SessionStore:
    def __init__(
        self,
        *,
        clock: Clock = _utc_now,
        ttl: timedelta = timedelta(minutes=30),
        max_sessions: int = 10,
        max_total_bytes: int = 500 * 1024 * 1024,
        max_dataframe_bytes: int = 100 * 1024 * 1024,
        max_active_actions: int = 100,
        max_audit_entries: int = 200,
    ) -> None:
        self._clock = clock
        self._ttl = ttl
        self._max_sessions = max_sessions
        self._max_total_bytes = max_total_bytes
        self._max_dataframe_bytes = max_dataframe_bytes
        self._max_active_actions = max_active_actions
        self._max_audit_entries = max_audit_entries
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

            used_bytes = sum(
                session.memory_bytes for session in self._sessions.values()
            )
            estimated_bytes = parsed.memory_bytes * 2
            if (
                len(self._sessions) >= self._max_sessions
                or used_bytes + estimated_bytes > self._max_total_bytes
            ):
                raise UploadError(
                    503,
                    "session_capacity",
                    "TabulaClean is temporarily holding the maximum number of active files. Please try again shortly.",
                )

            original = parsed.dataframe.copy(deep=True)
            current = parsed.dataframe.copy(deep=True)
            memory_bytes = int(
                original.memory_usage(index=True, deep=True).sum()
                + current.memory_usage(index=True, deep=True).sum()
            )
            if used_bytes + memory_bytes > self._max_total_bytes:
                raise UploadError(
                    503,
                    "session_capacity",
                    "TabulaClean is temporarily holding the maximum number of active files. Please try again shortly.",
                )

            session = UploadSession(
                session_id=str(uuid4()),
                filename=parsed.filename,
                sheet_name=parsed.sheet_name,
                original_display_headers=list(parsed.display_headers),
                original_column_ids=list(parsed.column_ids),
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

    def _get_locked(self, session_id: str, now: datetime) -> UploadSession:
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

    def get(self, session_id: str) -> UploadSession:
        with self._lock:
            now = self._clock()
            return self._get_locked(session_id, now)

    def read(
        self,
        session_id: str,
        reader: Callable[[UploadSession], ReadResult],
    ) -> ReadResult:
        """Read and serialize one session while holding the store lock."""

        with self._lock:
            session = self._get_locked(session_id, self._clock())
            return reader(session)

    def _check_revision(self, session: UploadSession, expected_revision: int) -> None:
        if session.revision != expected_revision:
            raise UploadError(
                409,
                "stale_revision",
                "This spreadsheet changed in another view. Refresh it and try again.",
            )

    def _check_no_pending(self, session: UploadSession) -> None:
        if session.pending_change is not None:
            raise UploadError(
                409,
                "change_pending",
                "Review or reject the pending change before starting another fix.",
            )

    def _check_action_capacity(self, session: UploadSession) -> None:
        if len(session.active_actions) >= self._max_active_actions:
            raise UploadError(
                409,
                "action_history_full",
                "This temporary session has reached its cleaning-action limit. Download the current file or reset to the original.",
            )

    def _clear_validation(self, session: UploadSession) -> None:
        session.validation_status = "not_run"
        session.validation_result = None

    def _profile(
        self,
        session: UploadSession,
        dataframe: pd.DataFrame,
        display_headers: list[str],
        column_ids: list[str],
    ) -> TableProfile:
        parsed = ParsedTable(
            filename=session.filename,
            sheet_name=session.sheet_name,
            display_headers=list(display_headers),
            column_ids=list(column_ids),
            dataframe=dataframe,
            memory_bytes=int(dataframe.memory_usage(index=True, deep=True).sum()),
        )
        return profile_table(parsed)

    def _memory_bytes(
        self,
        session: UploadSession,
        current: pd.DataFrame,
    ) -> int:
        current_bytes = int(current.memory_usage(index=True, deep=True).sum())
        if current_bytes > self._max_dataframe_bytes:
            raise UploadError(
                413,
                "table_too_large",
                "This change would make the temporary table too large to hold safely.",
            )
        original_bytes = int(
            session.original_dataframe.memory_usage(index=True, deep=True).sum()
        )
        combined = original_bytes + current_bytes
        other_bytes = sum(
            stored.memory_bytes
            for stored in self._sessions.values()
            if stored.session_id != session.session_id
        )
        if other_bytes + combined > self._max_total_bytes:
            raise UploadError(
                503,
                "session_capacity",
                "TabulaClean does not have enough temporary memory for this change. Please try again shortly.",
            )
        return combined

    def _preview(
        self,
        session: UploadSession,
        action: CleaningAction,
    ) -> tuple[ActionResult, ChangePreview]:
        result = apply_action(
            session.current_dataframe,
            session.display_headers,
            session.column_ids,
            action,
        )
        preview = ChangePreview(
            base_revision=session.revision,
            action_type=action.type,
            summary=action_summary(action),
            risk=result.risk,
            affected_count=result.affected_count,
            affected_unit=result.affected_unit,
            unresolved_count=result.unresolved_count,
            samples=result.samples,
            warnings=result.warnings,
        )
        return result, preview

    def _append_audit(self, session: UploadSession, entry: AuditEntry) -> None:
        session.audit_log.append(entry)
        if len(session.audit_log) > self._max_audit_entries:
            del session.audit_log[: len(session.audit_log) - self._max_audit_entries]

    def _audit(
        self,
        session: UploadSession,
        *,
        now: datetime,
        status: str,
        action: CleaningAction | None = None,
        change_id: str | None = None,
        summary: str | None = None,
        risk: str | None = None,
        affected_count: int = 0,
        affected_unit: str = "changes",
        column_ids: list[str] | None = None,
    ) -> None:
        self._append_audit(
            session,
            AuditEntry(
                event_id=str(uuid4()),
                change_id=change_id,
                action_type=action.type if action is not None else "reset",
                summary=summary or (action_summary(action) if action is not None else "Reset to original"),
                risk=risk,
                status=status,
                affected_count=affected_count,
                affected_unit=affected_unit,
                column_ids=column_ids or (
                    action_column_ids(action) if action is not None else []
                ),
                timestamp=now,
                revision=session.revision,
            ),
        )

    def _commit_result(
        self,
        session: UploadSession,
        *,
        now: datetime,
        change_id: str,
        action: CleaningAction,
        result: ActionResult,
        status: str,
    ) -> None:
        memory_bytes = self._memory_bytes(session, result.dataframe)
        profile = self._profile(
            session,
            result.dataframe,
            result.display_headers,
            result.column_ids,
        )
        session.current_dataframe = result.dataframe
        session.display_headers = list(result.display_headers)
        session.column_ids = list(result.column_ids)
        session.columns = list(profile.columns)
        session.issues = list(profile.issues)
        session.memory_bytes = memory_bytes
        session.revision += 1
        self._clear_validation(session)
        session.active_actions.append(
            AppliedAction(
                change_id=change_id,
                action=action,
                summary=action_summary(action),
                risk=result.risk,
                affected_count=result.affected_count,
                affected_unit=result.affected_unit,
                column_ids=action_column_ids(action),
                applied_at=now,
            )
        )
        self._audit(
            session,
            now=now,
            status=status,
            action=action,
            change_id=change_id,
            risk=result.risk,
            affected_count=result.affected_count,
            affected_unit=result.affected_unit,
        )

    def preview_change(
        self,
        session_id: str,
        *,
        expected_revision: int,
        action: CleaningAction,
    ) -> ChangePreview:
        with self._lock:
            now = self._clock()
            session = self._get_locked(session_id, now)
            self._check_revision(session, expected_revision)
            self._check_no_pending(session)
            _, preview = self._preview(session, action)
            return preview

    def create_change(
        self,
        session_id: str,
        *,
        expected_revision: int,
        action: CleaningAction,
    ) -> UploadSession:
        with self._lock:
            now = self._clock()
            session = self._get_locked(session_id, now)
            self._check_revision(session, expected_revision)
            self._check_no_pending(session)
            self._check_action_capacity(session)
            result, preview = self._preview(session, action)
            change_id = str(uuid4())
            if result.risk == "low":
                self._commit_result(
                    session,
                    now=now,
                    change_id=change_id,
                    action=action,
                    result=result,
                    status="applied",
                )
                return session
            self._clear_validation(session)
            session.pending_change = PendingChange(
                **preview.model_dump(),
                change_id=change_id,
                action=action,
                created_at=now,
            )
            self._audit(
                session,
                now=now,
                status="pending",
                action=action,
                change_id=change_id,
                risk=result.risk,
                affected_count=result.affected_count,
                affected_unit=result.affected_unit,
            )
            return session

    def _require_pending(
        self,
        session: UploadSession,
        change_id: str,
    ) -> PendingChange:
        pending = session.pending_change
        if pending is None or pending.change_id != change_id:
            raise UploadError(
                404,
                "change_not_found",
                "This pending change is no longer available.",
            )
        return pending

    def approve_change(
        self,
        session_id: str,
        change_id: str,
        *,
        expected_revision: int,
    ) -> UploadSession:
        with self._lock:
            now = self._clock()
            session = self._get_locked(session_id, now)
            self._check_revision(session, expected_revision)
            pending = self._require_pending(session, change_id)
            if pending.base_revision != session.revision:
                raise UploadError(
                    409,
                    "stale_change",
                    "This change was prepared for an older version of the spreadsheet.",
                )
            self._check_action_capacity(session)
            result, _ = self._preview(session, pending.action)
            self._commit_result(
                session,
                now=now,
                change_id=change_id,
                action=pending.action,
                result=result,
                status="approved",
            )
            session.pending_change = None
            self._clear_validation(session)
            return session

    def reject_change(
        self,
        session_id: str,
        change_id: str,
        *,
        expected_revision: int,
    ) -> UploadSession:
        with self._lock:
            now = self._clock()
            session = self._get_locked(session_id, now)
            self._check_revision(session, expected_revision)
            pending = self._require_pending(session, change_id)
            self._audit(
                session,
                now=now,
                status="rejected",
                action=pending.action,
                change_id=change_id,
                risk=pending.risk,
                affected_count=pending.affected_count,
                affected_unit=pending.affected_unit,
            )
            session.pending_change = None
            self._clear_validation(session)
            return session

    def _replay(
        self,
        session: UploadSession,
        actions: list[AppliedAction],
    ) -> tuple[pd.DataFrame, list[str], list[str]]:
        dataframe = session.original_dataframe.copy(deep=True)
        display_headers = list(session.original_display_headers)
        column_ids = list(session.original_column_ids)
        for applied in actions:
            result = apply_action(
                dataframe,
                display_headers,
                column_ids,
                applied.action,
            )
            dataframe = result.dataframe
            display_headers = result.display_headers
            column_ids = result.column_ids
        return dataframe, display_headers, column_ids

    def undo(self, session_id: str, *, expected_revision: int) -> UploadSession:
        with self._lock:
            now = self._clock()
            session = self._get_locked(session_id, now)
            self._check_revision(session, expected_revision)
            self._check_no_pending(session)
            if not session.active_actions:
                raise UploadError(
                    422,
                    "action_not_applicable",
                    "There is no applied change to undo.",
                )
            removed = session.active_actions[-1]
            remaining = session.active_actions[:-1]
            dataframe, display_headers, column_ids = self._replay(session, remaining)
            memory_bytes = self._memory_bytes(session, dataframe)
            profile = self._profile(session, dataframe, display_headers, column_ids)
            session.current_dataframe = dataframe
            session.display_headers = display_headers
            session.column_ids = column_ids
            session.columns = list(profile.columns)
            session.issues = list(profile.issues)
            session.memory_bytes = memory_bytes
            session.active_actions = list(remaining)
            session.revision += 1
            self._clear_validation(session)
            self._audit(
                session,
                now=now,
                status="undone",
                action=removed.action,
                change_id=removed.change_id,
                summary=removed.summary,
                risk=removed.risk,
                affected_count=removed.affected_count,
                affected_unit=removed.affected_unit,
                column_ids=removed.column_ids,
            )
            return session

    def reset(self, session_id: str, *, expected_revision: int) -> UploadSession:
        with self._lock:
            now = self._clock()
            session = self._get_locked(session_id, now)
            self._check_revision(session, expected_revision)
            if not session.active_actions and session.pending_change is None:
                raise UploadError(
                    422,
                    "action_not_applicable",
                    "This spreadsheet is already at its original state.",
                )
            table_changed = bool(session.active_actions)
            dataframe = session.original_dataframe.copy(deep=True)
            memory_bytes = self._memory_bytes(session, dataframe)
            profile = self._profile(
                session,
                dataframe,
                session.original_display_headers,
                session.original_column_ids,
            )
            session.current_dataframe = dataframe
            session.display_headers = list(session.original_display_headers)
            session.column_ids = list(session.original_column_ids)
            session.columns = list(profile.columns)
            session.issues = list(profile.issues)
            session.memory_bytes = memory_bytes
            session.active_actions = []
            session.pending_change = None
            if table_changed:
                session.revision += 1
            self._clear_validation(session)
            self._audit(
                session,
                now=now,
                status="reset",
                affected_count=1 if table_changed else 0,
                affected_unit="session",
            )
            return session

    def validate(
        self,
        session_id: str,
        *,
        expected_revision: int,
        required_column_ids: list[str],
    ) -> UploadSession:
        with self._lock:
            now = self._clock()
            session = self._get_locked(session_id, now)
            self._check_revision(session, expected_revision)
            unknown = [
                column_id
                for column_id in required_column_ids
                if column_id not in session.column_ids
            ]
            if unknown:
                raise UploadError(
                    422,
                    "unknown_column",
                    "Choose required columns that still exist in this spreadsheet.",
                )
            result = validate_upload_table(
                dataframe=session.current_dataframe,
                required_column_ids=list(dict.fromkeys(required_column_ids)),
                has_pending_change=session.pending_change is not None,
                issues=session.issues,
                download_warnings=formula_download_warnings(session.current_dataframe),
                revision=session.revision,
                ran_at=now,
            )
            session.validation_status = result.status
            session.validation_result = result
            return session

    def clear(self) -> None:
        with self._lock:
            self._sessions.clear()
