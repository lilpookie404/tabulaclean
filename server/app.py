"""FastAPI app entrypoint for the tabular cleaning environment."""

from __future__ import annotations

import json
import os
from pathlib import Path
from queue import Queue
from threading import Thread
from typing import Any, Dict

import inference
from fastapi import Query
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from tabular_cleaning_env.models import TabularCleaningAction, TabularCleaningObservation
from tabular_cleaning_env.openenv_compat import create_app
from tabular_cleaning_env.tasks import TASKS

from .environment import TabularCleaningEnvironment
from .frontend import install_frontend
from .uploads.errors import UploadError
from .uploads.router import router as upload_router
from .uploads.router import upload_error_handler

BASE_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"
DEFAULT_TASK_ID = "easy_contacts_cleanup"
DEFAULT_MODE = "manual"
DEFAULT_RUNNER = "deterministic"
RUNNER_OPTIONS = {"deterministic", "llm"}

app = create_app(
    TabularCleaningEnvironment,
    TabularCleaningAction,
    TabularCleaningObservation,
    env_name="tabular_cleaning_env",
)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.add_exception_handler(UploadError, upload_error_handler)
app.include_router(upload_router)


def _task_summary(task_id: str) -> Dict[str, Any]:
    task = TASKS[task_id]
    return {
        "task_id": task.task_id,
        "difficulty": task.difficulty,
        "domain": task.domain,
        "source_system": task.source_system,
        "description": task.description,
        "max_steps": task.max_steps,
    }


def _sanitize_task_id(task_id: str | None) -> str:
    if task_id in TASKS:
        return str(task_id)
    return DEFAULT_TASK_ID


def _sanitize_runner(runner: str | None) -> str:
    if runner in RUNNER_OPTIONS:
        return str(runner)
    return DEFAULT_RUNNER


def _sse_event(name: str, payload: Dict[str, Any]) -> str:
    return f"event: {name}\ndata: {json.dumps(payload, ensure_ascii=True)}\n\n"


@app.get("/play", include_in_schema=False)
def play() -> FileResponse:
    return FileResponse(TEMPLATES_DIR / "play.html")


@app.get("/play/api/config")
def play_config() -> Dict[str, Any]:
    llm_meta = inference.llm_status()
    return {
        "tasks": [_task_summary(task_id) for task_id in TASKS],
        "default_task_id": DEFAULT_TASK_ID,
        "default_mode": DEFAULT_MODE,
        "default_runner": DEFAULT_RUNNER,
        "llm_available": bool(llm_meta["available"]),
        "llm_reason": llm_meta["reason"],
        "llm_model_name": os.getenv("MODEL_NAME", inference.MODEL_NAME).strip() or inference.MODEL_NAME,
        "shareable_query_keys": ["task", "mode", "runner"],
    }


@app.get("/play/api/autorun-stream")
def autorun_stream(
    task: str = Query(DEFAULT_TASK_ID),
    runner: str = Query(DEFAULT_RUNNER),
) -> StreamingResponse:
    task_id = _sanitize_task_id(task)
    runner_name = _sanitize_runner(runner)

    def stream_events() -> Any:
        if runner_name == "llm":
            llm_meta = inference.llm_status()
            if not llm_meta["available"]:
                message = str(llm_meta["reason"] or "LLM mode is unavailable")
                yield _sse_event(
                    "error",
                    {
                        "task_id": task_id,
                        "env": inference.ENV_NAME,
                        "model": os.getenv("MODEL_NAME", inference.MODEL_NAME).strip() or inference.MODEL_NAME,
                        "runner": runner_name,
                        "message": message,
                        "steps": 0,
                        "observation": {},
                        "state": {},
                    },
                )
                yield _sse_event(
                    "end",
                    {
                        "task_id": task_id,
                        "env": inference.ENV_NAME,
                        "model": os.getenv("MODEL_NAME", inference.MODEL_NAME).strip() or inference.MODEL_NAME,
                        "runner": runner_name,
                        "success": False,
                        "steps": 0,
                        "score": inference.OPEN_INTERVAL_MIN,
                        "rewards": [],
                        "error": message,
                        "published": False,
                        "final_observation": {},
                        "final_state": {},
                        "fallback_reason": None,
                        "llm_disabled": True,
                        "llm_disabled_reason": message,
                        "llm_fallback_count": 0,
                    },
                )
                return
            try:
                client, model_name = inference.build_openai_client()
            except Exception as exc:
                message = inference._error_text(str(exc))
                yield _sse_event(
                    "error",
                    {
                        "task_id": task_id,
                        "env": inference.ENV_NAME,
                        "model": os.getenv("MODEL_NAME", inference.MODEL_NAME).strip() or inference.MODEL_NAME,
                        "runner": runner_name,
                        "message": message,
                        "steps": 0,
                        "observation": {},
                        "state": {},
                    },
                )
                yield _sse_event(
                    "end",
                    {
                        "task_id": task_id,
                        "env": inference.ENV_NAME,
                        "model": os.getenv("MODEL_NAME", inference.MODEL_NAME).strip() or inference.MODEL_NAME,
                        "runner": runner_name,
                        "success": False,
                        "steps": 0,
                        "score": inference.OPEN_INTERVAL_MIN,
                        "rewards": [],
                        "error": message,
                        "published": False,
                        "final_observation": {},
                        "final_state": {},
                        "fallback_reason": None,
                        "llm_disabled": True,
                        "llm_disabled_reason": message,
                        "llm_fallback_count": 0,
                    },
                )
                return
            llm_state = inference.LLMRuntimeState(enabled=True)
        else:
            client = None
            model_name = os.getenv("MODEL_NAME", inference.MODEL_NAME).strip() or inference.MODEL_NAME
            llm_state = inference.LLMRuntimeState(enabled=False, disabled_reason="deterministic_runner_selected")

        event_queue: Queue[inference.TaskRunEvent | None] = Queue()

        def emit(event: inference.TaskRunEvent) -> None:
            event_queue.put(event)

        def worker() -> None:
            try:
                inference.execute_task_run(
                    task_id=task_id,
                    client=client,
                    model_name=model_name,
                    llm_state=llm_state,
                    event_callback=emit,
                    runner=runner_name,
                )
            finally:
                event_queue.put(None)

        thread = Thread(target=worker, daemon=True)
        thread.start()

        while True:
            event = event_queue.get()
            if event is None:
                break
            yield _sse_event(event.event, event.payload)

    return StreamingResponse(
        stream_events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


install_frontend(app)


def main(host: str = "0.0.0.0", port: int = 8000) -> None:
    import uvicorn

    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
