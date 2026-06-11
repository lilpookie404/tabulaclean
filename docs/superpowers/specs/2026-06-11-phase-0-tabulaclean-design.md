# TabulaClean Phase 0 Repository Preparation Design

## Objective

Reposition the repository from a commerce-focused benchmark demo into
TabulaClean, an AI-assisted spreadsheet cleaning assistant for non-technical
users, without changing the existing runtime behavior.

Phase 0 prepares the repository for a later React, TypeScript, and Vite
migration. It does not implement that migration or add file-upload APIs.

## Scope

Phase 0 will:

- Rename visible project identity to TabulaClean.
- Rewrite product-facing README and static UI copy so the primary story is
  spreadsheet cleaning, issue review, validation, and safe export.
- Explain that the existing benchmark remains available as an
  advanced/internal evaluation layer.
- Explain that benchmark tasks use bundled ground truth, while future real
  uploads will use quality checks instead of ground-truth scoring.
- Add `docs/PROJECT_DIRECTION.md` as a concise source of truth for the product
  direction and Phase 1 boundary.
- Improve `.gitignore` coverage for local secrets, environments, caches,
  frontend outputs, test artifacts, uploaded files, failure logs, temporary
  spreadsheet exports, and editor/OS files.
- Update tests only where assertions intentionally depend on renamed visible
  copy.
- Run the existing test suite and report results.

Phase 0 will not:

- Add React, TypeScript, Vite, or frontend build tooling.
- Add CSV or XLSX upload, parsing, storage, or download APIs.
- Rename Python packages, benchmark runtime environment names, routes, task IDs,
  deployment URLs, or package metadata identifiers that may be compatibility
  surfaces.
- Delete or alter benchmark tasks, graders, scoring, cleaning actions,
  environment behavior, inference behavior, or compatibility endpoints.
- Delete existing generated or untracked files from the working tree.
- Include local secrets, uploaded spreadsheets, caches, test output, build
  output, or failure logs in commits.

## Repository Boundaries

### Product-Facing Surfaces

The following files are expected to receive scoped copy or documentation
changes:

- `README.md`
- `server/templates/index.html`
- `server/templates/play.html`
- `docs/PROJECT_DIRECTION.md`
- `.gitignore`
- copy-sensitive tests such as `tests/test_env.py`

The untracked `docs/non_technical_data_cleaning_assistant_plan.md` will be
removed. Its relevant product direction will be represented concisely in
`docs/PROJECT_DIRECTION.md`.

### Compatibility Surfaces

These remain stable:

- `tabular_cleaning_env`
- `openenv-tabular-cleaning`
- `openenv.yaml`
- `/ws`, `/metadata`, `/schema`, `/state`, `/health`, and other existing routes
- bundled task IDs and task data
- runtime framework identifiers required by API, validation, deployment, or
  evaluation code
- existing GitHub and Hugging Face deployment URLs

## Copy Strategy

The README opening and static landing page will lead with TabulaClean as an
AI-assisted spreadsheet cleaning assistant. The product workflow is:

1. inspect spreadsheet data
2. identify quality issues
3. review suggested fixes
4. approve risky changes
5. validate the cleaned data
6. export a cleaned result

The current static workbench is an evaluation and workflow preview, not the
finished upload product. Copy must not claim that real CSV/XLSX upload or
download behavior already exists.

Commerce examples can remain inside bundled task descriptions where they
accurately identify benchmark datasets. They will not define the overall
product identity.

Product-facing prose and static UI will not use the OpenEnv brand. Required
dependency names, commands, filenames, and code identifiers may remain where
removing them would break compatibility or make technical validation
instructions inaccurate.

## Ignore Policy

`.gitignore` will use directory-oriented patterns where possible to avoid
accidentally ignoring the curated CSV files under `tasks/`.

Coverage will include:

- Python bytecode, caches, coverage, packaging, and test output
- Python virtual environments
- `.env` and local secret variants while allowing an intentionally committed
  example file if one is added later
- `node_modules` and common frontend build/cache output
- test result directories
- designated upload, export, temporary data, and failure-log directories
- temporary spreadsheet filename patterns that do not match bundled task data
- OS and editor files

Existing `tasks/**/raw.csv` and `tasks/**/ground_truth.csv` files must remain
trackable.

## Verification

Verification will include:

- review of `git diff` and `git status` to confirm only intended Phase 0 files
  are selected for the eventual commit
- repository search for stale commerce/hackathon/demo-first product copy
- confirmation that the OpenEnv brand is absent from product-facing prose while
  required technical identifiers and validation commands remain intact
- the existing pytest suite
- targeted HTTP/static-page tests if the full suite is unavailable

Any pre-existing test failure will be reported separately from failures caused
by Phase 0.

## Git Workflow

Work will stay on `codex/phase-0-tabulaclean`. Existing modified and untracked
work will remain in place and will not be reverted.

After Phase 0 verification, all pre-existing unpushed changes will be audited.
Related source and test work that is valid and passes verification may be
committed on this branch. Generated test output, caches, local files, secrets,
and unrelated artifacts will not be committed.

The completed branch will be merged into local `main` only after the staged
scope and test results are reviewed. The updated `main` branch will then be
pushed to its configured remote. No Phase 1 branch or implementation will be
started as part of this work.
