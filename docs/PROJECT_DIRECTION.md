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

Upload and download APIs are not part of Phase 1. The current repository
provides the React product shell, cleaning engine, structured actions, review
gates, validation logic, advanced workbench, and evaluation tasks that later
product phases can build on.

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

Phase 2 will add upload sessions and real CSV/XLSX handling. Spreadsheet
parsing, cleaning-session persistence, AI suggestions, downloadable exports,
and failure-case storage remain outside Phase 1.
