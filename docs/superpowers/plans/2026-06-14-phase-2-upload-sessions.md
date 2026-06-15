# Phase 2 Upload Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe, temporary CSV/XLSX upload sessions with previews, grouped issue detection, retrieval, and CSV download through the TabulaClean product UI.

**Architecture:** Build an isolated `server/uploads` subsystem with parser, profiler, schemas, session store, and router boundaries. Keep uploaded DataFrames process-local and separate from the benchmark environment. Replace the Phase 1 workspace placeholder with a tested Guided Steps React workspace that consumes the new API.

**Tech Stack:** FastAPI, Pydantic, pandas, openpyxl, React 19, TypeScript, Vitest, Testing Library, Docker.

---

### Task 1: Upload schemas and parser

**Files:**
- Create: `server/uploads/__init__.py`
- Create: `server/uploads/errors.py`
- Create: `server/uploads/schemas.py`
- Create: `server/uploads/parser.py`
- Test: `tests/test_upload_parser.py`
- Modify: `requirements.txt`
- Modify: `pyproject.toml`

- [ ] Write parser tests for CSV encodings, XLSX visible-sheet selection,
  duplicate/blank headers, empty/corrupt inputs, extensions, dimensions,
  archive expansion, and parsed-memory limits.
- [ ] Run `python -m pytest tests/test_upload_parser.py -q` and confirm the
  tests fail because the subsystem does not exist.
- [ ] Implement bounded byte reading, raw header extraction, stable internal
  IDs, CSV decoding, XLSX archive inspection, DataFrame construction, and
  friendly parser errors.
- [ ] Add explicit `pandas`, `openpyxl`, and `python-multipart` dependencies.
- [ ] Run the parser tests until green and commit the slice.

### Task 2: Profiling and issue detection

**Files:**
- Create: `server/uploads/profiler.py`
- Test: `tests/test_upload_profiler.py`

- [ ] Write failing tests for friendly inferred types and each grouped issue:
  missing cells, duplicate rows, whitespace, messy headers, numeric-looking
  text, empty columns, and inconsistent dates.
- [ ] Confirm the tests fail for missing profiler behavior.
- [ ] Implement deterministic type inference and read-only grouped detection,
  including affected columns and at most five source row examples.
- [ ] Run parser and profiler tests until green and commit the slice.

### Task 3: Thread-safe session store

**Files:**
- Create: `server/uploads/store.py`
- Test: `tests/test_upload_store.py`

- [ ] Write failing tests for independent original/current DataFrames, UUID
  sessions, 30-minute sliding expiry, expired cleanup, 10-session capacity,
  500 MB capacity, and no live-session eviction.
- [ ] Confirm the tests fail for missing store behavior.
- [ ] Implement a lock-protected store with injectable clock and configurable
  limits for deterministic tests.
- [ ] Run store, parser, and profiler tests until green and commit the slice.

### Task 4: Upload, session, and download API

**Files:**
- Create: `server/uploads/router.py`
- Modify: `server/app.py`
- Test: `tests/test_upload_api.py`

- [ ] Write failing API tests for `POST /api/uploads`, both successful file
  types, response shape, clean errors, session retrieval, missing/expired
  sessions, UTF-8 BOM CSV download, original headers, and capacity errors.
- [ ] Add compatibility assertions for `/health`, SPA fallback,
  `/play/api/config`, and the existing WebSocket reset/state flow.
- [ ] Confirm API tests fail because routes are absent.
- [ ] Implement router registration, snapshot serialization, stable error
  envelopes, content disposition, and streaming CSV download.
- [ ] Run all backend tests until green and commit the slice.

### Task 5: Frontend API client and state hook

**Files:**
- Create: `frontend/src/uploads/types.ts`
- Create: `frontend/src/uploads/api.ts`
- Create: `frontend/src/uploads/useUploadSession.ts`
- Test: `frontend/src/uploads/useUploadSession.test.tsx`

- [ ] Write failing tests for initial, uploading, success, error, restore,
  expired, reset, and persisted session-ID behavior using mocked `fetch`.
- [ ] Confirm tests fail because the upload client and hook are absent.
- [ ] Implement typed API parsing, friendly fallback errors, sessionStorage
  restoration, upload state transitions, and download URL generation.
- [ ] Run the targeted frontend tests until green and commit the slice.

### Task 6: Guided Steps upload workspace

**Files:**
- Create: `frontend/src/components/UploadWorkspace.tsx`
- Create: `frontend/src/components/UploadProgress.tsx`
- Create: `frontend/src/components/IssueSummary.tsx`
- Create: `frontend/src/components/TablePreview.tsx`
- Modify: `frontend/src/pages/CleanMyFilePage.tsx`
- Modify: `frontend/src/styles/global.css`
- Test: `frontend/src/pages/CleanMyFilePage.test.tsx`

- [ ] Replace the Phase 1 boundary test with failing tests for accessible file
  selection, drag/drop, loading, friendly errors, successful summary, progress
  rail, issue cards, semantic table, Phase 3 placeholder, and download.
- [ ] Confirm the targeted page tests fail for missing behavior.
- [ ] Implement the approved responsive Guided Steps workspace while
  preserving the existing hero, principles, cursor, and shared shell.
- [ ] Run frontend tests, lint, and typecheck until green and commit the slice.

### Task 7: Documentation and full verification

**Files:**
- Modify: `README.md`
- Modify: `docs/PROJECT_DIRECTION.md`
- Modify: `Dockerfile` only if dependency/build verification requires it

- [ ] Document upload limits, supported encodings, first-visible-sheet
  behavior, temporary session expiry/restart behavior, CSV download, and the
  Phase 3 boundary.
- [ ] Run the full Python suite.
- [ ] Run `npm run check` in `frontend/`.
- [ ] Build `tabulaclean:phase-2`.
- [ ] Run the container and verify `/health`, `/`, `/review-changes`, a CSV
  upload/session/download round trip, and `/play/api/config`.
- [ ] Review `git diff --check`, tracked files, secrets, generated output, and
  confirm no cleaning-action or AI endpoint was added.
- [ ] Commit the documentation and any final verification fixes.
