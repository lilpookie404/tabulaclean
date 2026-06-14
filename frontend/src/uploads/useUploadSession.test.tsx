import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_STORAGE_KEY,
  useUploadSession
} from "./useUploadSession";
import type { UploadSession } from "./types";

const session: UploadSession = {
  session_id: "session-123",
  filename: "contacts.csv",
  sheet_name: null,
  row_count: 2,
  column_count: 2,
  columns: [
    {
      id: "column_1",
      name: "name",
      position: 0,
      inferred_type: "text"
    },
    {
      id: "column_2",
      name: "amount",
      position: 1,
      inferred_type: "integer"
    }
  ],
  preview_rows: [
    {
      row_number: 2,
      values: { column_1: "Aarav", column_2: "10" }
    }
  ],
  issues: [
    {
      type: "numeric_text",
      title: "Numbers appear to be stored as text",
      message: "1 column contains numeric-looking text values.",
      affected_count: 2,
      affected_unit: "values",
      affected_columns: ["column_2"],
      example_rows: [2, 3]
    }
  ],
  issue_count: 1,
  validation_status: "not_run",
  audit_log: [],
  expires_at: "2026-06-14T12:30:00Z"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("useUploadSession", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("starts in the initial state without a saved session", () => {
    const { result } = renderHook(() => useUploadSession());

    expect(result.current.state).toBe("initial");
    expect(result.current.session).toBeNull();
  });

  it("moves through uploading to success and saves only the session id", async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          })
      )
    );
    const { result } = renderHook(() => useUploadSession());
    const file = new File(["name\nAarav\n"], "contacts.csv", {
      type: "text/csv"
    });

    let uploadPromise: Promise<void>;
    act(() => {
      uploadPromise = result.current.uploadFile(file);
    });
    expect(result.current.state).toBe("uploading");

    await act(async () => {
      resolveFetch?.(jsonResponse(session, 201));
      await uploadPromise;
    });

    expect(result.current.state).toBe("success");
    expect(result.current.session).toEqual(session);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBe("session-123");
    expect(sessionStorage.length).toBe(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/uploads",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows a friendly backend upload error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            code: "unsupported_file_type",
            message: "Please choose a CSV or XLSX spreadsheet."
          },
          415
        )
      )
    );
    const { result } = renderHook(() => useUploadSession());

    await act(async () => {
      await result.current.uploadFile(
        new File(["notes"], "notes.txt", { type: "text/plain" })
      );
    });

    expect(result.current.state).toBe("error");
    expect(result.current.message).toBe(
      "Please choose a CSV or XLSX spreadsheet."
    );
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("restores a saved same-tab session", async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, session.session_id);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(session))
    );

    const { result } = renderHook(() => useUploadSession());

    expect(result.current.state).toBe("restoring");
    await waitFor(() => expect(result.current.state).toBe("success"));
    expect(result.current.session).toEqual(session);
    expect(fetch).toHaveBeenCalledWith(
      "/api/sessions/session-123",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("clears an expired saved session and reports it gently", async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, session.session_id);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            code: "session_not_found",
            message: "This temporary upload session is no longer available."
          },
          404
        )
      )
    );

    const { result } = renderHook(() => useUploadSession());

    await waitFor(() => expect(result.current.state).toBe("expired"));
    expect(result.current.message).toBe(
      "Your temporary session expired. Please upload the file again."
    );
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("resets the visible session without calling a delete endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(session, 201))
    );
    const { result } = renderHook(() => useUploadSession());
    await act(async () => {
      await result.current.uploadFile(
        new File(["name\nAarav\n"], "contacts.csv")
      );
    });

    act(() => {
      result.current.resetSession();
    });

    expect(result.current.state).toBe("initial");
    expect(result.current.session).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("builds the CSV download URL for a successful session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(session, 201))
    );
    const { result } = renderHook(() => useUploadSession());
    await act(async () => {
      await result.current.uploadFile(
        new File(["name\nAarav\n"], "contacts.csv")
      );
    });

    expect(result.current.downloadUrl).toBe(
      "/api/sessions/session-123/download"
    );
  });
});
