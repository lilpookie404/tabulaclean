import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CleanMyFilePage from "./CleanMyFilePage";
import type { UploadSession } from "../uploads/types";

const session: UploadSession = {
  session_id: "session-123",
  filename: "customer-contacts.xlsx",
  sheet_name: "Contacts",
  row_count: 1240,
  column_count: 3,
  columns: [
    {
      id: "column_1",
      name: "Customer",
      position: 0,
      inferred_type: "text"
    },
    {
      id: "column_2",
      name: "Email",
      position: 1,
      inferred_type: "text"
    },
    {
      id: "column_3",
      name: "Signup date",
      position: 2,
      inferred_type: "date"
    }
  ],
  preview_rows: [
    {
      row_number: 2,
      values: {
        column_1: "Aarav Shah",
        column_2: "aarav@example.com",
        column_3: "2026-02-14"
      }
    },
    {
      row_number: 3,
      values: {
        column_1: " Meera Joshi ",
        column_2: null,
        column_3: "14/03/2026"
      }
    }
  ],
  issues: [
    {
      type: "missing_values",
      title: "Some cells are empty",
      message: "1 empty cell was found in Email.",
      affected_count: 1,
      affected_unit: "cells",
      affected_columns: ["column_2"],
      example_rows: [3]
    },
    {
      type: "whitespace",
      title: "Extra spaces were detected",
      message: "1 value contains leading or trailing spaces.",
      affected_count: 1,
      affected_unit: "values",
      affected_columns: ["column_1"],
      example_rows: [3]
    }
  ],
  issue_count: 2,
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

describe("CleanMyFilePage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the public demo empty state and upload controls", () => {
    render(<CleanMyFilePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Messy data,\s*made clear\./
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Start with your spreadsheet" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Upload a CSV or Excel file to detect messy data, preview fixes, validate the cleaned result, and download a safer CSV."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument();
    expect(screen.getByText("Upload a file")).toBeInTheDocument();
    expect(screen.getByText("Review detected issues")).toBeInTheDocument();
    expect(screen.getByText("Preview and apply fixes")).toBeInTheDocument();
    expect(screen.getByText("Validate required columns")).toBeInTheDocument();
    expect(screen.getByText("Download the cleaned CSV")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Public demo: files are processed temporarily in memory and expire automatically. Please do not upload sensitive, personal, financial, or confidential data."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Choose a CSV or XLSX file")
    ).toHaveAttribute("accept", ".csv,.xlsx");
    expect(
      screen.getByRole("button", { name: "Choose file" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try sample contacts CSV" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try sample sales CSV" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Found a bug? Send feedback" })
    ).toHaveAttribute("href", "https://github.com/lilpookie404/tabulaclean/issues");

    const progress = screen.getByLabelText("Cleaning progress");
    expect(within(progress).getByText("1 · Upload")).toBeInTheDocument();
    expect(within(progress).getByText("2 · Preview")).toBeInTheDocument();
    expect(within(progress).getByText("3 · Review fixes")).toBeInTheDocument();
    expect(within(progress).getByText("4 · Validate")).toBeInTheDocument();
    expect(within(progress).getByText("5 · Download")).toBeInTheDocument();
  });

  it("loads a sample contacts CSV through the existing upload flow", async () => {
    const sampleSession = {
      ...session,
      filename: "messy-contacts.csv",
      sheet_name: null
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response("name,email\n Maya Chen ,maya@example.test\n", {
          status: 200,
          headers: { "Content-Type": "text/csv" }
        })
      )
      .mockResolvedValueOnce(jsonResponse(sampleSession, 201));
    vi.stubGlobal("fetch", fetchMock);
    render(<CleanMyFilePage />);

    fireEvent.click(screen.getByRole("button", { name: "Try sample contacts CSV" }));

    expect(await screen.findByText("Here’s what we found.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/samples/messy-contacts.csv");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/uploads",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData)
      })
    );
    const uploadedBody = fetchMock.mock.calls[1][1].body as FormData;
    const uploadedFile = uploadedBody.get("file") as File;
    expect(uploadedFile).toBeInstanceOf(File);
    expect(uploadedFile.name).toBe("messy-contacts.csv");
  });

  it("announces upload progress while parsing", async () => {
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
    render(<CleanMyFilePage />);

    fireEvent.change(screen.getByLabelText("Choose a CSV or XLSX file"), {
      target: {
        files: [
          new File(["name\nAarav\n"], "contacts.csv", { type: "text/csv" })
        ]
      }
    });

    expect(
      screen.getByRole("status", { name: "Uploading spreadsheet" })
    ).toHaveTextContent("Checking your spreadsheet");

    resolveFetch?.(jsonResponse(session, 201));
    await screen.findByText("Here’s what we found.");
  });

  it("displays the uploaded summary, issues, preview, and download", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(session, 201))
    );
    render(<CleanMyFilePage />);

    fireEvent.change(screen.getByLabelText("Choose a CSV or XLSX file"), {
      target: {
        files: [new File(["xlsx"], "customer-contacts.xlsx")]
      }
    });

    expect(await screen.findByText("Here’s what we found.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Spreadsheet uploaded successfully"
    );
    expect(screen.getByText("customer-contacts.xlsx")).toBeInTheDocument();
    expect(screen.getByText("First visible sheet: Contacts")).toBeInTheDocument();
    expect(screen.getByText("1,240")).toBeInTheDocument();
    expect(screen.getByText("3", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("2", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Some cells are empty")).toBeInTheDocument();
    expect(screen.getByText("Extra spaces were detected")).toBeInTheDocument();

    const table = screen.getByRole("table", { name: "Spreadsheet preview" });
    expect(within(table).getByText("Aarav Shah")).toBeInTheDocument();
    expect(within(table).getByText("Empty")).toBeInTheDocument();
    expect(within(table).getByText("date")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Download current table" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Validate current table" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email is required")).toBeChecked();
    expect(
      screen.getByText("No cleaning has occurred yet.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("This download includes only approved changes.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Pending review changes are not included in downloads.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Validation has not been run yet.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Download current CSV" })
    ).toHaveAttribute("href", "/api/sessions/session-123/download");
    expect(
      screen.getByRole("button", { name: "Upload another file" })
    ).toBeInTheDocument();
  });

  it("runs validation from the workspace and offers a validated ZIP", async () => {
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
          },
          {
            check_id: "remaining_issues",
            title: "Remaining quality warnings",
            status: "warning",
            severity: "warning",
            message: "2 quality issue groups still deserve review.",
            affected_count: 2,
            affected_columns: ["column_1", "column_2"],
            example_rows: [3]
          }
        ]
      }
    };
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse(session, 201))
        .mockResolvedValueOnce(jsonResponse(validated))
    );
    render(<CleanMyFilePage />);
    fireEvent.change(screen.getByLabelText("Choose a CSV or XLSX file"), {
      target: { files: [new File(["xlsx"], "customer-contacts.xlsx")] }
    });
    await screen.findByText("Here’s what we found.");

    fireEvent.click(screen.getByRole("button", { name: "Run validation" }));

    expect(await screen.findByText("Validation failed")).toBeInTheDocument();
    expect(
      screen.getByText("Validation failed, but you can still download the CSV.")
    ).toBeInTheDocument();
    expect(screen.getByText("1 required cells are still blank.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Download validation ZIP" })
    ).toHaveAttribute(
      "href",
      "/api/sessions/session-123/validated-export"
    );
  });

  it("generates issue-card suggestions and previews a suggested fix", async () => {
    const suggested = {
      ...session,
      suggestion_status: "ready",
      suggestion_result: {
        revision: 0,
        generated_at: "2026-06-18T12:00:00Z",
        mode: "local",
        model_status: "not_configured",
        model_message: "Model enhancement was not requested.",
        suggestions: [
          {
            suggestion_id: "whitespace-trim_whitespace-column_1",
            issue_type: "whitespace",
            title: "Trim padded text",
            rationale: "Remove leading and trailing spaces from affected text columns.",
            confidence: "high",
            source: "local",
            action: {
              type: "trim_whitespace",
              column_ids: ["column_1"]
            }
          }
        ]
      }
    };
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
          row_number: 3,
          before: { column_1: " Meera Joshi " },
          after: { column_1: "Meera Joshi" }
        }
      ],
      warnings: []
    };
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse(session, 201))
        .mockResolvedValueOnce(jsonResponse(suggested))
        .mockResolvedValueOnce(jsonResponse(preview))
    );
    render(<CleanMyFilePage />);
    fireEvent.change(screen.getByLabelText("Choose a CSV or XLSX file"), {
      target: { files: [new File(["xlsx"], "customer-contacts.xlsx")] }
    });
    await screen.findByText("Here’s what we found.");

    fireEvent.click(screen.getByRole("button", { name: "Generate suggestions" }));

    expect(await screen.findByText("Trim padded text")).toBeInTheDocument();
    expect(
      screen.getByText("Remove leading and trailing spaces from affected text columns.")
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/sessions/session-123/suggestions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          expected_revision: 0,
          use_model: false
        })
      })
    );

    const whitespaceCard = screen
      .getByText("Extra spaces were detected")
      .closest("article");
    fireEvent.click(
      within(whitespaceCard as HTMLElement).getByRole("button", {
        name: "Preview suggestion"
      })
    );

    const panel = await screen.findByRole("complementary", {
      name: "Review fix"
    });
    expect(await within(panel).findByText("Meera Joshi")).toBeInTheDocument();
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

  it("disables suggestion generation while a risky change is pending", async () => {
    const pendingPreview = {
      base_revision: 0,
      action_type: "fill_missing",
      summary: "Fill missing values",
      risk: "high",
      affected_count: 1,
      affected_unit: "cells",
      unresolved_count: 0,
      samples: [],
      warnings: []
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            ...session,
            pending_change: {
              ...pendingPreview,
              change_id: "change-1",
              action: {
                type: "fill_missing",
                column_id: "column_2",
                strategy: "most_common"
              },
              created_at: "2026-06-18T12:00:00Z"
            }
          },
          201
        )
      )
    );
    render(<CleanMyFilePage />);
    fireEvent.change(screen.getByLabelText("Choose a CSV or XLSX file"), {
      target: { files: [new File(["xlsx"], "customer-contacts.xlsx")] }
    });
    await screen.findByText("Here’s what we found.");

    expect(
      screen.getByRole("button", { name: "Generate suggestions" })
    ).toBeDisabled();
    expect(
      screen.getByText("Pending review changes are not included in downloads.")
    ).toBeInTheDocument();
  });

  it("opens a guided fix panel and applies a safe whitespace fix", async () => {
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
          row_number: 3,
          before: { column_1: " Meera Joshi " },
          after: { column_1: "Meera Joshi" }
        }
      ],
      warnings: []
    };
    const updated = {
      ...session,
      revision: 1,
      applied_change_count: 1,
      can_undo: true,
      issues: [session.issues[0]],
      issue_count: 1
    };
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse(session, 201))
        .mockResolvedValueOnce(jsonResponse(preview))
        .mockResolvedValueOnce(jsonResponse(updated))
    );
    render(<CleanMyFilePage />);
    fireEvent.change(screen.getByLabelText("Choose a CSV or XLSX file"), {
      target: { files: [new File(["xlsx"], "customer-contacts.xlsx")] }
    });
    await screen.findByText("Here’s what we found.");

    const whitespaceCard = screen
      .getByText("Extra spaces were detected")
      .closest("article");
    fireEvent.click(
      within(whitespaceCard as HTMLElement).getByRole("button", {
        name: "Review fix"
      })
    );

    const panel = await screen.findByRole("complementary", {
      name: "Review fix"
    });
    expect(within(panel).getByText("Trim extra spaces")).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Preview change" }));
    expect(await within(panel).findByText("Meera Joshi")).toBeInTheDocument();
    fireEvent.click(
      within(panel).getByRole("button", { name: "Apply safe fix" })
    );

    await waitFor(() =>
      expect(screen.queryByText("Extra spaces were detected")).not.toBeInTheDocument()
    );
    expect(screen.getByText("1 approved change")).toBeInTheDocument();
  });

  it("queues a risky fix and points the user to Review Changes", async () => {
    const preview = {
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
          before: { column_2: null },
          after: { column_2: "Unknown" }
        }
      ],
      warnings: []
    };
    const queued = {
      ...session,
      pending_change: {
        ...preview,
        change_id: "change-1",
        action: {
          type: "fill_missing",
          column_id: "column_2",
          strategy: "explicit",
          value: "Unknown"
        },
        created_at: "2026-06-15T12:00:00Z"
      }
    };
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse(session, 201))
        .mockResolvedValueOnce(jsonResponse(preview))
        .mockResolvedValueOnce(jsonResponse(queued))
    );
    render(<CleanMyFilePage />);
    fireEvent.change(screen.getByLabelText("Choose a CSV or XLSX file"), {
      target: { files: [new File(["xlsx"], "customer-contacts.xlsx")] }
    });
    await screen.findByText("Here’s what we found.");

    const missingCard = screen.getByText("Some cells are empty").closest("article");
    fireEvent.click(
      within(missingCard as HTMLElement).getByRole("button", {
        name: "Review fix"
      })
    );
    const panel = await screen.findByRole("complementary", {
      name: "Review fix"
    });
    fireEvent.change(within(panel).getByLabelText("Replacement value"), {
      target: { value: "Unknown" }
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Preview change" }));
    await within(panel).findByText("Unknown");
    fireEvent.click(
      within(panel).getByRole("button", { name: "Send to Review Changes" })
    );

    expect(
      await screen.findByRole("link", { name: "Review pending change" })
    ).toHaveAttribute("href", "/review-changes");
  });

  it("shows a friendly upload error and keeps retry controls available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            code: "invalid_file",
            message: "The spreadsheet could not be read."
          },
          422
        )
      )
    );
    render(<CleanMyFilePage />);

    fireEvent.change(screen.getByLabelText("Choose a CSV or XLSX file"), {
      target: { files: [new File(["bad"], "broken.xlsx")] }
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The spreadsheet could not be read.");
    expect(
      screen.getByRole("button", { name: "Choose another file" })
    ).toBeInTheDocument();
  });

  it("supports drag-and-drop selection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(session, 201))
    );
    render(<CleanMyFilePage />);
    const dropzone = screen.getByRole("region", {
      name: "Upload a CSV or XLSX spreadsheet"
    });

    fireEvent.dragEnter(dropzone, { dataTransfer: { files: [] } });
    expect(dropzone).toHaveTextContent("Drop your spreadsheet here");

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [new File(["name\nAarav\n"], "contacts.csv")]
      }
    });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });
});
