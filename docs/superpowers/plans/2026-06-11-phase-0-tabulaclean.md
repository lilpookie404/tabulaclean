# TabulaClean Phase 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand user-facing repository surfaces as TabulaClean, improve repository hygiene, preserve benchmark behavior, verify existing unpushed work, merge to `main`, and push.

**Architecture:** Keep all runtime identifiers, routes, task data, graders, and cleaning logic stable. Restrict implementation changes to product copy, documentation, ignore rules, copy-sensitive tests, and the already-present workbench feature files after they pass verification.

**Tech Stack:** Markdown, static HTML/CSS/JavaScript, FastAPI, Python 3.11, pytest, Git

---

### Task 1: Lock Product-Facing Expectations

**Files:**
- Modify: `tests/test_env.py`
- Modify: `tests/test_docs.py`

- [x] Update the static-page assertion to require `TabulaClean` and remove the old commerce workbench name.
- [x] Add README assertions for `# TabulaClean`, `## Project Direction`, and the quality-check distinction.
- [x] Run `python3 -m pytest tests/test_docs.py tests/test_env.py -q` and confirm the new assertions fail before copy changes.

### Task 2: Rebrand Documentation and Metadata

**Files:**
- Modify: `README.md`
- Modify: `pyproject.toml`
- Create: `docs/PROJECT_DIRECTION.md`
- Delete: `docs/non_technical_data_cleaning_assistant_plan.md`

- [x] Change the README frontmatter title, heading, introduction, product story, and design goals to TabulaClean.
- [x] Add a `Project Direction` section that distinguishes benchmark ground-truth scoring from future uploaded-file quality checks.
- [x] Keep literal runtime commands and filenames where required, but remove legacy framework branding from product prose.
- [x] Change only the package description in `pyproject.toml`; retain the package name and dependency identifiers.
- [x] Add the concise direction document and remove the obsolete untracked planning document.

### Task 3: Rebrand the Existing Static Workbench

**Files:**
- Modify: `server/templates/index.html`
- Modify: `server/templates/play.html`
- Modify: `server/static/play.js`
- Modify: `tests/test_env.py`

- [x] Rename visible identity, titles, hero copy, footer copy, and controls to TabulaClean product language.
- [x] Present benchmark tasks and automated runs as evaluation tools rather than the main product identity.
- [x] Preserve all element IDs, routes, query keys, event names, and JavaScript behavior.
- [x] Run the targeted documentation and environment tests.

### Task 4: Harden Ignore Rules

**Files:**
- Modify: `.gitignore`

- [x] Add Python tooling caches, virtual environments, local environment files, Node dependencies, frontend build output, test results, upload/export directories, local failure logs, temporary spreadsheet exports, and OS/editor files.
- [x] Keep `tasks/**/raw.csv` and `tasks/**/ground_truth.csv` trackable.
- [x] Confirm `test-results/.last-run.json` is ignored with `git check-ignore -v`.

### Task 5: Verify and Audit Unpushed Work

**Files:**
- Review: `inference.py`
- Review: `server/app.py`
- Review: `server/environment.py`
- Review: `tabular_cleaning_env/openenv_compat.py`
- Review: `server/static/play.css`
- Review: `server/static/play.js`
- Review: `server/templates/index.html`
- Review: `server/templates/play.html`
- Review: `tests/test_env.py`

- [x] Search tracked candidates for tokens, passwords, private keys, and local credential values.
- [x] Run `python3 -m pytest -q`.
- [x] Run `git diff --check`.
- [x] Search product-facing files for stale commerce, hackathon, submission, and legacy framework branding.
- [x] Inspect the final diff and exclude generated outputs and local files.

### Task 6: Commit, Merge, and Push

**Files:**
- Stage only verified source, documentation, tests, templates, and static assets.

- [ ] Commit the verified implementation on `codex/phase-0-tabulaclean`.
- [ ] Switch to `main` and merge the Phase 0 branch without rewriting history.
- [ ] Re-run the test suite on merged `main`.
- [ ] Push `main` to `origin`.
- [ ] Do not create or start the future `level-one` branch.
