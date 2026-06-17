---
title: TabulaClean
emoji: "📦"
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 8000
---

# TabulaClean

TabulaClean is an AI-assisted spreadsheet cleaning assistant for people who
need reliable CSV and Excel cleanup without writing code.

The product direction is a guided workflow where users upload a spreadsheet,
preview data issues, review suggested fixes, approve risky changes, validate
the cleaned data, and download a trustworthy result.

This repository now provides the React product shell, temporary CSV/XLSX
upload sessions, table previews, basic quality checks, CSV download, the
guided manual cleaning workflow, risk-based review, undo/reset history, the
cleaning engine, uploaded-file validation, validation ZIP exports, and the
advanced evaluation suite. AI-assisted suggestions remain a later product
phase.

## Project Direction

TabulaClean is being developed as an AI-assisted spreadsheet cleaning
assistant for non-technical users.

The bundled benchmark tasks remain available as an advanced evaluation layer
for testing cleaning actions, model behavior, review gates, and deterministic
grading. They are not the primary user experience.

Benchmark tasks can compare a cleaned table with bundled ground truth. Real
uploaded files will not usually have a known correct answer, so they will use
quality checks such as schema validation, missing-value reduction, duplicate
detection, consistent formats, and approval of risky changes instead of
ground-truth scoring.

See [docs/PROJECT_DIRECTION.md](docs/PROJECT_DIRECTION.md) for the concise
product and architecture boundary.

## What Problem It Solves

People routinely receive broken exports and spreadsheets from business tools:

- columns are renamed or inconsistent
- dates use mixed formats
- labels drift over time
- required fields are missing
- duplicates appear after manual merges or sync bugs

This work is often done manually, with little auditability and a high risk of
silently damaging data. TabulaClean is designed to make cleanup understandable,
reviewable, and safer for everyday spreadsheet users.

## Product Workflow

The cleaning workflow is:

1. load and preview spreadsheet data
2. identify quality issues
3. review structured cleanup suggestions
4. approve or reject risky changes
5. run validation checks
6. export a cleaned result with an audit trail

The current product workspace implements upload, preview, basic issue
detection, guided deterministic fixes, approval of risky changes, undo/reset,
and CSV download of the current approved table. The advanced workbench
continues to exercise the governed cleaning workflow with bundled evaluation
tasks.

## Upload Sessions

The product API supports temporary, process-local spreadsheet sessions:

- `POST /api/uploads` accepts one `.csv` or `.xlsx` file.
- `GET /api/sessions/{session_id}` restores the current session snapshot.
- `POST /api/sessions/{session_id}/change-previews` previews a typed cleaning
  action without changing the table.
- `POST /api/sessions/{session_id}/changes` applies a low-risk action or queues
  a risky action for review.
- `POST /api/sessions/{session_id}/changes/{change_id}/approve` and `/reject`
  resolve the single pending risky change.
- `POST /api/sessions/{session_id}/undo` removes the latest approved action.
- `POST /api/sessions/{session_id}/reset` restores the uploaded table.
- `POST /api/sessions/{session_id}/validations` runs revisioned validation
  with optional required columns.
- `GET /api/sessions/{session_id}/download` downloads the current approved
  table as UTF-8 BOM CSV.
- `GET /api/sessions/{session_id}/validated-export` downloads a validation ZIP
  after validation has run for the current table.

Uploads are limited to 10 MB, 100,000 rows, and 200 columns. Sessions expire
after 30 minutes of inactivity and are removed when the application restarts.
Only the active session ID is stored in browser `sessionStorage`; spreadsheet
contents are not persisted to disk.

Phase 2 detects grouped findings for missing values, duplicate rows, padded
values, problematic column names, numeric-looking text, empty columns, and
inconsistent date formats.

Phase 3 connects those findings to deterministic manual fixes:

- trim leading and trailing whitespace
- rename problematic column headers
- fill missing values with an explicit value, mean, median, or most-common value
- remove exact duplicate rows
- convert numeric-looking text to integer or decimal values
- remove completely empty columns
- standardize dates with an explicit date order and output format

Every action is previewed. Whitespace trimming can apply immediately; all other
actions wait in Review Changes for explicit approval. Only one risky change can
wait at a time. Sessions keep up to 100 active actions and the latest 200 audit
events. Downloads include approved changes only and remain intentionally
unvalidated until Phase 4 validation runs.

Phase 4 adds formal uploaded-file validation without using benchmark ground
truth. Users can mark required columns, run validation in the workspace, and
see pass/fail checks plus warnings. Validation fails only when a risky change
is still pending or required cells are blank. Normal CSV download remains
available with clear status copy; after any validation run, the validation ZIP
contains `cleaned.csv`, `validation-report.json`, and `audit-log.json`.

TabulaClean warns when text beginning with `=`, `+`, `-`, or `@` could be
interpreted as a formula by spreadsheet software. It does not silently rewrite
those values.

## Design Goals

- Make spreadsheet issues understandable to non-technical users.
- Keep suggested changes structured, typed, and reviewable.
- Require approval before risky changes can be published.
- Produce validation results and an auditable transformation history.
- Preserve deterministic benchmark grading for internal evaluation.

## Advanced Evaluation API

The internal evaluation environment exposes a stable reset/step/state shape:

- `reset(task_id=...)` returns the initial observation
- `step(action)` returns the next observation with `reward`, `done`, and `metadata`
- `state()` returns the full serializable internal state

Core implementation files:

- [inference.py](inference.py)
- [server/environment.py](server/environment.py)
- [server/app.py](server/app.py)
- [tabular_cleaning_env/models.py](tabular_cleaning_env/models.py)
- [tabular_cleaning_env/tasks.py](tabular_cleaning_env/tasks.py)
- [tabular_cleaning_env/graders.py](tabular_cleaning_env/graders.py)

## Bundled Tasks

The benchmark ships 6 bundled tasks across two coherent tracks.

| Task | Difficulty | Source System | Rows | What the agent must do |
|---|---|---|---|---|
| `easy_contacts_cleanup` | Easy | CRM customer contacts export | `18` raw / `18` gold | Fix schema drift, normalize names/emails/customer segments, standardize signup dates, fill missing phones, validate, export, publish |
| `medium_orders_cleanup` | Medium | E-commerce orders export | `20` raw / `16` gold | Normalize statuses and dates, cast amounts, fill missing location fields, remove true duplicates, validate, export, publish |
| `hard_appointments_cleanup` | Hard | Field-service scheduling export | `20` raw / `16` gold | Normalize technician and service-line labels, standardize timestamps, fill missing values, resolve duplicate conflicts deterministically, validate, export, publish |
| `xgb_churn_easy` | Easy | CRM RFM feature export | `10` raw / `10` gold | Normalize segments, standardize purchase dates, fill missing frequency values, cast monetary features, validate, export, publish |
| `lstm_forecast_medium` | Medium | Product sales time-series export | `10` raw / `10` gold | Standardize dates, forward-fill missing quantities, normalize categories, validate, export, publish |
| `lightfm_recs_hard` | Hard | Recommendation interaction export | `10` raw / `10` gold | Normalize user IDs and categories, standardize timestamps, fill missing ratings, cast interaction strengths, validate, export, publish |

Step budgets:

- Easy: `13`
- Medium: `15`
- Hard: `15`

## Sample Data

All bundled task data now uses a task-oriented folder structure under [tasks](tasks).
Each task ships with:

- `raw.csv`
- `ground_truth.csv`
- `metadata.json`

Task folders:

- [easy_contacts_cleanup](tasks/easy_contacts_cleanup)
- [medium_orders_cleanup](tasks/medium_orders_cleanup)
- [hard_appointments_cleanup](tasks/hard_appointments_cleanup)
- [xgb_churn_easy](tasks/xgb_churn_easy)
- [lstm_forecast_medium](tasks/lstm_forecast_medium)
- [lightfm_recs_hard](tasks/lightfm_recs_hard)

Example dataset files:

- CRM contacts raw export: [tasks/easy_contacts_cleanup/raw.csv](tasks/easy_contacts_cleanup/raw.csv)
- CRM contacts cleaned reference: [tasks/easy_contacts_cleanup/ground_truth.csv](tasks/easy_contacts_cleanup/ground_truth.csv)
- Orders raw export: [tasks/medium_orders_cleanup/raw.csv](tasks/medium_orders_cleanup/raw.csv)
- Orders cleaned reference: [tasks/medium_orders_cleanup/ground_truth.csv](tasks/medium_orders_cleanup/ground_truth.csv)
- Service scheduling raw export: [tasks/hard_appointments_cleanup/raw.csv](tasks/hard_appointments_cleanup/raw.csv)
- Service scheduling cleaned reference: [tasks/hard_appointments_cleanup/ground_truth.csv](tasks/hard_appointments_cleanup/ground_truth.csv)
- Churn features raw export: [tasks/xgb_churn_easy/raw.csv](tasks/xgb_churn_easy/raw.csv)
- Forecasting raw export: [tasks/lstm_forecast_medium/raw.csv](tasks/lstm_forecast_medium/raw.csv)
- Recommendation interactions raw export: [tasks/lightfm_recs_hard/raw.csv](tasks/lightfm_recs_hard/raw.csv)

Current dataset sizes:

- contacts task: `18` raw rows and `18` gold rows
- orders task: `20` raw rows and `16` gold rows
- service scheduling task: `20` raw rows and `16` gold rows
- churn modeling task: `10` raw rows and `10` gold rows
- forecasting task: `10` raw rows and `10` gold rows
- recommendation task: `10` raw rows and `10` gold rows

Example dataset preview:

### CRM Contacts (`raw.csv`)

```csv
customer_id,full_name,email,customer_segment,signup_date,phone
C001," alice johnson ","ALICE.JOHNSON@EXAMPLE.COM "," vip ",2024/01/15," 555-0101 "
```

### Orders Export (`raw.csv`)

```csv
order_id,customer_name,status,amount,order_date,city,state
ORD-1001,Ava Patel," shipped ","$120.50",2024/03/01," Seattle ",WA
```

### Service Scheduling (`raw.csv`)

```csv
appointment_id,customer_name,service_line,technician,appointment_time,status,notes,updated_at
APT-001,"maya singh "," delivery ",alex cole,"2024/04/10 09:30",confirmed," gate code confirmed ","2024/04/01 08:00"
```

These are curated bundled datasets on purpose: they are large enough to feel like real cleanup work, still deterministic to grade, and still light enough to validate quickly in Docker or on Hugging Face Spaces.

The six tasks stay coherent because they all use the same governed workflow: profile the export, apply typed cleanup actions, review risky changes, validate, export, and publish. The difference is only the downstream destination of the cleaned data.

## Action Space

The action space is typed and intentionally narrow.

Workflow actions:

- `profile_table`
- `view_change_set`
- `run_validations`
- `approve_changes`
- `reject_change`
- `export_cleaned_table`
- `publish_table`

Inspection and cleanup actions:

- `inspect_table`
- `inspect_column`
- `rename_column`
- `strip_whitespace`
- `normalize_case`
- `replace_values`
- `standardize_date`
- `fill_missing`
- `fill_forward`
- `cast_dtype`
- `drop_duplicates`
- `sort_rows`
- `submit`

Supported action fields include:

- `column`
- `new_name`
- `case_mode`
- `replacements`
- `fill_value`
- `dtype`
- `sort_by`
- `ascending`
- `preview_rows`
- `change_id`
- `destination`

## Observation and State

Each observation contains the information an agent needs to act generically:

- task metadata such as `task_id`, `difficulty`, `source_system`, and `task_description`
- table context such as `table_columns`, `table_rows_preview`, `row_count`, and `issues_summary`
- workflow state such as `change_set_summary`, `risky_changes`, `validation_status`, and `export_ready`
- trajectory state such as `last_action`, `last_action_error`, `steps_taken`, and `current_score_estimate`
- `task_rules`, which define the cleaning contract for the current source-system export

The serialized state also tracks:

- current working table
- proposed, approved, and rejected changes
- validation results
- export artifacts
- append-only transformation log

## Rule Packs

Each task exposes a rule pack through `task_rules`, including:

- expected schema
- required columns
- primary key
- date columns
- normalization hints
- fill defaults
- dtype casts
- case normalization targets
- duplicate-resolution rules
- validation checks
- safe vs risky action types
- default export destination

This lets the baseline and any external agent behave generically instead of branching on task name.

## Deterministic Grading

Each task has a bundled reference table and one deterministic scalar grader that emits a task score strictly inside `(0, 1)`.

Grading behavior:

- the official task score comes only from the current cleaned table versus the bundled reference table
- grading aligns the configured output columns, optionally sorts rows by task metadata, and compares cells directly
- numeric grading columns use a small tolerance so formatted numeric outputs can still match exactly intended values
- workflow steps such as validation, export, and publish do not inflate the official task score

## Reward Design

Rewards are shaped but bounded:

- `reward = max(min_visible_reward, current_score - best_score_so_far_before_action)`
- invalid, destructive, or no-op actions emit the minimum visible reward floor instead of `0`
- risky actions may improve score immediately, but they still must be approved before validation/export/publish
- the episode ends when the table is published or when `max_steps` is reached

This produces dense learning signal without unstable negative rewards.

## Baseline Inference

The project includes a root [inference.py](inference.py) that:

- uses the `OpenAI` client for LLM calls
- reads `API_BASE_URL`, `MODEL_NAME`, and `HF_TOKEN`
- requires `HF_TOKEN` with no default
- falls back to a deterministic rule-based planner if the LLM path fails
- emits the exact required parser-safe stdout format

The fallback planner follows the same governed workflow as the environment:

1. `profile_table`
2. apply the next cleanup step
3. `approve_changes` whenever a risky mutation is pending
4. `run_validations`
5. `export_cleaned_table`
6. `publish_table`

Reproducible baseline scores:

- `easy_contacts_cleanup`: `0.99`
- `medium_orders_cleanup`: `0.99`
- `hard_appointments_cleanup`: `0.99`

### Required Inference Log Format

```text
[START] task=<task_name> env=tabular_cleaning_env model=<model_name>
[STEP] step=<n> action=<action_str> reward=<reward_value> done=<true|false> error=<msg|null>
[END] success=<true|false> steps=<n> rewards=<r1,r2,...,rn>
```

## Quick Start

### Backend only

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements-dev.txt
python3 -m pytest -q
uvicorn server.app:app --host 0.0.0.0 --port 8000
```

Backend-only mode keeps `/health`, `/play`, the evaluation APIs, and all
compatibility routes available. Product frontend routes return an explicit
missing-build response until the React application is built.

### Frontend development

Run FastAPI on port `8000`, then start Vite in a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. Vite proxies backend and legacy-workbench routes
to `http://localhost:8000`.

### Production frontend build

```bash
cd frontend
npm ci
npm run build
cd ..
uvicorn server.app:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000`. FastAPI serves the compiled React application and
keeps `/play` available as the advanced evaluation workspace.

## Phase 4 Boundary

Phase 3 adds guided deterministic cleaning, change previews, approval for risky
changes, activity history, undo, reset, and download of the current approved
table.

Phase 4 adds uploaded-file validation, required-column checks, validation
warnings, and a validation ZIP for the current temporary session. It does not
add AI suggestions, failure-case storage, accounts, or permanent spreadsheet
storage.

### Run inference

```bash
export API_BASE_URL="https://router.huggingface.co/v1"
export MODEL_NAME="meta-llama/Llama-3.3-70B-Instruct"
export HF_TOKEN="<your-hf-token>"
python3 inference.py
```

`HF_TOKEN` is required. For local contract checks, a placeholder token is enough because the script falls back to the deterministic planner after transport/auth failures.

### Example client usage

```python
from tabular_cleaning_env.client import TabularCleaningEnv
from tabular_cleaning_env.models import TabularCleaningAction

env = TabularCleaningEnv(base_url="http://localhost:8000")
result = env.reset(task_id="easy_contacts_cleanup")
print(result.observation.task_rules)
result = env.step(TabularCleaningAction(action_type="profile_table"))
print(result.observation.metadata)
env.close()
```

## Validation

Local validation commands:

```bash
python3 -m pytest -q
python3 inference.py
docker build -t tabulaclean .
openenv validate http://localhost:8000
```

If the `openenv` CLI is not available on your machine, validate through the
Docker image first. The compatibility wrapper is included for local
development, while deployment validation uses the pinned runtime installed in
the Python 3.11 Docker environment.

The project includes the core runtime files:

- `openenv.yaml`
- `pyproject.toml`
- `uv.lock`
- root `Dockerfile`
- root `inference.py`
- `server/app.py` with `main()`

## Docker

Build and run locally:

```bash
docker build -t tabulaclean .
docker run --rm -p 8000:8000 tabulaclean
```

Then validate the live container:

```bash
python3 -m uv run --python 3.11 openenv validate http://localhost:8000
```

## Hugging Face Spaces

This project is designed for a containerized Hugging Face Space:

1. create a Docker Space
2. push this repository
3. let the Space build from the root `Dockerfile`
4. add Space settings before first boot:
   - `HF_TOKEN` as a Secret
   - `API_BASE_URL` as a Variable if overriding the default
   - `MODEL_NAME` as a Variable if overriding the default
5. confirm the Space is `Running`
6. validate the public runtime

```bash
python3 -m uv run --python 3.11 openenv validate https://<your-space>.hf.space
```

## Export Artifacts

A successful run produces three downstream-ready artifacts in environment state:

- `cleaned_table`
- `data_quality_report`
- `transformation_audit_log`

That is the real-world value proposition: not just cleaning data, but cleaning it in a way that is reviewable, explainable, and safe to publish.

## Test Coverage

The test suite covers:

- model validation
- environment reset, step, and state behavior
- deterministic grading
- reward bounds
- workflow approval and publish semantics
- inference log formatting
- README command coverage
