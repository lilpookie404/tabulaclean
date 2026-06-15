import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_STORAGE_KEY } from "../uploads/useUploadSession";
import type { UploadSession } from "../uploads/types";
import ReviewChangesPage from "./ReviewChangesPage";

const pendingSession: UploadSession = {
  session_id: "session-123",
  filename: "contacts.csv",
  sheet_name: null,
  row_count: 2,
  column_count: 1,
  columns: [
    {
      id: "column_1",
      name: "name",
      position: 0,
      inferred_type: "text"
    }
  ],
  preview_rows: [
    { row_number: 2, values: { column_1: "Aarav" } },
    { row_number: 3, values: { column_1: "" } }
  ],
  issues: [],
  issue_count: 0,
  validation_status: "not_run",
  revision: 0,
  pending_change: {
    base_revision: 0,
    action_type: "fill_missing",
    summary: "Fill missing values",
    risk: "high",
    affected_count: 1,
    affected_unit: "cells",
    unresolved_count: 0,
    samples: [
      {
        row_number: 3,
        before: { column_1: null },
        after: { column_1: "Unknown" }
      }
    ],
    warnings: [],
    change_id: "change-1",
    action: {
      type: "fill_missing",
      column_id: "column_1",
      strategy: "explicit",
      value: "Unknown"
    },
    created_at: "2026-06-15T12:00:00Z"
  },
  applied_change_count: 0,
  can_undo: false,
  audit_log: [
    {
      event_id: "event-1",
      change_id: "change-1",
      action_type: "fill_missing",
      summary: "Fill missing values",
      risk: "high",
      status: "pending",
      affected_count: 1,
      affected_unit: "cells",
      column_ids: ["column_1"],
      timestamp: "2026-06-15T12:00:00Z",
      revision: 0
    }
  ],
  download_warnings: [],
  expires_at: "2026-06-15T12:30:00Z"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function renderPage() {
  render(
    <MemoryRouter>
      <ReviewChangesPage />
    </MemoryRouter>
  );
}

describe("ReviewChangesPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows a path back to upload when there is no active session", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Review Changes" })).toBeInTheDocument();
    expect(screen.getByText("No spreadsheet is open")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clean a file" })).toHaveAttribute(
      "href",
      "/"
    );
  });

  it("restores and displays the pending change with samples and history", async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, pendingSession.session_id);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(pendingSession))
    );
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Fill missing values" })
    ).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText("1 cell affected")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Activity history" })).toBeInTheDocument();
    expect(screen.getByText("Pending review")).toBeInTheDocument();
  });

  it("requires centered confirmation before approving", async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, pendingSession.session_id);
    const approved = {
      ...pendingSession,
      revision: 1,
      pending_change: null,
      applied_change_count: 1,
      can_undo: true
    };
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse(pendingSession))
        .mockResolvedValueOnce(jsonResponse(approved))
    );
    renderPage();
    await screen.findByRole("heading", { name: "Fill missing values" });

    fireEvent.click(screen.getByRole("button", { name: "Approve change" }));
    const dialog = screen.getByRole("dialog", { name: "Approve this change?" });
    expect(dialog).toHaveTextContent("This will update the current table");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Approve and apply" })
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(screen.getByText("No change is waiting for review")).toBeInTheDocument();
  });

  it("rejects without changing the table revision", async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, pendingSession.session_id);
    const rejected = { ...pendingSession, pending_change: null };
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse(pendingSession))
        .mockResolvedValueOnce(jsonResponse(rejected))
    );
    renderPage();
    await screen.findByRole("heading", { name: "Fill missing values" });

    fireEvent.click(screen.getByRole("button", { name: "Reject change" }));

    expect(await screen.findByText("No change is waiting for review")).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/sessions/session-123/changes/change-1/reject",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ expected_revision: 0 })
      })
    );
  });

  it("offers undo and confirmed reset for applied history", async () => {
    const applied = {
      ...pendingSession,
      revision: 2,
      pending_change: null,
      applied_change_count: 2,
      can_undo: true
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, applied.session_id);
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse(applied))
        .mockResolvedValueOnce(jsonResponse({ ...applied, revision: 3 }))
        .mockResolvedValueOnce(
          jsonResponse({
            ...applied,
            revision: 4,
            applied_change_count: 0,
            can_undo: false
          })
        )
    );
    renderPage();
    await screen.findByText("No change is waiting for review");

    fireEvent.click(screen.getByRole("button", { name: "Undo latest" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Reset to original" }));
    const dialog = screen.getByRole("dialog", { name: "Reset to the original file?" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Reset everything" })
    );

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
  });

  it("shows a friendly expired-session message", async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, pendingSession.session_id);
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
    renderPage();

    expect(
      await screen.findByText("Your temporary session expired")
    ).toBeInTheDocument();
  });
});
