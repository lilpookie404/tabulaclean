# TabulaClean Phase 3 Manual Cleaning Design

## Objective

Phase 3 adds a guided, deterministic manual cleaning workflow to temporary
upload sessions. Users can configure and preview a fix from a detected issue,
apply low-risk whitespace trimming immediately, and send all other changes to
Review Changes for explicit approval.

This phase does not add AI suggestions, formal validation scoring, persistent
file storage, failure-case storage, accounts, or benchmark behavior changes.

## Architecture

Uploaded-file cleaning remains isolated under `server/uploads/`. A focused
cleaning module defines typed actions and pure DataFrame transformations.
Benchmark tasks, graders, routes, and task-specific ground truth are not used
for uploaded files.

Each upload session gains:

- a monotonic table revision
- ordered active action records
- one optional pending risky change
- a typed, bounded audit history
- derived undo and download-warning state

The original DataFrame remains immutable. The current DataFrame is rebuilt
from the original and active actions when undoing a change. This avoids
retaining a full DataFrame snapshot for every action.

Session mutation is atomic under the store lock. Revision checks, action
application, reprofiling, memory checks, audit updates, and expiry refresh
either all succeed or leave the session unchanged.

## Cleaning Actions

Actions target stable internal column IDs, so blank, duplicate, and renamed
display headers remain representable.

- `trim_whitespace` trims leading and trailing whitespace in selected columns.
- `rename_column` changes one display header to a trimmed, nonblank, unique
  name.
- `fill_missing` fills one column with an explicit value, numeric mean,
  numeric median, or the most common value.
- `drop_duplicates` removes exact duplicate rows and keeps the first or last
  occurrence.
- `convert_numeric` converts recognized values to integer or decimal while
  leaving incompatible non-empty values unchanged.
- `drop_empty_columns` removes selected columns only while they remain
  completely empty and never removes every column.
- `standardize_date` uses an explicit month-first or day-first interpretation
  and writes `YYYY-MM-DD`, `MM/DD/YYYY`, or `DD/MM/YYYY`.

Most-common ties use the value that appears first. Mean and median are offered
only when the selected column contains usable numeric values. Date and numeric
actions report unresolved values rather than silently discarding them.

No-op and invalid actions are rejected. Only whitespace trimming is low-risk;
all other actions require approval.

## Change Lifecycle

Every fix begins with a non-mutating preview tied to the current table
revision. A preview returns the affected count, risk, warnings, unresolved
count, and at most five before-and-after row samples.

A safe action is recomputed and applied atomically. A risky action becomes the
session's single pending change without modifying the table. While a risky
change is pending, new changes and undo are blocked. Approval recomputes the
action against the same revision before applying it. Rejection records an
audit event but does not advance the table revision.

Undo removes the latest active action and replays the remaining actions from
the original. Reset restores the original table and discards any pending
change after confirmation. Sessions allow at most 100 active actions and keep
the latest 200 audit events.

## Public API

Existing Phase 2 responses remain compatible and add:

- `revision`
- `pending_change`
- `applied_change_count`
- `can_undo`
- typed `audit_log`
- structured `download_warnings`

New routes:

- `POST /api/sessions/{session_id}/change-previews`
- `POST /api/sessions/{session_id}/changes`
- `POST /api/sessions/{session_id}/changes/{change_id}/approve`
- `POST /api/sessions/{session_id}/changes/{change_id}/reject`
- `POST /api/sessions/{session_id}/undo`
- `POST /api/sessions/{session_id}/reset`

Requests include `expected_revision`. Revision conflicts, an occupied review
slot, and invalid change states return `409`. Invalid or inapplicable actions
return `422`. Missing sessions or changes return `404`. Unsafe result sizes
use the existing size and capacity errors. Failed operations never partially
mutate a session.

Audit entries contain action metadata and summaries, not full table snapshots
or uploaded values.

## Frontend

The Guided Steps workspace remains the primary flow. Supported issue cards
gain a **Review fix** control that opens a responsive side panel while keeping
the issue list and table visible. The panel contains the relevant action form,
affected count, warnings, and sample differences.

Whitespace trimming applies from the panel. Risky changes activate Step 3 and
move to Review Changes. That page displays the single pending proposal,
sample differences, rejection, a centered final approval confirmation,
activity history, undo, and confirmed reset.

Both pages restore the active session ID from `sessionStorage`, fetch current
server state, and handle expiry, stale revisions, retries, and duplicate
submissions. Download copy states that only approved changes are included and
formal validation has not run.

Formula-like text beginning with `=`, `+`, `-`, or `@` is not silently changed.
The session exposes a download warning so users understand that spreadsheet
software may interpret those cells as formulas.

## Verification

Backend tests cover every action, preview non-mutation, risk assignment,
approval and rejection, revision conflicts, pending-change enforcement,
deterministic fills, partial conversion, replay undo, reset, history bounds,
expiry, memory failures, audit contents, formula warnings, and downloads.

Frontend tests cover the side panel, safe apply, risky handoff, approval
confirmation, rejection, history, undo, reset, session restoration, expired
and stale sessions, warnings, accessibility, and friendly errors.

Completion requires the full Python suite, frontend lint, Vitest, TypeScript,
Vite build, Docker build, and a container smoke test for product and preserved
evaluation routes.
