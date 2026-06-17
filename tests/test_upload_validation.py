from __future__ import annotations

import json
import zipfile
from io import BytesIO

import pytest
from fastapi.testclient import TestClient

from server.app import app
import server.uploads.router as upload_router


@pytest.fixture(autouse=True)
def clear_upload_sessions() -> None:
    upload_router.session_store.clear()
    yield
    upload_router.session_store.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _upload(
    client: TestClient,
    payload: bytes = b"name,email\nAarav,a@example.com\nMeera,\n",
) -> dict:
    response = client.post(
        "/api/uploads",
        files={"file": ("contacts.csv", payload, "text/csv")},
    )
    assert response.status_code == 201
    return response.json()


def _run_validation(
    client: TestClient,
    session_id: str,
    *,
    revision: int = 0,
    required_column_ids: list[str] | None = None,
):
    return client.post(
        f"/api/sessions/{session_id}/validations",
        json={
            "expected_revision": revision,
            "required_column_ids": required_column_ids or [],
        },
    )


def test_validation_passes_without_required_blanks_and_stores_result(
    client: TestClient,
) -> None:
    uploaded = _upload(client)

    response = _run_validation(
        client,
        uploaded["session_id"],
        required_column_ids=["column_1"],
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["validation_status"] == "passed"
    result = payload["validation_result"]
    assert result["status"] == "passed"
    assert result["revision"] == 0
    assert result["required_column_ids"] == ["column_1"]
    assert {check["check_id"] for check in result["checks"]} >= {
        "pending_review",
        "required_columns",
        "remaining_issues",
    }
    assert result["summary"]["errors"] == 0
    assert result["summary"]["warnings"] >= 1

    restored = client.get(f"/api/sessions/{uploaded['session_id']}").json()
    assert restored["validation_status"] == "passed"
    assert restored["validation_result"]["revision"] == 0


def test_validation_fails_for_required_column_blanks(client: TestClient) -> None:
    uploaded = _upload(client)

    response = _run_validation(
        client,
        uploaded["session_id"],
        required_column_ids=["column_2"],
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["validation_status"] == "failed"
    result = payload["validation_result"]
    required_check = next(
        check for check in result["checks"] if check["check_id"] == "required_columns"
    )
    assert required_check["status"] == "failed"
    assert required_check["severity"] == "error"
    assert required_check["affected_count"] == 1
    assert required_check["affected_columns"] == ["column_2"]
    assert required_check["example_rows"] == [3]


def test_validation_fails_when_risky_change_is_pending(client: TestClient) -> None:
    uploaded = _upload(client)
    pending = client.post(
        f"/api/sessions/{uploaded['session_id']}/changes",
        json={
            "expected_revision": 0,
            "action": {
                "type": "rename_column",
                "column_id": "column_1",
                "new_name": "Customer Name",
            },
        },
    )
    assert pending.status_code == 200

    response = _run_validation(
        client,
        uploaded["session_id"],
        required_column_ids=["column_1"],
    )

    assert response.status_code == 200
    pending_check = next(
        check
        for check in response.json()["validation_result"]["checks"]
        if check["check_id"] == "pending_review"
    )
    assert pending_check["status"] == "failed"
    assert pending_check["severity"] == "error"


def test_validation_rejects_stale_revision_and_unknown_columns(
    client: TestClient,
) -> None:
    uploaded = _upload(client)

    stale = _run_validation(client, uploaded["session_id"], revision=1)
    assert stale.status_code == 409
    assert stale.json()["code"] == "stale_revision"

    unknown = _run_validation(
        client,
        uploaded["session_id"],
        required_column_ids=["missing"],
    )
    assert unknown.status_code == 422
    assert unknown.json()["code"] == "unknown_column"


def test_validation_result_is_invalidated_after_table_change(
    client: TestClient,
) -> None:
    uploaded = _upload(client, b"name\n Aarav \n")
    validated = _run_validation(
        client,
        uploaded["session_id"],
        required_column_ids=["column_1"],
    )
    assert validated.status_code == 200
    assert validated.json()["validation_status"] == "passed"

    changed = client.post(
        f"/api/sessions/{uploaded['session_id']}/changes",
        json={
            "expected_revision": 0,
            "action": {"type": "trim_whitespace", "column_ids": ["column_1"]},
        },
    )

    assert changed.status_code == 200
    assert changed.json()["revision"] == 1
    assert changed.json()["validation_status"] == "not_run"
    assert changed.json()["validation_result"] is None


def test_validated_export_requires_current_validation_and_contains_reports(
    client: TestClient,
) -> None:
    uploaded = _upload(client)
    before_validation = client.get(
        f"/api/sessions/{uploaded['session_id']}/validated-export"
    )
    assert before_validation.status_code == 409
    assert before_validation.json()["code"] == "validation_not_run"

    _run_validation(client, uploaded["session_id"], required_column_ids=["column_2"])

    response = client.get(f"/api/sessions/{uploaded['session_id']}/validated-export")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/zip")
    assert "contacts-validated.zip" in response.headers["content-disposition"]
    archive = zipfile.ZipFile(BytesIO(response.content))
    assert archive.namelist() == [
        "cleaned.csv",
        "validation-report.json",
        "audit-log.json",
    ]
    assert "Aarav" in archive.read("cleaned.csv").decode("utf-8-sig")
    report = json.loads(archive.read("validation-report.json"))
    assert report["status"] == "failed"
    assert report["required_column_ids"] == ["column_2"]
    audit_log = json.loads(archive.read("audit-log.json"))
    assert audit_log == []
