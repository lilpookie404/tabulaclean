import type { UploadIssue } from "../uploads/types";

interface IssueSummaryProps {
  issues: UploadIssue[];
  disabled?: boolean;
  onReviewFix?: (issue: UploadIssue) => void;
}

export default function IssueSummary({
  issues,
  disabled = false,
  onReviewFix
}: IssueSummaryProps) {
  if (issues.length === 0) {
    return (
      <div className="issues-empty">
        <strong>No basic issues detected</strong>
        <p>This first scan did not find missing values, duplicates, or format inconsistencies.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="issue-summary-heading">
      <div className="workspace-subheading">
        <div>
          <p className="eyebrow">Quality preview</p>
          <h4 id="issue-summary-heading">Detected issues</h4>
        </div>
        <span>{issues.length} grouped findings</span>
      </div>
      <div className="issue-grid">
        {issues.map((issue) => (
          <article className="issue-card" key={issue.type}>
            <strong>{issue.title}</strong>
            <p>{issue.message}</p>
            <span>{issue.affected_count.toLocaleString()} {issue.affected_unit}</span>
            {onReviewFix ? (
              <button
                className="issue-fix-button"
                disabled={disabled}
                onClick={() => onReviewFix(issue)}
                type="button"
              >
                Review fix
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
