import StatusCard from "./StatusCard";

const steps = [
  { number: "01", title: "Preview", description: "Understand detected issues" },
  { number: "02", title: "Review", description: "Check suggested fixes" },
  { number: "03", title: "Validate", description: "Confirm data quality" },
  { number: "04", title: "Download", description: "Keep the clean result" }
];

export default function WorkspacePreview() {
  return (
    <section
      className="workspace-section"
      data-cursor-tone="forest"
      id="workspace"
    >
      <div className="section-heading">
        <h2>
          Expressive outside.
          <br />
          Focused inside.
        </h2>
        <p>
          The workspace stays quiet, legible, and trustworthy while TabulaClean
          guides each decision.
        </p>
      </div>
      <div className="workspace-frame">
        <aside aria-label="Workflow preview" className="workspace-sidebar">
          <span className="workspace-brand">TabulaClean</span>
          <span className="workspace-link active">Clean My File</span>
          <span className="workspace-link">Review Changes</span>
          <span className="workspace-link">Model Evaluation</span>
          <span className="workspace-link">Failure Cases</span>
          <p>
            Advanced evaluation stays available without dominating the product.
          </p>
        </aside>
        <div className="workspace-main">
          <p className="eyebrow">New cleaning session</p>
          <h3>Start with your spreadsheet</h3>
          <div aria-disabled="true" className="upload-placeholder">
            <span aria-hidden="true">+</span>
            <strong>CSV and Excel workspace</strong>
            <p>Upload controls arrive in Phase 2</p>
          </div>
          <div className="status-grid">
            {steps.map((step) => (
              <StatusCard key={step.number} {...step} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
