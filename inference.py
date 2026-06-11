"""Baseline inference runner for the tabular cleaning environment."""

from __future__ import annotations

import json
import os
import warnings
from dataclasses import dataclass
from json import JSONDecodeError
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

warnings.filterwarnings("ignore", message="urllib3 v2 only supports OpenSSL 1.1.1+")

try:
    from openai import (
        APIConnectionError,
        APIStatusError,
        APITimeoutError,
        AuthenticationError,
        BadRequestError,
        InternalServerError,
        NotFoundError,
        OpenAI,
        PermissionDeniedError,
        RateLimitError,
    )
except Exception:  # pragma: no cover - local fallback path
    OpenAI = Any  # type: ignore[misc,assignment]

    class _MissingOpenAIError(Exception):
        pass

    APIConnectionError = _MissingOpenAIError
    APIStatusError = _MissingOpenAIError
    APITimeoutError = _MissingOpenAIError
    AuthenticationError = _MissingOpenAIError
    BadRequestError = _MissingOpenAIError
    InternalServerError = _MissingOpenAIError
    NotFoundError = _MissingOpenAIError
    PermissionDeniedError = _MissingOpenAIError
    RateLimitError = _MissingOpenAIError

from pydantic import ValidationError

from server.environment import TabularCleaningEnvironment
from tabular_cleaning_env.models import ActionType, TabularCleaningAction
from tabular_cleaning_env.utils import stable_json

ENV_NAME = "tabular_cleaning_env"
OPEN_INTERVAL_MIN = 0.01
REWARD_MIN = 0.01
API_BASE_URL = os.getenv("API_BASE_URL", "https://router.huggingface.co/v1")
MODEL_NAME = os.getenv("MODEL_NAME", "meta-llama/Llama-3.3-70B-Instruct")
HF_TOKEN = os.getenv("HF_TOKEN")

# Default field values that add no information to the [STEP] action log.
_ACTION_LOG_DEFAULTS: Dict[str, Any] = {
    "ascending": True,
    "preview_rows": 5,
    "replacements": {},
    "sort_by": [],
    "metadata": {},
}

TASK_ORDER = [
    "easy_contacts_cleanup",
    "medium_orders_cleanup",
    "hard_appointments_cleanup",
    "xgb_churn_easy",
    "lstm_forecast_medium",
    "lightfm_recs_hard",
]


@dataclass
class LLMRuntimeState:
    enabled: bool = True
    disabled_reason: Optional[str] = None
    last_fallback_reason: Optional[str] = None
    fallback_count: int = 0


@dataclass
class TaskRunEvent:
    event: str
    payload: Dict[str, Any]


@dataclass
class TaskRunResult:
    task_id: str
    model_name: str
    runner: str
    success: bool
    steps: int
    score: float
    rewards: List[float]
    error: Optional[str]
    published: bool
    fallback_reason: Optional[str]
    llm_disabled: bool
    llm_disabled_reason: Optional[str]
    llm_fallback_count: int
    final_observation: Dict[str, Any]
    final_state: Dict[str, Any]


def _bool_text(value: bool) -> str:
    return "true" if value else "false"


def _error_text(message: Optional[str]) -> str:
    if message is None:
        return "null"
    sanitized = str(message).replace("\r", " ").replace("\n", " ").strip()
    return " ".join(sanitized.split())


def _action_text(action: TabularCleaningAction) -> str:
    """Return a compact JSON string for the [STEP] log, stripping empty defaults."""
    dump = action.model_dump(exclude_none=True)
    cleaned = {k: v for k, v in dump.items() if v != _ACTION_LOG_DEFAULTS.get(k, object())}
    return stable_json(cleaned)


def _action_signature(action: TabularCleaningAction) -> str:
    """Full dump used for de-duplication; always includes all non-None fields."""
    return stable_json(action.model_dump(exclude_none=True))


def llm_available() -> bool:
    hf_token = os.getenv("HF_TOKEN", HF_TOKEN or "").strip()
    return bool(hf_token) and OpenAI is not Any


def llm_status() -> Dict[str, Any]:
    hf_token = os.getenv("HF_TOKEN", HF_TOKEN or "").strip()
    if not hf_token:
        return {"available": False, "reason": "HF_TOKEN environment variable is required"}
    if OpenAI is Any:
        return {"available": False, "reason": "openai package is unavailable"}
    return {"available": True, "reason": None}


def build_openai_client() -> Tuple[Optional[OpenAI], str]:
    """Build the OpenAI-compatible client required by the submission contract."""
    base_url = os.getenv("API_BASE_URL", API_BASE_URL).strip()
    model_name = os.getenv("MODEL_NAME", MODEL_NAME).strip()
    hf_token = os.getenv("HF_TOKEN", HF_TOKEN or "")
    if not hf_token.strip():
        raise ValueError("HF_TOKEN environment variable is required")
    if OpenAI is Any:
        raise RuntimeError("openai package is required to run inference.py")
    return OpenAI(
        base_url=base_url,
        api_key=hf_token.strip(),
        timeout=10.0,
        max_retries=0,
    ), model_name


def llm_action(
    client: OpenAI,
    model_name: str,
    task_id: str,
    observation: Dict[str, Any],
) -> TabularCleaningAction:
    prompt = (
        "You are operating a human-in-the-loop tabular cleanup workbench.\n"
        "Return exactly one JSON object and no extra text.\n"
        "Use this schema:\n"
        '{"action_type":"...", "column":"...", "new_name":"...", "case_mode":"...", '
        '"replacements":{"old":"new"}, "fill_value":"...", "dtype":"...", '
        '"sort_by":["..."], "ascending":true, "preview_rows":5, '
        '"change_id":"...", "destination":"..."}\n'
        "Available workflow actions include profile_table, approve_changes, run_validations, "
        "export_cleaned_table, and publish_table.\n"
        "Omit fields you do not use. Prefer structured, safe actions.\n"
        f"Task: {task_id}\n"
        f"Observation: {json.dumps(observation, ensure_ascii=True)}"
    )
    response = client.chat.completions.create(
        model=model_name,
        temperature=0,
        max_completion_tokens=120,
        messages=[
            {"role": "system", "content": "Return only valid JSON for the next action."},
            {"role": "user", "content": prompt},
        ],
    )
    content = response.choices[0].message.content or "{}"
    return TabularCleaningAction.model_validate(json.loads(content))


def fallback_action_from_observation(
    observation: Dict[str, Any],
    executed_actions: Set[str],
) -> TabularCleaningAction:
    rules = observation.get("task_rules", {})
    columns = set(observation.get("table_columns", []))
    issues = observation.get("issues_summary", [])
    issues_text = " ".join(issues).lower()
    change_set = observation.get("change_set_summary", {})
    risky_changes = observation.get("risky_changes") or observation.get("proposed_changes_summary") or []
    validation_status = observation.get("validation_status", "not_run")
    profiled = bool(change_set.get("profiled"))
    has_export_artifact = bool(change_set.get("has_export_artifact"))
    published = bool(change_set.get("published"))

    cleaning_issue_prefixes = (
        "Schema does not match",
        "Whitespace cleanup",
        "Value normalization",
        "Date normalization",
        "Required fields",
        "Duplicate business keys",
    )

    def has_cleaning_issues() -> bool:
        return any(
            str(issue).startswith(prefix)
            for issue in issues
            for prefix in cleaning_issue_prefixes
        )

    def choose(action: TabularCleaningAction, condition: bool = True) -> Optional[TabularCleaningAction]:
        if not condition:
            return None
        signature = _action_signature(action)
        if signature in executed_actions:
            return None
        return action

    action = choose(
        TabularCleaningAction(action_type=ActionType.PROFILE_TABLE),
        condition=not profiled,
    )
    if action is not None:
        return action

    if risky_changes:
        latest_change = risky_changes[-1]
        action = choose(
            TabularCleaningAction(
                action_type=ActionType.APPROVE_CHANGES,
                change_id=latest_change.get("change_id"),
            )
        )
        if action is not None:
            return action

    for source, target in rules.get("rename_map", {}).items():
        action = choose(
            TabularCleaningAction(
                action_type=ActionType.RENAME_COLUMN,
                column=source,
                new_name=target,
            ),
            condition=(
                source in columns
                and target not in columns
                and "schema does not match the expected cleaned table columns" in issues_text
            ),
        )
        if action is not None:
            return action

    action = choose(
        TabularCleaningAction(action_type=ActionType.STRIP_WHITESPACE),
        condition="whitespace cleanup is still needed" in issues_text,
    )
    if action is not None:
        return action

    for column, case_mode in rules.get("case_columns", {}).items():
        action = choose(
            TabularCleaningAction(
                action_type=ActionType.NORMALIZE_CASE,
                column=column,
                case_mode=case_mode,
            ),
            condition=column in columns,
        )
        if action is not None:
            return action

    for column, replacements in rules.get("normalization_hints", {}).items():
        action = choose(
            TabularCleaningAction(
                action_type=ActionType.REPLACE_VALUES,
                column=column,
                replacements=replacements,
            ),
            condition=column in columns,
        )
        if action is not None:
            return action

    action = choose(
        TabularCleaningAction(action_type=ActionType.STANDARDIZE_DATE),
        condition=bool(rules.get("date_columns")) and any(column in columns for column in rules.get("date_columns", {})),
    )
    if action is not None:
        return action

    fill_defaults = rules.get("fill_defaults", {})
    shared_fill_values = {value for value in fill_defaults.values() if value is not None}
    if len(shared_fill_values) == 1 and len(fill_defaults) > 1:
        action = choose(
            TabularCleaningAction(
                action_type=ActionType.FILL_MISSING,
                fill_value=next(iter(shared_fill_values)),
            ),
            condition=bool(fill_defaults) and "required fields are still missing" in issues_text,
        )
        if action is not None:
            return action

    for column, fill_value in rules.get("fill_defaults", {}).items():
        action = choose(
            TabularCleaningAction(
                action_type=ActionType.FILL_MISSING,
                column=column,
                fill_value=fill_value,
            ),
            condition=column in columns and "required fields are still missing" in issues_text,
        )
        if action is not None:
            return action

    for column in rules.get("fill_forward_columns", []):
        action = choose(
            TabularCleaningAction(
                action_type=ActionType.FILL_FORWARD,
                column=column,
            ),
            condition=column in columns and "required fields are still missing" in issues_text,
        )
        if action is not None:
            return action

    for column, dtype in rules.get("cast_columns", {}).items():
        action = choose(
            TabularCleaningAction(
                action_type=ActionType.CAST_DTYPE,
                column=column,
                dtype=dtype,
            ),
            condition=column in columns,
        )
        if action is not None:
            return action

    action = choose(
        TabularCleaningAction(action_type=ActionType.DROP_DUPLICATES),
        condition=rules.get("duplicate_rule") is not None and "duplicate business keys still need to be resolved" in issues_text,
    )
    if action is not None:
        return action

    if not has_cleaning_issues():
        action = choose(
            TabularCleaningAction(action_type=ActionType.RUN_VALIDATIONS),
            condition=validation_status != "passed",
        )
        if action is not None:
            return action

        action = choose(
            TabularCleaningAction(
                action_type=ActionType.EXPORT_CLEANED_TABLE,
                destination=rules.get("default_export_destination"),
            ),
            condition=validation_status == "passed" and not has_export_artifact,
        )
        if action is not None:
            return action

        action = choose(
            TabularCleaningAction(action_type=ActionType.PUBLISH_TABLE),
            condition=validation_status == "passed" and has_export_artifact and not published,
        )
        if action is not None:
            return action

    return TabularCleaningAction(action_type=ActionType.SUBMIT)


def classify_llm_exception(exc: Exception) -> Tuple[str, bool]:
    if isinstance(exc, (JSONDecodeError, ValidationError)):
        return "llm_output_invalid", False
    fatal_types = (
        TimeoutError,
        ConnectionError,
        OSError,
        APIConnectionError,
        APITimeoutError,
        AuthenticationError,
        PermissionDeniedError,
        RateLimitError,
        InternalServerError,
        APIStatusError,
        BadRequestError,
        NotFoundError,
    )
    if isinstance(exc, fatal_types):
        return "llm_transport_error", True
    return "llm_runtime_error", True


def _snapshot_state(env: Any) -> Dict[str, Any]:
    try:
        state = env.state
    except Exception:
        return {}
    if hasattr(state, "model_dump"):
        return dict(state.model_dump())
    if isinstance(state, dict):
        return dict(state)
    return {}


def _emit_event(
    event_callback: Optional[Callable[[TaskRunEvent], None]],
    event: str,
    payload: Dict[str, Any],
) -> None:
    if event_callback is None:
        return None
    try:
        event_callback(TaskRunEvent(event=event, payload=payload))
    except Exception:
        return None
    return None


def execute_task_run(
    task_id: str,
    client: Optional[OpenAI],
    model_name: str,
    env_factory: Callable[[], TabularCleaningEnvironment] = TabularCleaningEnvironment,
    llm_state: Optional[LLMRuntimeState] = None,
    event_callback: Optional[Callable[[TaskRunEvent], None]] = None,
    runner: str = "deterministic",
) -> TaskRunResult:
    env = env_factory()
    rewards: List[float] = []
    score = OPEN_INTERVAL_MIN
    step_count = 0
    success = False
    published = False
    last_error: Optional[str] = None
    final_observation: Dict[str, Any] = {}
    final_state: Dict[str, Any] = {}
    executed_actions: Set[str] = set()
    runtime_state = llm_state or LLMRuntimeState(enabled=client is not None)
    if client is None and runtime_state.enabled:
        runtime_state.enabled = False
        runtime_state.disabled_reason = runtime_state.disabled_reason or "llm_client_unavailable"

    try:
        reset_obs = env.reset(task_id=task_id)
        final_observation = reset_obs.model_dump(exclude_none=True)
        final_state = _snapshot_state(env)
        score = final_observation.get("current_score_estimate", score)
        _emit_event(
            event_callback,
            "start",
            {
                "task_id": task_id,
                "env": ENV_NAME,
                "model": model_name,
                "runner": runner,
                "observation": final_observation,
                "state": final_state,
                "raw_table": list(final_state.get("current_table", [])),
            },
        )

        observation = final_observation
        while True:
            if client is not None and runtime_state.enabled:
                try:
                    action = llm_action(client, model_name, task_id, observation)
                except Exception as exc:
                    reason, disable_future = classify_llm_exception(exc)
                    runtime_state.last_fallback_reason = reason
                    runtime_state.fallback_count += 1
                    if disable_future:
                        runtime_state.enabled = False
                        runtime_state.disabled_reason = reason
                    action = fallback_action_from_observation(observation, executed_actions)
            else:
                action = fallback_action_from_observation(observation, executed_actions)

            result = env.step(action)
            executed_actions.add(_action_signature(action))
            step_count += 1
            reward = float(result.reward) if result.reward is not None else REWARD_MIN
            rewards.append(reward)
            last_error = result.last_action_error
            score = result.current_score_estimate
            done = bool(result.done)
            final_observation = result.model_dump(exclude_none=True)
            final_state = _snapshot_state(env)
            published = bool(result.change_set_summary.get("published"))
            _emit_event(
                event_callback,
                "step",
                {
                    "step": step_count,
                    "action": action.model_dump(exclude_none=True),
                    "action_text": _action_text(action),
                    "reward": reward,
                    "done": done,
                    "error": _error_text(last_error),
                    "observation": final_observation,
                    "state": final_state,
                },
            )
            observation = final_observation
            if done:
                success = published
                break
    except Exception as exc:
        last_error = _error_text(str(exc))
        _emit_event(
            event_callback,
            "error",
            {
                "task_id": task_id,
                "env": ENV_NAME,
                "model": model_name,
                "runner": runner,
                "message": last_error,
                "steps": step_count,
                "observation": final_observation,
                "state": final_state,
            },
        )
    finally:
        try:
            env.close()
        except Exception:
            pass

    result = TaskRunResult(
        task_id=task_id,
        model_name=model_name,
        runner=runner,
        success=success,
        steps=step_count,
        score=score,
        rewards=rewards,
        error=last_error,
        published=published,
        fallback_reason=runtime_state.last_fallback_reason,
        llm_disabled=not runtime_state.enabled,
        llm_disabled_reason=runtime_state.disabled_reason,
        llm_fallback_count=runtime_state.fallback_count,
        final_observation=final_observation,
        final_state=final_state,
    )
    _emit_event(
        event_callback,
        "end",
        {
            "task_id": task_id,
            "env": ENV_NAME,
            "model": model_name,
            "runner": runner,
            "success": success,
            "steps": step_count,
            "score": score,
            "rewards": list(rewards),
            "error": _error_text(last_error),
            "published": published,
            "final_observation": final_observation,
            "final_state": final_state,
            "fallback_reason": runtime_state.last_fallback_reason,
            "llm_disabled": not runtime_state.enabled,
            "llm_disabled_reason": runtime_state.disabled_reason,
            "llm_fallback_count": runtime_state.fallback_count,
        },
    )
    return result


def run_task(
    task_id: str,
    client: Optional[OpenAI],
    model_name: str,
    env_factory: Callable[[], TabularCleaningEnvironment] = TabularCleaningEnvironment,
    llm_state: Optional[LLMRuntimeState] = None,
) -> Dict[str, Any]:
    print(f"[START] task={task_id} env={ENV_NAME} model={model_name}", flush=True)

    def print_step(event: TaskRunEvent) -> None:
        if event.event != "step":
            return None
        payload = event.payload
        print(
            f"[STEP] step={payload['step']} action={payload['action_text']} reward={payload['reward']:.2f} "
            f"done={_bool_text(bool(payload['done']))} error={payload['error']}",
            flush=True,
        )
        return None

    runner = "llm" if client is not None else "deterministic"
    result = execute_task_run(
        task_id=task_id,
        client=client,
        model_name=model_name,
        env_factory=env_factory,
        llm_state=llm_state,
        event_callback=print_step,
        runner=runner,
    )
    rewards_text = ",".join(f"{reward:.2f}" for reward in result.rewards)
    print(
        f"[END] success={_bool_text(result.success)} steps={result.steps} rewards={rewards_text}",
        flush=True,
    )
    return {
        "task_id": result.task_id,
        "success": result.success,
        "steps": result.steps,
        "score": result.score,
        "rewards": result.rewards,
        "error": result.error,
        "published": result.published,
        "final_observation": result.final_observation,
        "final_state": result.final_state,
        "fallback_reason": result.fallback_reason,
        "llm_disabled": result.llm_disabled,
        "llm_disabled_reason": result.llm_disabled_reason,
        "llm_fallback_count": result.llm_fallback_count,
    }


def main() -> List[Dict[str, Any]]:
    client, model_name = build_openai_client()
    llm_state = LLMRuntimeState(enabled=True)
    return [run_task(task_id, client, model_name, llm_state=llm_state) for task_id in TASK_ORDER]


if __name__ == "__main__":
    main()
