import type { UploadViewState } from "../uploads/types";

interface UploadProgressProps {
  state: UploadViewState;
}

const steps = [
  { number: 1, title: "Upload", initial: "Choose a spreadsheet", success: "Spreadsheet received" },
  { number: 2, title: "Preview", initial: "Review data and issues", success: "Review data and issues" },
  { number: 3, title: "Review fixes", initial: "Approve suggested changes", success: "Approve suggested changes", phase: "Phase 3" },
  { number: 4, title: "Download", initial: "Keep the current table", success: "Current CSV is ready" }
];

export default function UploadProgress({ state }: UploadProgressProps) {
  const hasSession = state === "success";

  return (
    <aside aria-label="Cleaning progress" className="upload-progress">
      <p className="upload-progress-label">Your cleaning journey</p>
      <ol>
        {steps.map((step) => {
          const status =
            hasSession && step.number === 1
              ? "done"
              : hasSession && step.number === 2
                ? "current"
                : hasSession && step.number === 4
                  ? "ready"
                  : !hasSession && step.number === 1
                    ? "current"
                    : "upcoming";
          return (
            <li
              aria-current={status === "current" ? "step" : undefined}
              className={`upload-progress-step ${status}`}
              key={step.number}
            >
              <strong>{step.number} · {step.title}</strong>
              <span>{hasSession ? step.success : step.initial}</span>
              {step.phase ? <span className="phase-badge">{step.phase}</span> : null}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
