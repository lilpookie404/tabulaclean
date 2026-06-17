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
  revision: 0,
  pending_change: null,
  applied_change_count: 0,
  can_undo: false,
  download_warnings: [],
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
    expect(result.current.validatedExportUrl).toBeNull();
  });

  it("runs validation and exposes the validated export URL", async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, session.session_id);
    const validated = {
      ...session,
      validation_status: "failed",
      validation_result: {
        status: "failed",
        revision: 0,
        required_column_ids: ["column_2"],
        ran_at: "2026-06-15T12:00:00Z",
        summary: { errors: 1, warnings: 1, passed: 2 },
        checks: [
          {
            check_id: "required_columns",
            title: "Required columns",
            status: "failed",
            severity: "error",
            message: "1 required cells are still blank.",
            affected_count: 1,
            affected_columns: ["column_2"],
            example_rows: [3]
          }
        ]
      }
    };
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse(session))
        .mockResolvedValueOnce(jsonResponse(validated))
    );
    const { result } = renderHook(() => useUploadSession());
    await waitFor(() => expect(result.current.state).toBe("success"));

    await act(async () => {
      await result.current.runValidation(["column_2"]);
    });

    expect(result.current.session).toEqual(validated);
    expect(result.current.validatedExportUrl).toBe(
      "/api/sessions/session-123/validated-export"
    );
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/sessions/session-123/validations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          expected_revision: 0,
          required_column_ids: ["column_2"]
        })
      })
    );
  });

  it("previews a change without replacing the current session", async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, session.session_id);
    const preview = {
      base_revision: 0,
      action_type: "trim_whitespace",
      summary: "Trim extra spaces",
      risk: "low",
      affected_count: 1,
      affected_unit: "values",
      unresolved_count: 0,
      samples: [
        {
          row_number: 2,
          before: { column_1: " Aarav " },
          after: { column_1: "Aarav" }
        }
      ],
      warnings: []
    };
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse(session))
        .mockResolvedValueOnce(jsonResponse(preview))
    );
    const { result } = renderHook(() => useUploadSession());
    await waitFor(() => expect(result.current.state).toBe("success"));

    let received;
    await act(async () => {
      received = await result.current.previewChange({
        type: "trim_whitespace",
        column_ids: ["column_1"]
      });
    });

    expect(received).toEqual(preview);
    expect(result.current.session).toEqual(session);
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/sessions/session-123/change-previews",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          expected_revision: 0,
          action: {
            type: "trim_whitespace",
            column_ids: ["column_1"]
          }
        })
      })
    );
  });

  it("submits a change and replaces the session snapshot", async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, session.session_id);
    const updated = {
      ...session,
      revision: 1,
      applied_change_count: 1,
      can_undo: true,
      audit_log: [
        {
          event_id: "event-1",
          change_id: "change-1",
          action_type: "trim_whitespace",
          summary: "Trim extra spaces",
          risk: "low",
          status: "applied",
          affected_count: 1,
          affected_unit: "values",
          column_ids: ["column_1"],
          timestamp: "2026-06-15T12:00:00Z",
          revision: 1
        }
      ]
    };
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse(session))
        .mockResolvedValueOnce(jsonResponse(updated))
    );
    const { result } = renderHook(() => useUploadSession());
    await waitFor(() => expect(result.current.state).toBe("success"));

    await act(async () => {
      await result.current.submitChange({
        type: "trim_whitespace",
        column_ids: ["column_1"]
      });
    });

    expect(result.current.session).toEqual(updated);
    expect(result.current.operationState).toBe("idle");
  });

  it("approves, rejects, undoes, and resets through revisioned endpoints", async () => {
    const pending = {
      ...session,
      pending_change: {
        base_revision: 0,
        action_type: "rename_column",
        summary: "Rename a column",
        risk: "high",
        affected_count: 1,
        affected_unit: "column",
        unresolved_count: 0,
        samples: [],
        warnings: [],
        change_id: "change-1",
        action: {
          type: "rename_column",
          column_id: "column_1",
          new_name: "Customer"
        },
        created_at: "2026-06-15T12:00:00Z"
      }
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, session.session_id);
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse(pending))
        .mockResolvedValueOnce(jsonResponse({ ...session, revision: 1 }))
        .mockResolvedValueOnce(jsonResponse(session))
        .mockResolvedValueOnce(jsonResponse({ ...session, revision: 2 }))
        .mockResolvedValueOnce(jsonResponse({ ...session, revision: 3 }))
    );
    const { result } = renderHook(() => useUploadSession());
    await waitFor(() => expect(result.current.state).toBe("success"));

    await act(async () => {
      await result.current.approvePending();
      await result.current.rejectPending("change-2");
      await result.current.undoLatest();
      await result.current.resetToOriginal();
    });

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/sessions/session-123/changes/change-1/approve",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "/api/sessions/session-123/changes/change-2/reject",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      "/api/sessions/session-123/undo",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      5,
      "/api/sessions/session-123/reset",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("refreshes the snapshot after a stale revision error", async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, session.session_id);
    const refreshed = { ...session, revision: 2 };
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse(session))
        .mockResolvedValueOnce(
          jsonResponse(
            {
              code: "stale_revision",
              message: "This spreadsheet changed in another view."
            },
            409
          )
        )
        .mockResolvedValueOnce(jsonResponse(refreshed))
    );
    const { result } = renderHook(() => useUploadSession());
    await waitFor(() => expect(result.current.state).toBe("success"));

    await act(async () => {
      await expect(
        result.current.submitChange({
          type: "trim_whitespace",
          column_ids: ["column_1"]
        })
      ).rejects.toThrow("This spreadsheet changed in another view.");
    });

    expect(result.current.session).toEqual(refreshed);
    expect(result.current.operationMessage).toContain("changed");
  });
});
