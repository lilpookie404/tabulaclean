import type {
  ChangePreview,
  CleaningAction,
  UploadSession
} from "./types";

interface ApiErrorPayload {
  code?: string;
  message?: string;
}

export class UploadApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "UploadApiError";
    this.code = code;
    this.status = status;
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as
    | T
    | ApiErrorPayload;
  if (!response.ok) {
    const error = payload as ApiErrorPayload;
    throw new UploadApiError(
      error.message ?? "We could not process that spreadsheet. Please try again.",
      error.code ?? "upload_failed",
      response.status
    );
  }
  return payload as T;
}

export async function uploadSpreadsheet(file: File): Promise<UploadSession> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/uploads", {
    method: "POST",
    body: formData
  });
  return readResponse<UploadSession>(response);
}

export async function fetchUploadSession(
  sessionId: string,
  signal?: AbortSignal
): Promise<UploadSession> {
  const response = await fetch(
    `/api/sessions/${encodeURIComponent(sessionId)}`,
    { signal }
  );
  return readResponse<UploadSession>(response);
}

function mutationBody(expectedRevision: number, action?: CleaningAction) {
  return JSON.stringify({
    expected_revision: expectedRevision,
    ...(action ? { action } : {})
  });
}

async function postJson<T>(url: string, body: string): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });
  return readResponse<T>(response);
}

export function previewUploadChange(
  sessionId: string,
  expectedRevision: number,
  action: CleaningAction
): Promise<ChangePreview> {
  return postJson<ChangePreview>(
    `/api/sessions/${encodeURIComponent(sessionId)}/change-previews`,
    mutationBody(expectedRevision, action)
  );
}

export function submitUploadChange(
  sessionId: string,
  expectedRevision: number,
  action: CleaningAction
): Promise<UploadSession> {
  return postJson<UploadSession>(
    `/api/sessions/${encodeURIComponent(sessionId)}/changes`,
    mutationBody(expectedRevision, action)
  );
}

export function approveUploadChange(
  sessionId: string,
  changeId: string,
  expectedRevision: number
): Promise<UploadSession> {
  return postJson<UploadSession>(
    `/api/sessions/${encodeURIComponent(sessionId)}/changes/${encodeURIComponent(changeId)}/approve`,
    mutationBody(expectedRevision)
  );
}

export function rejectUploadChange(
  sessionId: string,
  changeId: string,
  expectedRevision: number
): Promise<UploadSession> {
  return postJson<UploadSession>(
    `/api/sessions/${encodeURIComponent(sessionId)}/changes/${encodeURIComponent(changeId)}/reject`,
    mutationBody(expectedRevision)
  );
}

export function undoUploadChange(
  sessionId: string,
  expectedRevision: number
): Promise<UploadSession> {
  return postJson<UploadSession>(
    `/api/sessions/${encodeURIComponent(sessionId)}/undo`,
    mutationBody(expectedRevision)
  );
}

export function resetUploadChanges(
  sessionId: string,
  expectedRevision: number
): Promise<UploadSession> {
  return postJson<UploadSession>(
    `/api/sessions/${encodeURIComponent(sessionId)}/reset`,
    mutationBody(expectedRevision)
  );
}
