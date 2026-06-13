from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

import inference
import server.frontend as frontend
from server.app import app
from server.environment import TabularCleaningEnvironment
from tabular_cleaning_env.graders import SCORE_MAX, SCORE_MIN, grade_task
from tabular_cleaning_env.models import ActionType, TabularCleaningAction
from tabular_cleaning_env.tasks import TASKS

OPEN_INTERVAL_MIN = SCORE_MIN
OPEN_INTERVAL_MAX = SCORE_MAX
TASK_SCORE_MIN = 0.0
TASK_SCORE_MAX = 1.0
REWARD_MIN = 0.01


def test_app_import_smoke() -> None:
    assert app is not None


def _write_frontend_build(dist_dir: Path) -> None:
    assets_dir = dist_dir / "assets"
    assets_dir.mkdir(parents=True)
    (dist_dir / "index.html").write_text(
        "<!doctype html><html><body>TabulaClean React shell</body></html>",
        encoding="utf-8",
    )
    (assets_dir / "app.js").write_text("console.log('TabulaClean')", encoding="utf-8")


def test_fastapi_serves_compiled_spa_root_and_deep_links(tmp_path, monkeypatch) -> None:
    _write_frontend_build(tmp_path)
    monkeypatch.setattr(frontend, "FRONTEND_DIST_DIR", tmp_path)
    client = TestClient(app)

    root = client.get("/", headers={"accept": "text/html"})
    deep_link = client.get("/review-changes", headers={"accept": "text/html"})

    assert root.status_code == 200
    assert deep_link.status_code == 200
    assert "TabulaClean React shell" in root.text
    assert "TabulaClean React shell" in deep_link.text


def test_fastapi_serves_compiled_frontend_assets(tmp_path, monkeypatch) -> None:
    _write_frontend_build(tmp_path)
    monkeypatch.setattr(frontend, "FRONTEND_DIST_DIR", tmp_path)
    response = TestClient(app).get("/assets/app.js")

    assert response.status_code == 200
    assert "TabulaClean" in response.text


def test_frontend_fallback_preserves_backend_errors(tmp_path, monkeypatch) -> None:
    _write_frontend_build(tmp_path)
    monkeypatch.setattr(frontend, "FRONTEND_DIST_DIR", tmp_path)
    client = TestClient(app)

    assert client.get("/api/missing", headers={"accept": "text/html"}).status_code == 404
    assert client.get("/reset", headers={"accept": "text/html"}).status_code == 405
    assert client.get("/health").json() == {"status": "healthy"}


def test_frontend_route_reports_missing_build(tmp_path, monkeypatch) -> None:
    missing_dist = tmp_path / "missing"
    monkeypatch.setattr(frontend, "FRONTEND_DIST_DIR", missing_dist)
    response = TestClient(app).get("/", headers={"accept": "text/html"})

    assert response.status_code == 503
    assert response.json()["detail"] == frontend.MISSING_BUILD_MESSAGE


def test_play_page_loads_workbench_assets() -> None:
    client = TestClient(app)
    response = client.get("/play")
    assert response.status_code == 200
    assert "TabulaClean" in response.text
    assert "Commerce Data Readiness Workbench" not in response.text
    assert "/static/play.css" in response.text
    assert "/static/play.js" in response.text
    assert "Manual Workspace" in response.text
    assert "Automated Run" in response.text


def test_play_config_returns_expected_defaults_and_task_catalog() -> None:
    client = TestClient(app)
    response = client.get("/play/api/config")
    assert response.status_code == 200
    payload = response.json()
    assert payload["default_task_id"] == "easy_contacts_cleanup"
    assert payload["default_mode"] == "manual"
    assert payload["default_runner"] == "deterministic"
    assert payload["shareable_query_keys"] == ["task", "mode", "runner"]
    assert len(payload["tasks"]) == len(TASKS) == 6
    task_ids = {task["task_id"] for task in payload["tasks"]}
    assert task_ids == set(TASKS)
    task_summary = next(task for task in payload["tasks"] if task["task_id"] == "easy_contacts_cleanup")
    assert task_summary["difficulty"] == TASKS["easy_contacts_cleanup"].difficulty
    assert task_summary["domain"] == TASKS["easy_contacts_cleanup"].domain
    assert task_summary["source_system"] == TASKS["easy_contacts_cleanup"].source_system
    assert task_summary["max_steps"] == TASKS["easy_contacts_cleanup"].max_steps


def test_manual_websocket_reset_step_and_state_round_trip() -> None:
    client = TestClient(app)
    with client.websocket_connect("/ws") as websocket:
        websocket.send_json({"type": "reset", "data": {"task_id": "easy_contacts_cleanup"}})
        reset_message = websocket.receive_json()
        assert reset_message["type"] == "observation"
        reset_observation = reset_message["data"]["observation"]
        assert reset_observation["task_id"] == "easy_contacts_cleanup"
        assert reset_observation["steps_taken"] == 0

        websocket.send_json({"type": "state"})
        state_message = websocket.receive_json()
        assert state_message["type"] == "state"
        assert state_message["data"]["task_id"] == "easy_contacts_cleanup"
        assert TASK_SCORE_MIN < state_message["data"]["current_score"] < TASK_SCORE_MAX

        websocket.send_json({"type": "step", "data": {"action_type": "inspect_table", "preview_rows": 3}})
        step_message = websocket.receive_json()
        assert step_message["type"] == "observation"
        step_observation = step_message["data"]["observation"]
        assert step_observation["steps_taken"] == 1
        assert step_observation["last_action"]["action_type"] == "inspect_table"
        assert REWARD_MIN <= step_message["data"]["reward"] < TASK_SCORE_MAX


def test_autorun_stream_emits_start_step_and_end_for_deterministic_runner() -> None:
    client = TestClient(app)
    with client.stream("GET", "/play/api/autorun-stream?task=easy_contacts_cleanup&runner=deterministic") as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        payload = "".join(response.iter_text())

    start_index = payload.find("event: start")
    step_index = payload.find("event: step")
    end_index = payload.find("event: end")
    assert start_index != -1
    assert step_index != -1
    assert end_index != -1
    assert start_index < step_index < end_index
    assert '"runner": "deterministic"' in payload
    assert '"success": true' in payload
    assert '"published": true' in payload


def test_autorun_stream_reports_llm_unavailable_without_hf_token(monkeypatch) -> None:
    monkeypatch.delenv("HF_TOKEN", raising=False)
    monkeypatch.setattr(inference, "HF_TOKEN", None)
    client = TestClient(app)
    with client.stream("GET", "/play/api/autorun-stream?task=easy_contacts_cleanup&runner=llm") as response:
        assert response.status_code == 200
        payload = "".join(response.iter_text())

    assert "event: error" in payload
    assert "event: end" in payload
    assert '"runner": "llm"' in payload
    assert '"success": false' in payload
    assert "HF_TOKEN environment variable is required" in payload


def test_action_model_rejects_invalid_enum_and_extra_fields() -> None:
    try:
        TabularCleaningAction.model_validate({"action_type": "not_real"})
    except Exception:
        pass
    else:  # pragma: no cover
        raise AssertionError("invalid enum should fail")

    try:
        TabularCleaningAction.model_validate({"action_type": "inspect_table", "extra": True})
    except Exception:
        pass
    else:  # pragma: no cover
        raise AssertionError("extra fields should fail")


def test_reset_and_state_for_each_task() -> None:
    env = TabularCleaningEnvironment()
    for task_id, task in TASKS.items():
        observation = env.reset(task_id=task_id)
        assert observation.task_id == task_id
        assert observation.difficulty == task.difficulty
        assert observation.source_system == task.source_system
        assert observation.task_rules["expected_columns"] == list(task.expected_columns)
        assert observation.max_steps == task.max_steps
        assert observation.steps_taken == 0
        assert observation.validation_status == "not_run"
        assert observation.change_set_summary["profiled"] is False
        assert env.state.task_id == task_id
        assert env.state.max_steps == task.max_steps
        assert env.state.source_system == task.source_system
        assert env.state.transformation_log == []


def test_risky_change_requires_approval_before_more_mutations() -> None:
    env = TabularCleaningEnvironment()
    env.reset(task_id="easy_contacts_cleanup")

    profiled = env.step(TabularCleaningAction(action_type=ActionType.PROFILE_TABLE))
    assert profiled.change_set_summary["profiled"] is True

    renamed = env.step(
        TabularCleaningAction(action_type=ActionType.RENAME_COLUMN, column="full_name", new_name="name")
    )
    assert renamed.risky_changes
    change_id = renamed.risky_changes[-1]["change_id"]

    blocked = env.step(TabularCleaningAction(action_type=ActionType.STRIP_WHITESPACE))
    assert blocked.reward == REWARD_MIN
    assert blocked.last_action_error is not None
    assert "Approve or reject" in blocked.last_action_error

    approved = env.step(TabularCleaningAction(action_type=ActionType.APPROVE_CHANGES, change_id=change_id))
    assert approved.risky_changes == []


def test_rule_based_run_produces_validated_export_and_publish_state() -> None:
    env = TabularCleaningEnvironment()
    observation = env.reset(task_id="easy_contacts_cleanup")
    payload = observation.model_dump(exclude_none=True)
    executed = set()
    result = observation
    while True:
        action = inference.fallback_action_from_observation(payload, executed)
        executed.add(inference._action_signature(action))
        result = env.step(action)
        payload = result.model_dump(exclude_none=True)
        if result.done:
            break
    assert result.done is True
    assert env.state.validation_status == "passed"
    assert env.state.export_artifacts
    assert env.state.published is True


def test_rule_based_fallback_reaches_near_perfect_open_interval_score() -> None:
    for task_id in TASKS:
        result = inference.run_task(task_id, client=None, model_name="deterministic-fallback")
        assert result["success"] is True
        assert 0.98 < result["score"] <= OPEN_INTERVAL_MAX


def test_rule_based_fallback_does_not_emit_sort_rows() -> None:
    for task_id in TASKS:
        env = TabularCleaningEnvironment()
        observation = env.reset(task_id=task_id)
        payload = observation.model_dump(exclude_none=True)
        executed = set()
        action_types = []
        while True:
            action = inference.fallback_action_from_observation(payload, executed)
            executed.add(inference._action_signature(action))
            action_types.append(action.action_type)
            result = env.step(action)
            payload = result.model_dump(exclude_none=True)
            if result.done:
                break
        env.close()
        assert ActionType.SORT_ROWS not in action_types


def test_invalid_action_has_minimum_visible_reward() -> None:
    env = TabularCleaningEnvironment()
    env.reset(task_id="easy_contacts_cleanup")
    result = env.step(
        TabularCleaningAction(action_type=ActionType.RENAME_COLUMN, column="missing", new_name="name")
    )
    assert result.reward == REWARD_MIN
    assert result.last_action_error is not None


def test_max_steps_terminates_episode() -> None:
    env = TabularCleaningEnvironment()
    env.reset(task_id="easy_contacts_cleanup")
    result = None
    for _ in range(TASKS["easy_contacts_cleanup"].max_steps):
        result = env.step(TabularCleaningAction(action_type=ActionType.INSPECT_TABLE))
    assert result is not None
    assert result.done is True


def test_schema_reward_is_non_null_number_with_default() -> None:
    client = TestClient(app)
    schema = client.get("/schema").json()
    reward_schema = schema["observation"]["properties"]["reward"]
    assert reward_schema["type"] == "number"
    assert reward_schema["default"] == REWARD_MIN
    assert "anyOf" not in reward_schema


def test_state_endpoint_exposes_score_fields_inside_open_interval() -> None:
    client = TestClient(app)
    client.post("/reset", json={"task_id": "easy_contacts_cleanup"})
    state = client.get("/state").json()
    assert TASK_SCORE_MIN < state["current_score"] < TASK_SCORE_MAX
    assert TASK_SCORE_MIN < state["best_score_so_far"] < TASK_SCORE_MAX


def test_schema_state_includes_score_fields() -> None:
    client = TestClient(app)
    schema = client.get("/schema").json()
    state_properties = schema["state"]["properties"]
    assert "current_score" in state_properties
    assert "best_score_so_far" in state_properties


def test_openapi_step_response_avoids_generic_reward_example() -> None:
    client = TestClient(app)
    openapi = client.get("/openapi.json").json()
    step_content = openapi["paths"]["/step"]["post"]["responses"]["200"]["content"]["application/json"]
    assert "example" not in step_content


def test_public_score_and_reward_surfaces_stay_inside_open_interval() -> None:
    client = TestClient(app)
    seen_score_keys: set[str] = set()
    allowed_score_keys = {"current_score_estimate", "current_score", "best_score_so_far", "score"}

    def audit(node: object, *, path: str = "root") -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                next_path = f"{path}.{key}"
                if "score" in key.lower() or "reward" in key.lower():
                    lower_bound = OPEN_INTERVAL_MIN if "score" in key.lower() else REWARD_MIN
                    if "score" in key.lower():
                        seen_score_keys.add(key)
                    if isinstance(value, list):
                        for index, item in enumerate(value):
                            item_path = f"{next_path}[{index}]"
                            assert isinstance(item, (int, float)), (
                                f"{item_path} should be numeric, got {type(item).__name__}"
                            )
                            assert lower_bound <= float(item) < 1, (
                                f"{item_path} escaped open interval: {item!r}"
                            )
                    else:
                        assert isinstance(value, (int, float)), (
                            f"{next_path} should be numeric, got {type(value).__name__}"
                        )
                        assert lower_bound <= float(value) < 1, f"{next_path} escaped open interval: {value!r}"
                audit(value, path=next_path)
        elif isinstance(node, list):
            for index, value in enumerate(node):
                audit(value, path=f"{path}[{index}]")

    reset = client.post("/reset", json={"task_id": "easy_contacts_cleanup"}).json()
    step = client.post("/step", json={"action": {"action_type": "inspect_table"}}).json()

    env = TabularCleaningEnvironment()
    observation = env.reset(task_id="easy_contacts_cleanup")
    payload = observation.model_dump(exclude_none=True)
    executed = set()
    solved_observation = observation
    while True:
        action = inference.fallback_action_from_observation(payload, executed)
        executed.add(inference._action_signature(action))
        solved_observation = env.step(action)
        payload = solved_observation.model_dump(exclude_none=True)
        if solved_observation.done:
            break
    state_payload = env.state.model_dump()
    inference_result = inference.run_task("easy_contacts_cleanup", client=None, model_name="deterministic-fallback")
    env.close()

    audit(reset)
    audit(step)
    audit(solved_observation.model_dump(exclude_none=True))
    audit(state_payload)
    audit(inference_result)
    assert seen_score_keys <= allowed_score_keys


def test_workflow_actions_do_not_inflate_task_score() -> None:
    env = TabularCleaningEnvironment()
    observation = env.reset(task_id="easy_contacts_cleanup")
    payload = observation.model_dump(exclude_none=True)
    executed = set()
    previous_score = observation.current_score_estimate

    while True:
        action = inference.fallback_action_from_observation(payload, executed)
        executed.add(inference._action_signature(action))
        result = env.step(action)
        if action.action_type in {
            ActionType.RUN_VALIDATIONS,
            ActionType.EXPORT_CLEANED_TABLE,
            ActionType.PUBLISH_TABLE,
        }:
            assert result.current_score_estimate == previous_score
        previous_score = result.current_score_estimate
        payload = result.model_dump(exclude_none=True)
        if result.done:
            break
    assert grade_task(TASKS["easy_contacts_cleanup"], env.state.current_table) == env.state.current_score
    env.close()


def test_all_reset_scores_stay_inside_open_interval() -> None:
    env = TabularCleaningEnvironment()
    for task_id in TASKS:
        observation = env.reset(task_id=task_id)
        assert TASK_SCORE_MIN < observation.current_score_estimate < TASK_SCORE_MAX
    env.close()


def test_export_quality_index_stays_inside_open_interval_for_all_tasks() -> None:
    env = TabularCleaningEnvironment()
    for task_id in TASKS:
        observation = env.reset(task_id=task_id)
        payload = observation.model_dump(exclude_none=True)
        executed = set()
        result = observation
        while True:
            action = inference.fallback_action_from_observation(payload, executed)
            executed.add(inference._action_signature(action))
            result = env.step(action)
            payload = result.model_dump(exclude_none=True)
            if result.done:
                break
        quality_index = env.state.export_artifacts["data_quality_report"]["quality_index"]
        assert TASK_SCORE_MIN < quality_index < TASK_SCORE_MAX
        assert quality_index == env.state.current_score
    env.close()


def test_public_score_fields_avoid_two_decimal_boundary_rounding() -> None:
    env = TabularCleaningEnvironment()
    for task_id in TASKS:
        observation = env.reset(task_id=task_id)
        assert format(observation.current_score_estimate, ".2f") not in {"0.00", "1.00"}
        payload = observation.model_dump(exclude_none=True)
        executed = set()
        result = observation
        while True:
            action = inference.fallback_action_from_observation(payload, executed)
            executed.add(inference._action_signature(action))
            result = env.step(action)
            payload = result.model_dump(exclude_none=True)
            if result.done:
                break
        assert format(env.state.current_score, ".2f") not in {"0.00", "1.00"}
        quality_index = env.state.export_artifacts["data_quality_report"]["quality_index"]
        assert format(quality_index, ".2f") not in {"0.00", "1.00"}
    env.close()
