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
  audit_log: Record<string, unknown>[];
  expires_at: string;
}

export type UploadViewState =
  | "initial"
  | "restoring"
  | "uploading"
  | "success"
  | "error"
  | "expired";
