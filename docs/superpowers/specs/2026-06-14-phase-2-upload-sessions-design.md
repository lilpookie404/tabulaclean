# TabulaClean Phase 2 Upload Sessions Design

## Objective

Phase 2 lets a user upload a CSV or XLSX spreadsheet, receive a temporary
session, inspect a preview and basic quality findings, retrieve the session,
and download the unchanged current table as CSV.

This phase does not add cleaning actions, suggested fixes, approval queues,
validation execution, AI calls, failure storage, or persistent file storage.
The existing benchmark and evaluation environment remains independent and
unchanged.

## Architecture

The upload product is a separate subsystem under `server/uploads/`:

- `parser.py` validates and parses CSV/XLSX bytes without writing uploads to
  disk.
- `profiler.py` infers friendly column types and detects grouped quality
  issues without modifying values.
- `store.py` owns the thread-safe in-memory session lifecycle.
- `schemas.py` defines the public response contract.
- `router.py` exposes the three `/api` endpoints.

The FastAPI application registers this router alongside the existing
OpenEnv-compatible and workbench routes. Uploaded data is never adapted into a
benchmark task and is never ground-truth scored.

## Session Model

Each session stores:

- a UUID session ID
- original filename and optional worksheet name
- stable internal column IDs and original display headers
- an original DataFrame and an independent current DataFrame copy
- inferred types and grouped issues
- `validation_status` set to `not_run`
- an empty audit log
- creation, access, and expiry timestamps

Sessions expire after 30 minutes of inactivity. Expired sessions are removed
during upload and read requests. The store allows at most 10 unexpired sessions
and 500 MB of estimated DataFrame memory, counting both copies. It never evicts
a live session; a new upload receives a temporary-capacity error instead.

## Parsing And Limits

Uploads are limited to 10 MB and must use a `.csv` or `.xlsx` filename.

CSV parsing:

- accepts comma-separated UTF-8, UTF-8 BOM, or Windows-1252 text
- preserves lexical cell values
- rejects malformed rows and files without data rows
- preserves blank and duplicate display headers through internal column IDs

XLSX parsing:

- validates the workbook as a ZIP archive before parsing
- rejects encrypted, corrupt, or suspiciously expanded archives
- imports the first visible worksheet
- preserves display headers and lexical values where practical
- rejects workbooks without a visible sheet or data rows

Parsed tables are limited to 100,000 rows, 200 columns, and 100 MB estimated
DataFrame memory per copy.

## Public API

### `POST /api/uploads`

Accepts one multipart field named `file` and returns `201` with:

- session and file metadata
- row and column counts
- ordered column descriptors with stable IDs and friendly inferred types
- the first 20 rows with source row numbers
- grouped detected issues and the issue-group count
- `validation_status: "not_run"`
- `audit_log: []`
- an ISO-8601 expiry timestamp

### `GET /api/sessions/{session_id}`

Returns the current session snapshot and refreshes its inactivity expiry.
Missing and expired sessions return the same `404` response.

### `GET /api/sessions/{session_id}/download`

Returns the unchanged current DataFrame as UTF-8 BOM CSV using the original
display headers, including duplicate or blank headers. The filename is
`<original-stem>-current.csv`.

## Issue Detection

Detection is deterministic, read-only, and grouped by issue type:

- missing values
- exact duplicate rows
- leading or trailing whitespace
- blank, duplicate, padded, or malformed column names
- strongly numeric-looking text columns with inconsistent or text storage
- completely empty columns
- multiple recognized date formats in date-like columns

Each issue contains a stable type, plain-English title and message, affected
count and unit, affected column IDs, and up to five source row numbers. Date
and numeric detection is conservative to avoid treating IDs, postal codes, and
ordinary text as problems.

## Frontend

The approved Guided Steps workspace replaces the Phase 1 upload placeholder.
The rail is a progress guide rather than navigation or a wizard.

States:

- initial
- drag-active
- uploading
- success
- error
- restoring
- expired

Success displays file metadata, summary counts, grouped issue cards, friendly
type labels, and a semantic 20-row preview table. The table scrolls
horizontally on narrow screens. Suggested fixes remain disabled and explicitly
marked for Phase 3. Download is enabled with copy explaining that no cleaning
has occurred.

Only the session ID is stored in `sessionStorage`. A same-tab refresh restores
the temporary session when available. An expired session clears local state
and returns to the upload view with a friendly notice.

## Error Contract

Errors use a stable `code` and friendly `message`:

- `413`: upload, dimension, workbook expansion, or parsed-memory limit
- `415`: unsupported file type
- `422`: empty, corrupt, encrypted, malformed, or unreadable file
- `404`: missing or expired session
- `503`: active-session or memory capacity reached

Responses do not expose stack traces, local paths, environment values, or
uploaded content.

## Verification

Backend tests cover parsing, encodings, worksheets, all limits, issue
detectors, session lifecycle, response contracts, downloads, and compatibility
routes. Frontend tests cover every upload state, Guided Steps behavior, preview
rendering, errors, download, and refresh restoration.

Completion requires the full Python suite, frontend lint/tests/typecheck/build,
Docker build, and a container smoke test covering health, SPA routes,
upload/session/download, and an existing evaluation route.
