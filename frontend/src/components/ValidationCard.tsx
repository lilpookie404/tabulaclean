import { useMemo, useState } from "react";
import type { UploadColumn, UploadIssue, UploadSession } from "../uploads/types";

interface ValidationCardProps {
  busy: boolean;
  error: string | null;
  session: UploadSession;
  validatedExportUrl: string | null;
  onRunValidation: (requiredColumnIds: string[]) => Promise<UploadSession>;
}

function requiredDefaults(issues: UploadIssue[]) {
  const missing = issues.find((issue) => issue.type === "missing_values");
  return missing ? missing.affected_columns : [];
}

function statusLabel(status: UploadSession["validation_status"]) {
  if (status === "passed") return "Validation passed";
  if (status === "failed") return "Validation failed";
  return "Validation not run";
}

export default function ValidationCard({
  busy,
  error,
  session,
  validatedExportUrl,
  onRunValidation
}: ValidationCardProps) {
  const defaults = useMemo(() => requiredDefaults(session.issues), [session.issues]);
  const [requiredColumnIds, setRequiredColumnIds] = useState<string[]>(defaults);

  const toggleRequired = (column: UploadColumn) => {
    setRequiredColumnIds((current) =>
      current.includes(column.id)
        ? current.filter((columnId) => columnId !== column.id)
        : [...current, column.id]
    );
  };

  const result = session.validation_result;
  const failedChecks = result?.checks.filter((check) => check.status === "failed") ?? [];
  const warningChecks = result?.checks.filter((check) => check.status === "warning") ?? [];

  return (
    <aside className="validation-card">
      <p className="eyebrow">Readiness check</p>
      <h4>Validate current table</h4>
      <p>
        Mark columns that must be filled, then run validation before sharing the
        file.
      </p>
      <fieldset className="required-columns">
        <legend>Required columns</legend>
        {session.columns.map((column) => (
          <label key={column.id}>
            <input
              checked={requiredColumnIds.includes(column.id)}
              onChange={() => toggleRequired(column)}
              type="checkbox"
            />
            <span>{column.name || `Column ${column.position + 1}`} is required</span>
          </label>
        ))}
      </fieldset>
      <button
        className="button button-coral validation-run-button"
        disabled={busy}
        onClick={() => void onRunValidation(requiredColumnIds).catch(() => undefined)}
        type="button"
      >
        {busy ? "Running validation" : "Run validation"}
      </button>

      <div className={`validation-result ${session.validation_status}`}>
        <strong>{statusLabel(session.validation_status)}</strong>
        {result ? (
          <span>
            {result.summary.errors} errors · {result.summary.warnings} warnings
          </span>
        ) : (
          <span>Validation has not been run yet.</span>
        )}
      </div>

      {error ? (
        <div className="panel-error" role="alert">
          {error}
        </div>
      ) : null}

      {[...failedChecks, ...warningChecks].map((check) => (
        <article className={`validation-check ${check.severity}`} key={check.check_id}>
          <strong>{check.title}</strong>
          <p>{check.message}</p>
        </article>
      ))}

      {validatedExportUrl ? (
        <a className="button button-forest download-button" href={validatedExportUrl}>
          Download validation ZIP
        </a>
      ) : null}
    </aside>
  );
}
