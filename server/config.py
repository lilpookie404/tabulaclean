"""Runtime settings for local development and public demo deployment."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import timedelta
from typing import Mapping

from .uploads.parser import MEBIBYTE, ParseLimits
from .uploads.store import SessionStore


DEFAULT_APP_ENV = "development"
DEFAULT_PUBLIC_DEMO_MODE = False
DEFAULT_UPLOAD_SESSION_TTL_MINUTES = 30
DEFAULT_MAX_UPLOAD_MB = 10
DEFAULT_MAX_ACTIVE_SESSIONS = 10


@dataclass(frozen=True)
class RuntimeSettings:
    app_env: str = DEFAULT_APP_ENV
    public_demo_mode: bool = DEFAULT_PUBLIC_DEMO_MODE
    upload_session_ttl_minutes: int = DEFAULT_UPLOAD_SESSION_TTL_MINUTES
    max_upload_mb: int = DEFAULT_MAX_UPLOAD_MB
    max_active_sessions: int = DEFAULT_MAX_ACTIVE_SESSIONS
    api_base_url: str | None = None
    model_name: str | None = None
    hf_token: str | None = None

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


def _optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _bool_from_env(value: str | None, default: bool) -> bool:
    if value is None or not value.strip():
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _positive_int_from_env(value: str | None, default: int) -> int:
    if value is None or not value.strip():
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    return parsed if parsed > 0 else default


def load_runtime_settings(
    environ: Mapping[str, str] | None = None,
) -> RuntimeSettings:
    source = os.environ if environ is None else environ
    return RuntimeSettings(
        app_env=_optional_text(source.get("APP_ENV")) or DEFAULT_APP_ENV,
        public_demo_mode=_bool_from_env(
            source.get("PUBLIC_DEMO_MODE"),
            DEFAULT_PUBLIC_DEMO_MODE,
        ),
        upload_session_ttl_minutes=_positive_int_from_env(
            source.get("UPLOAD_SESSION_TTL_MINUTES"),
            DEFAULT_UPLOAD_SESSION_TTL_MINUTES,
        ),
        max_upload_mb=_positive_int_from_env(
            source.get("MAX_UPLOAD_MB"),
            DEFAULT_MAX_UPLOAD_MB,
        ),
        max_active_sessions=_positive_int_from_env(
            source.get("MAX_ACTIVE_SESSIONS"),
            DEFAULT_MAX_ACTIVE_SESSIONS,
        ),
        api_base_url=_optional_text(source.get("API_BASE_URL")),
        model_name=_optional_text(source.get("MODEL_NAME")),
        hf_token=_optional_text(source.get("HF_TOKEN")),
    )


def parse_limits_from_settings(settings: RuntimeSettings) -> ParseLimits:
    return ParseLimits(max_upload_bytes=settings.max_upload_mb * MEBIBYTE)


def session_store_from_settings(settings: RuntimeSettings) -> SessionStore:
    return SessionStore(
        ttl=timedelta(minutes=settings.upload_session_ttl_minutes),
        max_sessions=settings.max_active_sessions,
    )
