import type { UploadSession } from "./types";

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

async function readResponse(response: Response): Promise<UploadSession> {
  const payload = (await response.json().catch(() => ({}))) as
    | UploadSession
    | ApiErrorPayload;
  if (!response.ok) {
    const error = payload as ApiErrorPayload;
    throw new UploadApiError(
      error.message ?? "We could not process that spreadsheet. Please try again.",
      error.code ?? "upload_failed",
      response.status
    );
  }
  return payload as UploadSession;
}

export async function uploadSpreadsheet(file: File): Promise<UploadSession> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/uploads", {
    method: "POST",
    body: formData
  });
  return readResponse(response);
}

export async function fetchUploadSession(
  sessionId: string,
  signal?: AbortSignal
): Promise<UploadSession> {
  const response = await fetch(
    `/api/sessions/${encodeURIComponent(sessionId)}`,
    { signal }
  );
  return readResponse(response);
}
