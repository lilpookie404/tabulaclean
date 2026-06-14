from __future__ import annotations

from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

from server.app import app
import server.uploads.router as upload_router
from server.uploads.parser import ParseLimits
from server.uploads.store import SessionStore


@pytest.fixture(autouse=True)
def clear_upload_sessions() -> None:
    upload_router.session_store.clear()
    yield
    upload_router.session_store.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _xlsx_bytes() -> bytes:
    workbook = Workbook()
    hidden = workbook.active
    hidden.title = "Archive"
    hidden.append(["ignore"])
    hidden.append(["old"])
    visible = workbook.create_sheet("Contacts")
    visible.append(["name", "joined"])
    visible.append(["Aarav", "2026-01-02"])
    hidden.sheet_state = "hidden"
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def test_csv_upload_creates_session_with_preview_and_issues(client: TestClient) -> None:
    response = client.post(
        "/api/uploads",
        files={
            "file": (
                "contacts.csv",
                b"name,amount\n Aarav ,10\nMeera,20\n",
                "text/csv",
            )
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["session_id"]
    assert payload["filename"] == "contacts.csv"
    assert payload["sheet_name"] is None
    assert payload["row_count"] == 2
    assert payload["column_count"] == 2
    assert payload["columns"] == [
        {
            "id": "column_1",
            "name": "name",
            "position": 0,
            "inferred_type": "text",
        },
        {
            "id": "column_2",
            "name": "amount",
            "position": 1,
            "inferred_type": "integer",
        },
    ]
    assert payload["preview_rows"][0] == {
        "row_number": 2,
        "values": {"column_1": " Aarav ", "column_2": "10"},
    }
    assert {issue["type"] for issue in payload["issues"]} == {
        "whitespace",
        "numeric_text",
    }
    assert payload["issue_count"] == 2
    assert payload["validation_status"] == "not_run"
    assert payload["audit_log"] == []
    assert payload["expires_at"]


def test_xlsx_upload_creates_session_from_first_visible_sheet(client: TestClient) -> None:
    response = client.post(
        "/api/uploads",
        files={
            "file": (
                "contacts.xlsx",
                _xlsx_bytes(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["sheet_name"] == "Contacts"
    assert payload["row_count"] == 1
    assert payload["preview_rows"][0]["values"]["column_1"] == "Aarav"


@pytest.mark.parametrize(
    ("filename", "payload", "status_code", "code"),
    [
        ("notes.txt", b"name\nAarav\n", 415, "unsupported_file_type"),
        ("empty.csv", b"", 422, "empty_file"),
        ("header.csv", b"name\n", 422, "empty_table"),
        ("broken.xlsx", b"not a workbook", 422, "invalid_file"),
    ],
)
def test_upload_errors_are_stable_and_friendly(
    client: TestClient,
    filename: str,
    payload: bytes,
    status_code: int,
    code: str,
) -> None:
    response = client.post(
        "/api/uploads",
        files={"file": (filename, payload, "application/octet-stream")},
    )

    assert response.status_code == status_code
    assert response.json() == {
        "code": code,
        "message": response.json()["message"],
    }
    assert response.json()["message"]
    assert "traceback" not in response.text.lower()


def test_get_session_returns_current_snapshot(client: TestClient) -> None:
    uploaded = client.post(
        "/api/uploads",
        files={"file": ("contacts.csv", b"name\nAarav\n", "text/csv")},
    ).json()

    response = client.get(f"/api/sessions/{uploaded['session_id']}")

    assert response.status_code == 200
    assert response.json()["session_id"] == uploaded["session_id"]
    assert response.json()["preview_rows"] == uploaded["preview_rows"]
    assert response.json()["issues"] == uploaded["issues"]


def test_missing_session_returns_404(client: TestClient) -> None:
    response = client.get("/api/sessions/not-a-session")

    assert response.status_code == 404
    assert response.json() == {
        "code": "session_not_found",
        "message": "This temporary upload session is no longer available.",
    }


def test_download_returns_utf8_bom_csv_with_original_headers(client: TestClient) -> None:
    uploaded = client.post(
        "/api/uploads",
        files={
            "file": (
                "customer contacts.csv",
                b"name,,name\nAarav,x,Alias\n",
                "text/csv",
            )
        },
    ).json()

    response = client.get(f"/api/sessions/{uploaded['session_id']}/download")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "customer-contacts-current.csv" in response.headers["content-disposition"]
    assert response.content.startswith(b"\xef\xbb\xbf")
    assert response.content.decode("utf-8-sig").splitlines() == [
        "name,,name",
        "Aarav,x,Alias",
    ]


def test_upload_enforces_bounded_read(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(
        upload_router,
        "parse_limits",
        ParseLimits(max_upload_bytes=10),
    )

    response = client.post(
        "/api/uploads",
        files={"file": ("large.csv", b"name\n" + (b"x" * 20), "text/csv")},
    )

    assert response.status_code == 413
    assert response.json()["code"] == "file_too_large"


def test_upload_capacity_error_does_not_remove_existing_session(
    client: TestClient,
    monkeypatch,
) -> None:
    limited_store = SessionStore(max_sessions=1)
    monkeypatch.setattr(upload_router, "session_store", limited_store)
    first = client.post(
        "/api/uploads",
        files={"file": ("first.csv", b"name\nAarav\n", "text/csv")},
    ).json()

    response = client.post(
        "/api/uploads",
        files={"file": ("second.csv", b"name\nMeera\n", "text/csv")},
    )

    assert response.status_code == 503
    assert response.json()["code"] == "session_capacity"
    assert client.get(f"/api/sessions/{first['session_id']}").status_code == 200


def test_existing_backend_and_evaluation_routes_still_work(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "healthy"}
    assert client.get("/play/api/config").status_code == 200

    with client.websocket_connect("/ws") as websocket:
        websocket.send_json(
            {"type": "reset", "data": {"task_id": "easy_contacts_cleanup"}}
        )
        assert websocket.receive_json()["type"] == "observation"
        websocket.send_json({"type": "state"})
        assert websocket.receive_json()["type"] == "state"
