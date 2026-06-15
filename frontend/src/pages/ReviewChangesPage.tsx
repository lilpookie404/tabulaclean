import { useState } from "react";
import PageContainer from "../components/PageContainer";
import { useUploadSession } from "../uploads/useUploadSession";
import type { ChangeSample } from "../uploads/types";

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Empty";
  return String(value);
}

function SampleList({ samples }: { samples: ChangeSample[] }) {
  if (!samples.length) return null;
  return (
    <div className="review-samples">
      {samples.map((sample, index) => (
        <article className="review-sample" key={`${sample.row_number}-${index}`}>
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
  );
}

function ConfirmationDialog({
  title,
  description,
  confirmLabel,
  busy,
  onCancel,
  onConfirm
}: {
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="dialog-backdrop">
      <section
        aria-label={title}
        aria-modal="true"
        className="confirm-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
        role="dialog"
      >
        <p className="eyebrow">Please confirm</p>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="dialog-actions">
          <button
            autoFocus
            className="button button-outline"
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="button button-coral"
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

const statusLabels = {
  applied: "Applied",
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  undone: "Undone",
  reset: "Reset"
};

export default function ReviewChangesPage() {
  const {
    state,
    session,
    message,
    operationState,
    operationMessage,
    approvePending,
    rejectPending,
    undoLatest,
    resetToOriginal
  } = useUploadSession();
  const [confirming, setConfirming] = useState<"approve" | "reset" | null>(null);
  const busy = operationState === "working";

  const approve = async () => {
    try {
      await approvePending();
      setConfirming(null);
    } catch {
      // The hook exposes a friendly operation message.
    }
  };

  const reset = async () => {
    try {
      await resetToOriginal();
      setConfirming(null);
    } catch {
      // The hook exposes a friendly operation message.
    }
  };

  return (
    <PageContainer className="review-page">
      <div className="review-page-heading">
        <div>
          <p className="eyebrow">Human review</p>
          <h1>Review Changes</h1>
          <p>Approve consequential fixes with clear before-and-after context.</p>
        </div>
        <a className="button button-outline" href="/#workspace">
          Back to workspace
        </a>
      </div>

      {state === "initial" ? (
        <section className="review-empty">
          <h2>No spreadsheet is open</h2>
          <p>Upload a CSV or Excel file before reviewing cleaning changes.</p>
          <a className="button button-forest" href="/">
            Clean a file
          </a>
        </section>
      ) : null}

      {state === "restoring" ? (
        <section className="review-empty" role="status">
          <h2>Reopening your spreadsheet</h2>
          <p>Loading the latest review state.</p>
        </section>
      ) : null}

      {state === "expired" ? (
        <section className="review-empty" role="alert">
          <h2>Your temporary session expired</h2>
          <p>{message}</p>
          <a className="button button-forest" href="/">
            Upload the file again
          </a>
        </section>
      ) : null}

      {state === "error" ? (
        <section className="review-empty" role="alert">
          <h2>We could not open this review</h2>
          <p>{message}</p>
        </section>
      ) : null}

      {state === "success" && session ? (
        <>
          <section className="review-file-summary">
            <div>
              <span>Current file</span>
              <strong>{session.filename}</strong>
            </div>
            <div>
              <span>Approved changes</span>
              <strong>{session.applied_change_count}</strong>
            </div>
            <div>
              <span>Table revision</span>
              <strong>{session.revision}</strong>
            </div>
          </section>

          {operationMessage ? (
            <div className="panel-error" role="alert">
              {operationMessage}
            </div>
          ) : null}

          {session.pending_change ? (
            <section className="pending-change-card">
              <div className="pending-change-heading">
                <div>
                  <p className="eyebrow">Approval required</p>
                  <h2>{session.pending_change.summary}</h2>
                  <p>
                    {session.pending_change.affected_count.toLocaleString()}{" "}
                    {session.pending_change.affected_unit.replace(/s$/, "")}
                    {session.pending_change.affected_count === 1 ? "" : "s"} affected
                  </p>
                </div>
                <span className="risk-badge">High risk</span>
              </div>
              {session.pending_change.warnings.map((warning) => (
                <p className="preview-warning" key={warning}>
                  {warning}
                </p>
              ))}
              <SampleList samples={session.pending_change.samples} />
              <div className="review-actions">
                <button
                  className="button button-outline"
                  disabled={busy}
                  onClick={() => void rejectPending().catch(() => undefined)}
                  type="button"
                >
                  Reject change
                </button>
                <button
                  className="button button-coral"
                  disabled={busy}
                  onClick={() => setConfirming("approve")}
                  type="button"
                >
                  Approve change
                </button>
              </div>
            </section>
          ) : (
            <section className="review-empty compact">
              <h2>No change is waiting for review</h2>
              <p>Risky fixes prepared in Clean My File will appear here.</p>
            </section>
          )}

          <section className="history-section">
            <div className="history-heading">
              <div>
                <p className="eyebrow">Session activity</p>
                <h2>Activity history</h2>
              </div>
              <div className="history-actions">
                <button
                  className="button button-outline"
                  disabled={!session.can_undo || busy}
                  onClick={() => void undoLatest().catch(() => undefined)}
                  type="button"
                >
                  Undo latest
                </button>
                <button
                  className="button button-outline"
                  disabled={
                    (!session.applied_change_count && !session.pending_change) || busy
                  }
                  onClick={() => setConfirming("reset")}
                  type="button"
                >
                  Reset to original
                </button>
              </div>
            </div>
            {session.audit_log.length ? (
              <ol className="history-list">
                {[...session.audit_log].reverse().map((entry) => (
                  <li key={entry.event_id}>
                    <div>
                      <strong>{entry.summary}</strong>
                      <span>
                        {entry.affected_count.toLocaleString()} {entry.affected_unit}
                      </span>
                    </div>
                    <span>{statusLabels[entry.status]}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="history-empty">No cleaning activity yet.</p>
            )}
          </section>
        </>
      ) : null}

      {confirming === "approve" ? (
        <ConfirmationDialog
          busy={busy}
          confirmLabel="Approve and apply"
          description="This will update the current table and include the change in future downloads."
          onCancel={() => setConfirming(null)}
          onConfirm={() => void approve()}
          title="Approve this change?"
        />
      ) : null}

      {confirming === "reset" ? (
        <ConfirmationDialog
          busy={busy}
          confirmLabel="Reset everything"
          description="This removes all approved changes and any pending review, returning to the uploaded table."
          onCancel={() => setConfirming(null)}
          onConfirm={() => void reset()}
          title="Reset to the original file?"
        />
      ) : null}
    </PageContainer>
  );
}
