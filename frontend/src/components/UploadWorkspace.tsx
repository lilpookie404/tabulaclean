import { type ChangeEvent, type DragEvent, useRef, useState } from "react";
import { useUploadSession } from "../uploads/useUploadSession";
import type { UploadIssue } from "../uploads/types";
import FixSidePanel from "./FixSidePanel";
import IssueSummary from "./IssueSummary";
import TablePreview from "./TablePreview";
import UploadProgress from "./UploadProgress";
import ValidationCard from "./ValidationCard";

interface UploadPickerProps {
  busy?: boolean;
  buttonLabel?: string;
  onFile: (file: File) => void;
}

function UploadPicker({ busy = false, buttonLabel = "Choose file", onFile }: UploadPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFile(file);
    event.target.value = "";
  };

  const dropFile = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      aria-label="Upload a CSV or XLSX spreadsheet"
      className={`upload-dropzone ${dragActive ? "drag-active" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragActive(false);
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={dropFile}
      role="region"
    >
      <input
        accept=".csv,.xlsx"
        aria-label="Choose a CSV or XLSX file"
        className="visually-hidden"
        disabled={busy}
        onChange={chooseFile}
        ref={inputRef}
        type="file"
      />
      <span aria-hidden="true" className="upload-icon">+</span>
      <strong>{dragActive ? "Drop your spreadsheet here" : "CSV and Excel workspace"}</strong>
      <p>Up to 10 MB · CSV or XLSX · stored temporarily</p>
      <button
        className="button button-coral"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        {buttonLabel}
      </button>
    </div>
  );
}

export default function UploadWorkspace() {
  const {
    state,
    session,
    message,
    uploadFile,
    resetSession,
    downloadUrl,
    operationState,
    operationMessage,
    previewChange,
    submitChange
    ,
    runValidation,
    validatedExportUrl
  } = useUploadSession();
  const [selectedIssue, setSelectedIssue] = useState<UploadIssue | null>(null);
  const isWaiting = state === "initial" || state === "error" || state === "expired";

  return (
    <section className="workspace-section" data-cursor-tone="forest" id="workspace">
      <div className="section-heading">
        <h2>Expressive outside.<br />Focused inside.</h2>
        <p>Upload a spreadsheet, understand its basic quality issues, and keep control of what happens next.</p>
      </div>
      <div className="workspace-frame upload-workspace">
        <UploadProgress
          hasPendingReview={Boolean(session?.pending_change)}
          state={state}
        />
        <div className="workspace-main">
          {state === "restoring" ? (
            <div aria-label="Restoring spreadsheet session" className="workspace-state" role="status">
              <p className="eyebrow">Temporary session</p>
              <h3>Reopening your spreadsheet</h3>
              <p>Checking whether this session is still available.</p>
            </div>
          ) : null}

          {state === "uploading" ? (
            <div aria-label="Uploading spreadsheet" className="workspace-state" role="status">
              <p className="eyebrow">Upload in progress</p>
              <h3>Checking your spreadsheet</h3>
              <p>Reading the table and looking for basic quality issues.</p>
              <div aria-hidden="true" className="loading-bar"><span /></div>
            </div>
          ) : null}

          {isWaiting ? (
            <>
              <p className="eyebrow">New cleaning session</p>
              <h3>Start with your spreadsheet</h3>
              <p className="workspace-intro">
                Your file stays in temporary memory and expires after 30 minutes of inactivity.
              </p>
              {message ? (
                <div className="upload-message" role="alert">
                  <strong>{state === "expired" ? "That session has expired" : "We could not open that file"}</strong>
                  <p>{message}</p>
                </div>
              ) : null}
              <UploadPicker buttonLabel={message ? "Choose another file" : "Choose file"} onFile={uploadFile} />
            </>
          ) : null}

          {state === "success" && session ? (
            <>
              <p className="visually-hidden" role="status">
                Spreadsheet uploaded successfully. Preview and quality checks are ready.
              </p>
              <div className="workspace-success-heading">
                <div>
                  <p className="eyebrow">Spreadsheet ready</p>
                  <h3>Here’s what we found.</h3>
                  <p>Review the preview and basic quality checks before downloading.</p>
                </div>
                <button className="button button-outline" onClick={resetSession} type="button">
                  Upload another file
                </button>
              </div>
              <div className="file-summary">
                <article className="file-summary-card file-summary-name">
                  <strong>{session.filename}</strong>
                  <span>{session.sheet_name ? `First visible sheet: ${session.sheet_name}` : "CSV spreadsheet"}</span>
                </article>
                <article className="file-summary-card"><strong>{session.row_count.toLocaleString()}</strong><span>rows</span></article>
                <article className="file-summary-card"><strong>{session.column_count.toLocaleString()}</strong><span>columns</span></article>
                <article className="file-summary-card"><strong>{session.issue_count.toLocaleString()}</strong><span>issue groups</span></article>
              </div>
              {session.pending_change ? (
                <div className="pending-review-banner" role="status">
                  <div>
                    <strong>{session.pending_change.summary} is waiting for review</strong>
                    <p>The current table has not changed yet.</p>
                  </div>
                  <a className="button button-coral" href="/review-changes">
                    Review pending change
                  </a>
                </div>
              ) : null}
              {session.applied_change_count > 0 ? (
                <p className="approved-change-count">
                  {session.applied_change_count.toLocaleString()} approved{" "}
                  {session.applied_change_count === 1 ? "change" : "changes"}
                </p>
              ) : null}
              <IssueSummary
                disabled={Boolean(session.pending_change)}
                issues={session.issues}
                onReviewFix={setSelectedIssue}
              />
              <div className="preview-layout">
                <TablePreview session={session} />
                <div className="result-sidebar">
                  <ValidationCard
                    busy={operationState === "working"}
                    error={operationMessage}
                    key={`${session.session_id}:${session.revision}`}
                    onRunValidation={runValidation}
                    session={session}
                    validatedExportUrl={validatedExportUrl}
                  />
                  <aside className="suggestions-card">
                    <p className="eyebrow">Current result</p>
                    <h4>Download current table</h4>
                    <p>
                      {session.validation_status === "passed"
                        ? "Validation has passed for the current table."
                        : session.validation_status === "failed"
                          ? "Validation found blockers. You can still download, but review the report first."
                          : "Only approved changes are included. Formal validation has not run yet."}
                    </p>
                    {session.download_warnings.map((warning) => (
                      <div className="download-warning" key={warning.code}>
                        <strong>{warning.title}</strong>
                        <p>{warning.message}</p>
                      </div>
                    ))}
                    {downloadUrl ? (
                      <a className="button button-forest download-button" href={downloadUrl}>
                        Download current CSV
                      </a>
                    ) : null}
                    <p className="download-note">
                      <strong>
                        {session.applied_change_count
                          ? `${session.applied_change_count} approved ${
                              session.applied_change_count === 1 ? "change is" : "changes are"
                            } included.`
                          : "Nothing has been changed yet."}
                      </strong>{" "}
                      Pending changes are never included.
                    </p>
                  </aside>
                </div>
              </div>
              {selectedIssue ? (
                <FixSidePanel
                  busy={operationState === "working"}
                  columns={session.columns}
                  error={operationMessage}
                  issue={selectedIssue}
                  key={selectedIssue.type}
                  onClose={() => setSelectedIssue(null)}
                  onPreview={previewChange}
                  onSubmit={async (action) => {
                    await submitChange(action);
                    setSelectedIssue(null);
                  }}
                />
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
