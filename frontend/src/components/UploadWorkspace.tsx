import { type ChangeEvent, type DragEvent, useRef, useState } from "react";
import { useUploadSession } from "../uploads/useUploadSession";
import IssueSummary from "./IssueSummary";
import TablePreview from "./TablePreview";
import UploadProgress from "./UploadProgress";

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
  const { state, session, message, uploadFile, resetSession, downloadUrl } =
    useUploadSession();
  const isWaiting = state === "initial" || state === "error" || state === "expired";

  return (
    <section className="workspace-section" data-cursor-tone="forest" id="workspace">
      <div className="section-heading">
        <h2>Expressive outside.<br />Focused inside.</h2>
        <p>Upload a spreadsheet, understand its basic quality issues, and keep control of what happens next.</p>
      </div>
      <div className="workspace-frame upload-workspace">
        <UploadProgress state={state} />
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
              <IssueSummary issues={session.issues} />
              <div className="preview-layout">
                <TablePreview session={session} />
                <aside className="suggestions-card">
                  <p className="eyebrow">Next phase</p>
                  <h4>Suggested fixes</h4>
                  <span className="phase-badge">Available in Phase 3</span>
                  <p>TabulaClean will explain possible changes and ask for approval where the result could be risky.</p>
                  {downloadUrl ? (
                    <a className="button button-forest download-button" href={downloadUrl}>
                      Download current CSV
                    </a>
                  ) : null}
                  <p className="download-note">
                    <strong>Nothing has been changed yet.</strong> This download contains the current uploaded table.
                  </p>
                </aside>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
