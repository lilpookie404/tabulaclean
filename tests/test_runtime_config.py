from __future__ import annotations

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

import server.uploads.router as upload_router
from server.app import create_application
from server.config import (
    RuntimeSettings,
    load_runtime_settings,
    parse_limits_from_settings,
    session_store_from_settings,
)


@pytest.fixture(autouse=True)
def restore_upload_runtime_config() -> None:
    yield
    default_settings = RuntimeSettings()
    upload_router.parse_limits = parse_limits_from_settings(default_settings)
    upload_router.session_store = session_store_from_settings(default_settings)


def test_runtime_settings_keep_existing_defaults() -> None:
    settings = load_runtime_settings({})

    assert settings.app_env == "development"
    assert settings.public_demo_mode is False
    assert settings.upload_session_ttl_minutes == 30
    assert settings.max_upload_mb == 10
    assert settings.max_active_sessions == 10
    assert settings.api_base_url is None
    assert settings.model_name is None
    assert settings.hf_token is None


def test_runtime_settings_read_environment_overrides() -> None:
    settings = load_runtime_settings(
        {
            "APP_ENV": "production",
            "PUBLIC_DEMO_MODE": "true",
            "UPLOAD_SESSION_TTL_MINUTES": "45",
            "MAX_UPLOAD_MB": "7",
            "MAX_ACTIVE_SESSIONS": "3",
            "API_BASE_URL": "https://router.huggingface.co/v1",
            "MODEL_NAME": "demo/model",
            "HF_TOKEN": "hf-demo",
        }
    )

    assert settings.app_env == "production"
    assert settings.is_production is True
    assert settings.public_demo_mode is True
    assert settings.upload_session_ttl_minutes == 45
    assert settings.max_upload_mb == 7
    assert settings.max_active_sessions == 3
    assert settings.api_base_url == "https://router.huggingface.co/v1"
    assert settings.model_name == "demo/model"
    assert settings.hf_token == "hf-demo"


def test_runtime_settings_build_upload_limits_and_session_store() -> None:
    settings = RuntimeSettings(
        app_env="production",
        public_demo_mode=True,
        upload_session_ttl_minutes=12,
        max_upload_mb=2,
        max_active_sessions=1,
    )

    parse_limits = parse_limits_from_settings(settings)
    session_store = session_store_from_settings(settings)

    assert parse_limits.max_upload_bytes == 2 * 1024 * 1024
    assert session_store._ttl == timedelta(minutes=12)
    assert session_store._max_sessions == 1


def test_configured_upload_limit_is_enforced_by_upload_api() -> None:
    app = create_application(
        RuntimeSettings(
            max_upload_mb=1,
            upload_session_ttl_minutes=30,
            max_active_sessions=10,
        )
    )

    response = TestClient(app).post(
        "/api/uploads",
        files={
            "file": (
                "too-large.csv",
                b"name\n" + (b"A" * (1024 * 1024)),
                "text/csv",
            )
        },
    )

    assert response.status_code == 413
    assert response.json() == {
        "code": "file_too_large",
        "message": "Please choose a spreadsheet no larger than 1 MB.",
    }


def test_configured_session_capacity_is_enforced_by_upload_api() -> None:
    app = create_application(
        RuntimeSettings(
            max_active_sessions=1,
            upload_session_ttl_minutes=30,
            max_upload_mb=10,
        )
    )
    client = TestClient(app)

    first = client.post(
        "/api/uploads",
        files={"file": ("one.csv", b"name\nAarav\n", "text/csv")},
    )
    second = client.post(
        "/api/uploads",
        files={"file": ("two.csv", b"name\nMeera\n", "text/csv")},
    )

    assert first.status_code == 201
    assert second.status_code == 503
    assert second.json() == {
        "code": "session_capacity",
        "message": (
            "TabulaClean is temporarily holding the maximum number of active "
            "files. Please try again shortly."
        ),
    }


def test_production_unexpected_errors_do_not_expose_internal_details() -> None:
    app = create_application(
        RuntimeSettings(
            app_env="production",
            public_demo_mode=True,
            upload_session_ttl_minutes=30,
            max_upload_mb=10,
            max_active_sessions=10,
        )
    )

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("raw cell value from /Users/example/private.csv")

    response = TestClient(app, raise_server_exceptions=False).get("/boom")

    assert response.status_code == 500
    assert response.json() == {
        "code": "internal_error",
        "message": "Something went wrong. Please try again.",
    }
    assert "RuntimeError" not in response.text
    assert "raw cell value" not in response.text
    assert "/Users/example" not in response.text
