export type FriendlyType =
  | "text"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "datetime"
  | "mixed"
  | "empty";

export interface UploadColumn {
  id: string;
  name: string;
  position: number;
  inferred_type: FriendlyType;
}

export interface UploadPreviewRow {
  row_number: number;
  values: Record<string, unknown>;
}

export interface UploadIssue {
  type: string;
  title: string;
  message: string;
  affected_count: number;
  affected_unit: string;
  affected_columns: string[];
  example_rows: number[];
}

export type CleaningAction =
  | {
      type: "trim_whitespace";
      column_ids: string[];
    }
  | {
      type: "rename_column";
      column_id: string;
      new_name: string;
    }
  | {
      type: "fill_missing";
      column_id: string;
      strategy: "explicit" | "mean" | "median" | "most_common";
      value?: unknown;
    }
  | {
      type: "drop_duplicates";
      keep: "first" | "last";
    }
  | {
      type: "convert_numeric";
      column_id: string;
      target_type: "integer" | "decimal";
    }
  | {
      type: "drop_empty_columns";
      column_ids: string[];
    }
  | {
      type: "standardize_date";
      column_id: string;
      date_order: "month_first" | "day_first";
      output_format: "YYYY-MM-DD" | "MM/DD/YYYY" | "DD/MM/YYYY";
    };

export interface ChangeSample {
  row_number: number | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface ChangePreview {
  base_revision: number;
  action_type: CleaningAction["type"];
  summary: string;
  risk: "low" | "high";
  affected_count: number;
  affected_unit: string;
  unresolved_count: number;
  samples: ChangeSample[];
  warnings: string[];
}

export interface PendingChange extends ChangePreview {
  change_id: string;
  action: CleaningAction;
  created_at: string;
}

export interface AuditEntry {
  event_id: string;
  change_id: string | null;
  action_type: string;
  summary: string;
  risk: "low" | "high" | null;
  status: "applied" | "pending" | "approved" | "rejected" | "undone" | "reset";
  affected_count: number;
  affected_unit: string;
  column_ids: string[];
  timestamp: string;
  revision: number;
}

export interface DownloadWarning {
  code: string;
  title: string;
  message: string;
  affected_count: number;
}

export interface UploadSession {
  session_id: string;
  filename: string;
  sheet_name: string | null;
  row_count: number;
  column_count: number;
  columns: UploadColumn[];
  preview_rows: UploadPreviewRow[];
  issues: UploadIssue[];
  issue_count: number;
  validation_status: string;
  audit_log: AuditEntry[];
  revision: number;
  pending_change: PendingChange | null;
  applied_change_count: number;
  can_undo: boolean;
  download_warnings: DownloadWarning[];
  expires_at: string;
}

export type UploadViewState =
  | "initial"
  | "restoring"
  | "uploading"
  | "success"
  | "error"
  | "expired";

export type UploadOperationState = "idle" | "working" | "error";
