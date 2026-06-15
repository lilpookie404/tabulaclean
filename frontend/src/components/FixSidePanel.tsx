import { useMemo, useState } from "react";
import type {
  ChangePreview,
  CleaningAction,
  UploadColumn,
  UploadIssue
} from "../uploads/types";

interface FixSidePanelProps {
  issue: UploadIssue;
  columns: UploadColumn[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onPreview: (action: CleaningAction) => Promise<ChangePreview>;
  onSubmit: (action: CleaningAction) => Promise<void>;
}

const issueTitles: Record<string, string> = {
  missing_values: "Fill missing values",
  duplicate_rows: "Remove exact duplicate rows",
  whitespace: "Trim extra spaces",
  messy_column_names: "Rename a column",
  numeric_text: "Convert numeric text",
  empty_columns: "Remove empty columns",
  inconsistent_dates: "Standardize dates"
};

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Empty";
  return String(value);
}

export default function FixSidePanel({
  issue,
  columns,
  busy,
  error,
  onClose,
  onPreview,
  onSubmit
}: FixSidePanelProps) {
  const affectedColumns = useMemo(
    () =>
      columns.filter((column) => issue.affected_columns.includes(column.id)),
    [columns, issue.affected_columns]
  );
  const [columnId, setColumnId] = useState(
    affectedColumns[0]?.id ?? columns[0]?.id ?? ""
  );
  const [selectedColumnIds, setSelectedColumnIds] = useState(
    issue.affected_columns
  );
  const [newName, setNewName] = useState("");
  const [fillStrategy, setFillStrategy] =
    useState<"explicit" | "mean" | "median" | "most_common">("explicit");
  const [fillValue, setFillValue] = useState("");
  const [keep, setKeep] = useState<"first" | "last">("first");
  const [targetType, setTargetType] = useState<"integer" | "decimal">("decimal");
  const [dateOrder, setDateOrder] =
    useState<"month_first" | "day_first">("day_first");
  const [outputFormat, setOutputFormat] =
    useState<"YYYY-MM-DD" | "MM/DD/YYYY" | "DD/MM/YYYY">("YYYY-MM-DD");
  const [preview, setPreview] = useState<ChangePreview | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const selectedColumn = columns.find((column) => column.id === columnId);
  const supportsCalculatedFill =
    selectedColumn?.inferred_type === "integer" ||
    selectedColumn?.inferred_type === "decimal";

  const action = useMemo<CleaningAction>(() => {
    switch (issue.type) {
      case "whitespace":
        return {
          type: "trim_whitespace",
          column_ids: selectedColumnIds
        };
      case "messy_column_names":
        return {
          type: "rename_column",
          column_id: columnId,
          new_name: newName
        };
      case "missing_values":
        return {
          type: "fill_missing",
          column_id: columnId,
          strategy: fillStrategy,
          ...(fillStrategy === "explicit" ? { value: fillValue } : {})
        };
      case "duplicate_rows":
        return { type: "drop_duplicates", keep };
      case "numeric_text":
        return {
          type: "convert_numeric",
          column_id: columnId,
          target_type: targetType
        };
      case "empty_columns":
        return {
          type: "drop_empty_columns",
          column_ids: selectedColumnIds
        };
      case "inconsistent_dates":
        return {
          type: "standardize_date",
          column_id: columnId,
          date_order: dateOrder,
          output_format: outputFormat
        };
      default:
        return { type: "trim_whitespace", column_ids: [] };
    }
  }, [
    columnId,
    dateOrder,
    fillStrategy,
    fillValue,
    issue.type,
    keep,
    newName,
    outputFormat,
    selectedColumnIds,
    targetType
  ]);

  const previewAction = async () => {
    setLocalError(null);
    try {
      setPreview(await onPreview(action));
    } catch (caught) {
      setPreview(null);
      setLocalError(
        caught instanceof Error ? caught.message : "We could not preview this change."
      );
    }
  };

  const changeField = (change: () => void) => {
    change();
    setPreview(null);
    setLocalError(null);
  };

  const submit = async () => {
    setLocalError(null);
    try {
      await onSubmit(action);
    } catch (caught) {
      setLocalError(
        caught instanceof Error ? caught.message : "We could not submit this change."
      );
    }
  };

  const requiresColumn = !["whitespace", "duplicate_rows", "empty_columns"].includes(
    issue.type
  );
  const supportsColumnSelection =
    issue.type === "whitespace" || issue.type === "empty_columns";

  const toggleSelectedColumn = (selectedId: string) => {
    changeField(() => {
      setSelectedColumnIds((current) => {
        if (current.includes(selectedId)) {
          return current.length === 1
            ? current
            : current.filter((item) => item !== selectedId);
        }
        return [...current, selectedId];
      });
    });
  };

  return (
    <aside
      aria-label="Review fix"
      className="fix-panel"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="fix-panel-heading">
        <div>
          <p className="eyebrow">Guided fix</p>
          <h4>{issueTitles[issue.type] ?? "Review this issue"}</h4>
        </div>
        <button
          aria-label="Close fix panel"
          autoFocus
          className="icon-button"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      </div>
      <p className="fix-panel-description">{issue.message}</p>

      {supportsColumnSelection ? (
        <fieldset className="column-choice-group">
          <legend>Columns to change</legend>
          {affectedColumns.map((column) => (
            <label key={column.id}>
              <input
                checked={selectedColumnIds.includes(column.id)}
                onChange={() => toggleSelectedColumn(column.id)}
                type="checkbox"
              />
              {column.name || `Column ${column.position + 1}`}
            </label>
          ))}
        </fieldset>
      ) : null}

      {requiresColumn && affectedColumns.length > 0 ? (
        <label className="field-label">
          Column
          <select
            onChange={(event) => {
              const nextColumnId = event.target.value;
              changeField(() => {
                setColumnId(nextColumnId);
                const nextColumn = columns.find(
                  (column) => column.id === nextColumnId
                );
                if (
                  nextColumn?.inferred_type !== "integer" &&
                  nextColumn?.inferred_type !== "decimal"
                ) {
                  setFillStrategy("explicit");
                }
              });
            }}
            value={columnId}
          >
            {affectedColumns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.name || `Column ${column.position + 1}`}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {issue.type === "messy_column_names" ? (
        <label className="field-label">
          New column name
          <input
            onChange={(event) =>
              changeField(() => setNewName(event.target.value))
            }
            value={newName}
          />
        </label>
      ) : null}

      {issue.type === "missing_values" ? (
        <>
          <label className="field-label">
            Fill method
            <select
              onChange={(event) =>
                changeField(() =>
                  setFillStrategy(
                    event.target.value as typeof fillStrategy
                  )
                )
              }
              value={fillStrategy}
            >
              <option value="explicit">Use one value</option>
              {supportsCalculatedFill ? (
                <>
                  <option value="mean">Use numeric mean</option>
                  <option value="median">Use numeric median</option>
                </>
              ) : null}
              <option value="most_common">Use most common value</option>
            </select>
          </label>
          {fillStrategy === "explicit" ? (
            <label className="field-label">
              Replacement value
              <input
                onChange={(event) =>
                  changeField(() => setFillValue(event.target.value))
                }
                value={fillValue}
              />
            </label>
          ) : null}
        </>
      ) : null}

      {issue.type === "duplicate_rows" ? (
        <label className="field-label">
          Keep
          <select
            onChange={(event) =>
              changeField(() => setKeep(event.target.value as typeof keep))
            }
            value={keep}
          >
            <option value="first">First occurrence</option>
            <option value="last">Last occurrence</option>
          </select>
        </label>
      ) : null}

      {issue.type === "numeric_text" ? (
        <label className="field-label">
          Number type
          <select
            onChange={(event) =>
              changeField(() =>
                setTargetType(event.target.value as typeof targetType)
              )
            }
            value={targetType}
          >
            <option value="decimal">Decimal</option>
            <option value="integer">Integer</option>
          </select>
        </label>
      ) : null}

      {issue.type === "inconsistent_dates" ? (
        <>
          <label className="field-label">
            Interpret numeric dates as
            <select
              onChange={(event) =>
                changeField(() =>
                  setDateOrder(event.target.value as typeof dateOrder)
                )
              }
              value={dateOrder}
            >
              <option value="day_first">Day first</option>
              <option value="month_first">Month first</option>
            </select>
          </label>
          <label className="field-label">
            Output format
            <select
              onChange={(event) =>
                changeField(() =>
                  setOutputFormat(event.target.value as typeof outputFormat)
                )
              }
              value={outputFormat}
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            </select>
          </label>
        </>
      ) : null}

      {!preview ? (
        <button
          className="button button-outline panel-button"
          disabled={busy}
          onClick={() => void previewAction()}
          type="button"
        >
          Preview change
        </button>
      ) : null}

      {busy && !preview ? <p role="status">Preparing a safe preview…</p> : null}
      {localError || error ? (
        <div className="panel-error" role="alert">
          {localError ?? error}
        </div>
      ) : null}

      {preview ? (
        <div className="change-preview">
          <div className="change-preview-summary">
            <strong>
              {preview.affected_count.toLocaleString()} {preview.affected_unit}
            </strong>
            <span>{preview.risk === "low" ? "Low risk" : "Approval required"}</span>
          </div>
          {preview.warnings.map((warning) => (
            <p className="preview-warning" key={warning}>
              {warning}
            </p>
          ))}
          {preview.samples.length > 0 ? (
            <div className="sample-list">
              {preview.samples.map((sample, index) => (
                <article className="change-sample" key={`${sample.row_number}-${index}`}>
                  <span>{sample.row_number ? `Row ${sample.row_number}` : "Column name"}</span>
                  <div>
                    <small>Before</small>
                    {Object.values(sample.before).map((value, valueIndex) => (
                      <code key={valueIndex}>“{displayValue(value)}”</code>
                    ))}
                  </div>
                  <div>
                    <small>After</small>
                    {Object.values(sample.after).length ? (
                      Object.values(sample.after).map((value, valueIndex) => (
                        <code key={valueIndex}>{displayValue(value)}</code>
                      ))
                    ) : (
                      <code>Removed</code>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          <button
            className="button button-forest panel-button"
            disabled={busy}
            onClick={() => void submit()}
            type="button"
          >
            {preview.risk === "low"
              ? "Apply safe fix"
              : "Send to Review Changes"}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
