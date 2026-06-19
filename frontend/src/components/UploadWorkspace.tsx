import { type ChangeEvent, type DragEvent, useRef, useState } from "react";
import { useUploadSession } from "../uploads/useUploadSession";
import type { CleaningAction, UploadIssue } from "../uploads/types";
import FixSidePanel from "./FixSidePanel";
import IssueSummary from "./IssueSummary";
import TablePreview from "./TablePreview";
import UploadProgress from "./UploadProgress";
import ValidationCard from "./ValidationCard";

const FEEDBACK_URL = "https://github.com/lilpookie404/tabulaclean/issues";

const HOW_IT_WORKS_STEPS = [
  "Upload a file",
  "Review detected issues",
  "Preview and apply fixes",
  "Validate required columns",
  "Download the cleaned CSV"
];

const SAMPLE_FILES = [
  {
    id: "contacts",
    label: "Try sample contacts CSV",
    filename: "messy-contacts.csv",
    href: "/samples/messy-contacts.csv"
  },
  {
    id: "sales",
    label: "Try sample sales CSV",
    filename: "sales-cleaning-demo.csv",
    href: "/samples/sales-cleaning-demo.csv"
  }
];

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

interface SampleFileActionsProps {
  busy: boolean;
  loadingSampleId: string | null;
  onSampleFile: (sample: (typeof SAMPLE_FILES)[number]) => void;
}

function SampleFileActions({
  busy,
  loadingSampleId,
  onSampleFile
}: SampleFileActionsProps) {
  return (
    <div className="sample-actions" aria-label="Sample files">
      <p className="sample-actions-label">No file handy?</p>
      <div>
        {SAMPLE_FILES.map((sample) => (
          <button
            className="button button-outline sample-button"
            disabled={busy}
            key={sample.id}
            onClick={() => onSampleFile(sample)}
            type="button"
          >
            {loadingSampleId === sample.id ? "Loading sample" : sample.label}
          </button>
        ))}
      </div>
    </div>
  );
}

async function sampleToFile(sample: (typeof SAMPLE_FILES)[number]) {
  const response = await fetch(sample.href);
  if (!response.ok) {
    throw new Error("We could not load that sample file. Please try uploading your own CSV.");
  }
  const blob = await response.blob();
  return new File([blob], sample.filename, { type: "text/csv" });
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
    submitChange,
    generateSuggestions,
    runValidation,
    validatedExportUrl
  } = useUploadSession();
  const [selectedFix, setSelectedFix] = useState<{
    issue: UploadIssue;
    action?: CleaningAction;
    autoPreview?: boolean;
    key: string;
  } | null>(null);
  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const isWaiting = state === "initial" || state === "error" || state === "expired";
  const uploadBusy = state === "uploading" || loadingSampleId !== null;
  const uploadAlertMessage = sampleError ?? message;
  const uploadAlertTitle = sampleError
    ? "We could not open that sample"
    : state === "expired"
      ? "That session has expired"
      : "We could not open that file";

  const uploadSample = async (sample: (typeof SAMPLE_FILES)[number]) => {
    setLoadingSampleId(sample.id);
    setSampleError(null);
    try {
      const file = await sampleToFile(sample);
      await uploadFile(file);
    } catch (error) {
      setSampleError(
        error instanceof Error
          ? error.message
          : "We could not load that sample file. Please try uploading your own CSV."
      );
    } finally {
      setLoadingSampleId(null);
    }
  };

  return (
    <section className="workspace-section" data-cursor-tone="forest" id="workspace">
      <div className="section-heading">
        <h2>Upload, clean, validate.</h2>
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
                Upload a CSV or Excel file to detect messy data, preview fixes,
                validate the cleaned result, and download a safer CSV.
              </p>
              {uploadAlertMessage ? (
                <div className="upload-message" role="alert">
                  <strong>{uploadAlertTitle}</strong>
                  <p>{uploadAlertMessage}</p>
                </div>
              ) : null}
              <UploadPicker
                busy={uploadBusy}
                buttonLabel={message ? "Choose another file" : "Choose file"}
                onFile={(file) => {
                  setSampleError(null);
                  void uploadFile(file);
                }}
              />
              <SampleFileActions
                busy={uploadBusy}
                loadingSampleId={loadingSampleId}
                onSampleFile={(sample) => void uploadSample(sample)}
              />
              <div className="first-use-grid">
                <section className="how-it-works" aria-labelledby="how-it-works-heading">
                  <h4 id="how-it-works-heading">How it works</h4>
                  <ol>
                    {HOW_IT_WORKS_STEPS.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </section>
                <aside className="demo-notice">
                  <strong>Public demo</strong>
                  <p>
                    Public demo: files are processed temporarily in memory and
                    expire automatically. Please do not upload sensitive,
                    personal, financial, or confidential data.
                  </p>
                  <a className="feedback-link" href={FEEDBACK_URL}>
                    Found a bug? Send feedback
                  </a>
                </aside>
              </div>
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
                busy={operationState === "working"}
                disabled={Boolean(session.pending_change)}
                issues={session.issues}
                onGenerateSuggestions={() => generateSuggestions(false)}
                onPreviewSuggestion={(issue, suggestion) =>
                  setSelectedFix({
                    issue,
                    action: suggestion.action,
                    autoPreview: true,
                    key: suggestion.suggestion_id
                  })
                }
                onReviewFix={(issue) =>
                  setSelectedFix({
                    issue,
                    key: issue.type
                  })
                }
                suggestionResult={session.suggestion_result}
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
                          ? "Validation failed, but you can still download the CSV."
                          : "Validation has not been run yet. You can still download the current CSV."}
                    </p>
                    <p>This download includes only approved changes.</p>
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
                          : "No cleaning has occurred yet."}
                      </strong>{" "}
                      Pending review changes are not included in downloads.
                    </p>
                  </aside>
                </div>
              </div>
              {selectedFix ? (
                <FixSidePanel
                  autoPreview={selectedFix.autoPreview}
                  busy={operationState === "working"}
                  columns={session.columns}
                  error={operationMessage}
                  initialAction={selectedFix.action}
                  issue={selectedFix.issue}
                  key={selectedFix.key}
                  onClose={() => setSelectedFix(null)}
                  onPreview={previewChange}
                  onSubmit={async (action) => {
                    await submitChange(action);
                    setSelectedFix(null);
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
