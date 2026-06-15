# Phase 3 Manual Cleaning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add previewed, auditable manual cleaning actions with risk-based
approval, undo, and reset to temporary TabulaClean upload sessions.

**Architecture:** Extend the isolated upload subsystem with typed action
schemas, pure transformations, and lock-protected session mutation. Preserve an
immutable original table and replay active actions for undo. Connect the
existing Guided Steps interface to previews and use Review Changes for the
single pending risky proposal.

**Tech Stack:** FastAPI, Pydantic, pandas, React 19, TypeScript, Vitest,
Testing Library, Docker.

---

### Task 1: Action contracts and pure transformations

**Files:**
- Create: `server/uploads/cleaning.py`
- Modify: `server/uploads/schemas.py`
- Test: `tests/test_upload_cleaning.py`

- [ ] Write failing tests for each discriminated action, parameter validation,
  affected counts, sample differences, unresolved values, no-op rejection,
  deterministic most-common ties, and date/numeric partial conversion.
- [ ] Run `python -m pytest tests/test_upload_cleaning.py -q` and confirm
  failure because the cleaning service does not exist.
- [ ] Implement pure transformations that return a candidate table, display
  headers, compact preview metadata, and risk without mutating inputs.
- [ ] Run the targeted tests until green.

### Task 2: Revisioned session state and replay

**Files:**
- Modify: `server/uploads/store.py`
- Modify: `server/uploads/profiler.py`
- Test: `tests/test_upload_store.py`
- Test: `tests/test_upload_changes.py`

- [ ] Write failing tests for revision checks, atomic safe application,
  one-pending enforcement, approval, rejection, replay undo, reset, 100-action
  limit, 200-event audit bound, memory rejection, and expiry refresh.
- [ ] Confirm tests fail for missing session mutation behavior.
- [ ] Add typed active-action, pending-change, and audit state plus
  lock-protected preview and mutation methods.
- [ ] Reprofile current data after every committed table change and update
  memory accounting without changing the immutable original.
- [ ] Run cleaning and store tests until green.

### Task 3: Change API and compatible snapshots

**Files:**
- Modify: `server/uploads/router.py`
- Modify: `server/uploads/schemas.py`
- Test: `tests/test_upload_api.py`

- [ ] Write failing API tests for preview, safe commit, risky queue,
  approve/reject, stale revisions, occupied review, undo, reset, typed audit,
  pending state, and stable friendly errors.
- [ ] Add formula-like download warning tests and assert existing upload,
  session, CSV download, health, SPA, evaluation, and WebSocket routes still
  work.
- [ ] Implement the six change routes and extend snapshots without removing or
  renaming existing Phase 2 fields.
- [ ] Run the complete backend suite until green.

### Task 4: Frontend action client and session state

**Files:**
- Modify: `frontend/src/uploads/types.ts`
- Modify: `frontend/src/uploads/api.ts`
- Modify: `frontend/src/uploads/useUploadSession.ts`
- Test: `frontend/src/uploads/useUploadSession.test.tsx`

- [ ] Write failing tests for preview, safe commit, risky queue, approval,
  rejection, undo, reset, stale-session refresh, and duplicate-submit guards.
- [ ] Extend typed responses and API methods while preserving upload and
  restore behavior.
- [ ] Keep only the session ID in browser storage and refetch after mutations.
- [ ] Run targeted hook tests until green.

### Task 5: Guided fix side panel

**Files:**
- Create: `frontend/src/components/FixSidePanel.tsx`
- Modify: `frontend/src/components/IssueSummary.tsx`
- Modify: `frontend/src/components/UploadWorkspace.tsx`
- Modify: `frontend/src/styles/global.css`
- Test: `frontend/src/pages/CleanMyFilePage.test.tsx`

- [ ] Write failing page tests for Review fix controls, action-specific forms,
  preview loading and errors, samples, safe application, risky handoff,
  download warnings, focus behavior, and live announcements.
- [ ] Implement the responsive side panel and deterministic forms for all
  seven actions.
- [ ] Keep the preview table visible on wide screens and stack accessibly on
  narrow screens.
- [ ] Run page tests, lint, and TypeScript checks until green.

### Task 6: Review Changes workflow

**Files:**
- Modify: `frontend/src/pages/ReviewChangesPage.tsx`
- Modify: `frontend/src/styles/global.css`
- Create: `frontend/src/pages/ReviewChangesPage.test.tsx`

- [ ] Write failing tests for no-session, loading, expired, empty-review,
  pending-review, centered approval confirmation, rejection, audit history,
  undo, reset, stale conflicts, and disabled duplicate submissions.
- [ ] Implement server-restored review state, confirmation dialog, history,
  undo, reset, and navigation back to the workspace.
- [ ] Run all frontend tests, lint, typecheck, and the Vite build until green.

### Task 7: Documentation and complete verification

**Files:**
- Modify: `README.md`
- Modify: `docs/PROJECT_DIRECTION.md`
- Modify: `Dockerfile` only if build verification requires it

- [ ] Document supported manual actions, conservative approval behavior,
  temporary history, undo/reset, formula warnings, and the Phase 4 boundary.
- [ ] Run the full Python suite and `npm run check` in `frontend/`.
- [ ] Build the Docker image and run a container smoke test for `/health`, SPA
  root/deep links, upload, preview, safe change, risky approval, undo,
  download, and an existing evaluation route.
- [ ] Run `git diff --check`, inspect tracked/untracked output, and confirm no
  AI, validation, persistence, failure storage, secrets, or benchmark changes
  were introduced.
