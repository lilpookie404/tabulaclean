from __future__ import annotations

import json

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


def _upload_issue_rich_csv(client: TestClient) -> dict:
    response = client.post(
        "/api/uploads",
        files={
            "file": (
                "messy.csv",
                (
                    b" Name ,amount,joined,empty,email\n"
                    b" SuperSecret ,10,2026-01-02,,secret@example.com\n"
                    b"Meera,20,02/03/2026,,\n"
                    b"Meera,20,02/03/2026,,\n"
                ),
                "text/csv",
            )
        },
    )
    assert response.status_code == 201
    return response.json()


def _generate_suggestions(
    client: TestClient,
    session_id: str,
    *,
    revision: int = 0,
    use_model: bool = False,
):
    return client.post(
        f"/api/sessions/{session_id}/suggestions",
        json={"expected_revision": revision, "use_model": use_model},
    )


def test_suggestions_endpoint_returns_local_revisioned_typed_actions(
    client: TestClient,
) -> None:
    uploaded = _upload_issue_rich_csv(client)
    assert uploaded["suggestion_status"] == "not_run"
    assert uploaded["suggestion_result"] is None

    response = _generate_suggestions(client, uploaded["session_id"])

    assert response.status_code == 200
    payload = response.json()
    assert payload["revision"] == 0
    assert payload["suggestion_status"] == "ready"
    result = payload["suggestion_result"]
    assert result["revision"] == 0
    assert result["mode"] == "local"
    assert result["model_status"] == "not_configured"
    suggestions = result["suggestions"]
    by_issue = {suggestion["issue_type"]: suggestion for suggestion in suggestions}
    assert by_issue["whitespace"]["action"] == {
        "type": "trim_whitespace",
        "column_ids": ["column_1"],
    }
    assert by_issue["duplicate_rows"]["action"] == {
        "type": "drop_duplicates",
        "keep": "first",
    }
    assert by_issue["numeric_text"]["action"] == {
        "type": "convert_numeric",
        "column_id": "column_2",
        "target_type": "decimal",
    }
    assert by_issue["empty_columns"]["action"] == {
        "type": "drop_empty_columns",
        "column_ids": ["column_4"],
    }
    assert by_issue["inconsistent_dates"]["action"] == {
        "type": "standardize_date",
        "column_id": "column_3",
        "date_order": "day_first",
        "output_format": "YYYY-MM-DD",
    }
    assert by_issue["missing_values"]["action"] == {
        "type": "fill_missing",
        "column_id": "column_5",
        "strategy": "most_common",
        "value": None,
    }
    assert by_issue["messy_column_names"]["action"] == {
        "type": "rename_column",
        "column_id": "column_1",
        "new_name": "Name",
    }


def test_suggestions_reject_stale_revision_and_pending_change(
    client: TestClient,
) -> None:
    uploaded = _upload_issue_rich_csv(client)

    stale = _generate_suggestions(client, uploaded["session_id"], revision=1)
    assert stale.status_code == 409
    assert stale.json()["code"] == "stale_revision"

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

    blocked = _generate_suggestions(client, uploaded["session_id"])
    assert blocked.status_code == 409
    assert blocked.json()["code"] == "change_pending"


def test_suggestions_are_cleared_after_table_mutation(client: TestClient) -> None:
    uploaded = _upload_issue_rich_csv(client)
    generated = _generate_suggestions(client, uploaded["session_id"])
    assert generated.status_code == 200
    assert generated.json()["suggestion_status"] == "ready"

    changed = client.post(
        f"/api/sessions/{uploaded['session_id']}/changes",
        json={
            "expected_revision": 0,
            "action": {"type": "trim_whitespace", "column_ids": ["column_1"]},
        },
    )

    assert changed.status_code == 200
    assert changed.json()["revision"] == 1
    assert changed.json()["suggestion_status"] == "not_run"
    assert changed.json()["suggestion_result"] is None


def test_model_enhancement_receives_metadata_only_and_cannot_change_actions(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import server.uploads.suggestions as suggestion_module

    captured_payload: dict | None = None

    def fake_enhancer(payload, candidates):
        nonlocal captured_payload
        captured_payload = payload
        changed = candidates[-1].model_copy(
            update={
                "source": "ai",
                "title": "AI-ranked suggestion",
                "rationale": "Ranked from metadata only.",
                "action": {"type": "trim_whitespace", "column_ids": ["not-real"]},
            }
        )
        return [changed], "used", "Fake model ranked the local candidates."

    monkeypatch.setattr(suggestion_module, "enhance_with_model", fake_enhancer)
    uploaded = _upload_issue_rich_csv(client)

    response = _generate_suggestions(
        client,
        uploaded["session_id"],
        use_model=True,
    )

    assert response.status_code == 200
    result = response.json()["suggestion_result"]
    assert result["mode"] == "ai_enhanced"
    assert result["model_status"] == "used"
    assert result["model_message"] == "Fake model ranked the local candidates."
    assert result["suggestions"][0]["title"] == "AI-ranked suggestion"
    assert result["suggestions"][0]["source"] == "ai"
    assert result["suggestions"][0]["action"] != {
        "type": "trim_whitespace",
        "column_ids": ["not-real"],
    }
    assert captured_payload is not None
    payload_text = json.dumps(captured_payload)
    assert "SuperSecret" not in payload_text
    assert "secret@example.com" not in payload_text
    assert "preview_rows" not in captured_payload
    assert "dataframe" not in captured_payload
