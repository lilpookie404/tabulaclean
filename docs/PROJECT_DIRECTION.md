# TabulaClean Project Direction

TabulaClean is an AI-assisted spreadsheet cleaning assistant for people who
work with CSV and Excel files but do not want to write data-cleaning code.

The intended product workflow is:

1. upload a CSV or XLSX file
2. preview the table and detected quality issues
3. review suggested fixes
4. approve or reject risky changes
5. validate the cleaned data
6. download the cleaned file and audit summary

The current repository provides the React product shell, temporary CSV/XLSX
upload sessions, source-data previews, basic quality checks, guided manual
cleaning, risk-based approval, undo/reset, current-table CSV download,
uploaded-file validation, validation ZIP export, the cleaning engine,
structured actions, on-demand hybrid suggestions, advanced workbench, and
evaluation tasks that later product phases can build on.

## Evaluation Layer

The bundled tasks remain available for advanced and internal evaluation. Each
task includes a raw table, metadata, and a known clean reference, which allows
deterministic scoring and repeatable model comparisons.

Real user files will usually have no ground-truth answer. TabulaClean will
evaluate those files with quality checks instead, including schema checks,
missing-value analysis, duplicate detection, format consistency, validation
results, and confirmation that risky changes were reviewed.

Benchmark scores measure evaluation-task performance. Quality checks help real
users decide whether their cleaned spreadsheet is ready to download.

## Phase Boundaries

Phase 0 covers repository preparation, visible product identity, documentation,
static copy, and safer ignore rules.

Phase 1 provides the React, TypeScript, and Vite foundation, product routes,
backend health status, production FastAPI serving, and a combined Docker build.

Phase 2 adds process-local upload sessions for CSV and XLSX files, a 20-row
preview, grouped issue detection, same-tab session restoration, and unchanged
CSV download. Sessions expire after 30 minutes of inactivity and intentionally
disappear when the server restarts.

Phase 3 adds deterministic manual cleaning for detected issues, non-mutating
change previews, conservative risk-based approval, a single pending review,
bounded audit history, undo, reset, and download of the current approved table.
Uploaded-file cleaning remains separate from benchmark tasks and ground-truth
scoring.

Phase 4 adds uploaded-file validation for temporary sessions. Users can mark
required columns, run revisioned validation, review hard failures and warnings,
and download a validation ZIP containing the cleaned CSV, validation report,
and audit log.

Phase 5 adds on-demand hybrid suggestions for temporary sessions. TabulaClean
builds local typed candidate actions from detected issues and can optionally
use the configured model to rank or explain those candidates with metadata
only. Suggested actions still go through preview, approval, undo, validation,
and download gates.

Permanent file storage, accounts, failure-case storage, full-table model calls,
and model-evaluation navigation cleanup remain later product phases.
