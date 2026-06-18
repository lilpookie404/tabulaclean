import type { SuggestedAction, SuggestionResult, UploadIssue } from "../uploads/types";

interface IssueSummaryProps {
  issues: UploadIssue[];
  disabled?: boolean;
  busy?: boolean;
  suggestionResult?: SuggestionResult | null;
  onGenerateSuggestions?: () => Promise<unknown>;
  onReviewFix?: (issue: UploadIssue) => void;
  onPreviewSuggestion?: (issue: UploadIssue, suggestion: SuggestedAction) => void;
}

export default function IssueSummary({
  issues,
  disabled = false,
  busy = false,
  suggestionResult,
  onGenerateSuggestions,
  onPreviewSuggestion,
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

  const suggestionsByIssue = new Map<string, SuggestedAction[]>();
  for (const suggestion of suggestionResult?.suggestions ?? []) {
    const grouped = suggestionsByIssue.get(suggestion.issue_type) ?? [];
    grouped.push(suggestion);
    suggestionsByIssue.set(suggestion.issue_type, grouped);
  }

  return (
    <section aria-labelledby="issue-summary-heading">
      <div className="workspace-subheading">
        <div>
          <p className="eyebrow">Quality preview</p>
          <h4 id="issue-summary-heading">Detected issues</h4>
        </div>
        <div className="issue-summary-actions">
          <span>{issues.length} grouped findings</span>
          {onGenerateSuggestions ? (
            <button
              className="button button-outline issue-suggestion-generate"
              disabled={disabled || busy}
              onClick={() => void onGenerateSuggestions().catch(() => undefined)}
              type="button"
            >
              {busy ? "Generating suggestions" : "Generate suggestions"}
            </button>
          ) : null}
        </div>
      </div>
      {suggestionResult ? (
        <p className="suggestion-status">
          {suggestionResult.mode === "ai_enhanced"
            ? "AI-ranked suggestions are ready."
            : "Local suggestions are ready."}{" "}
          {suggestionResult.model_message}
        </p>
      ) : null}
      <div className="issue-grid">
        {issues.map((issue) => (
          <article className="issue-card" key={issue.type}>
            <strong>{issue.title}</strong>
            <p>{issue.message}</p>
            <span>{issue.affected_count.toLocaleString()} {issue.affected_unit}</span>
            {(suggestionsByIssue.get(issue.type) ?? []).map((suggestion) => (
              <div className="issue-suggestion" key={suggestion.suggestion_id}>
                <strong>{suggestion.title}</strong>
                <p>{suggestion.rationale}</p>
                <small>
                  {suggestion.source === "ai" ? "AI-ranked" : "Local"} ·{" "}
                  {suggestion.confidence} confidence
                </small>
                {onPreviewSuggestion ? (
                  <button
                    className="issue-fix-button"
                    disabled={disabled || busy}
                    onClick={() => onPreviewSuggestion(issue, suggestion)}
                    type="button"
                  >
                    Preview suggestion
                  </button>
                ) : null}
              </div>
            ))}
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
