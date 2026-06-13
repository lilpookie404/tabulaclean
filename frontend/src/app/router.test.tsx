import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { appRoutes } from "./router";

function renderRoute(path: string) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path]
  });

  render(<RouterProvider router={router} />);
}

describe("app routes", () => {
  it("renders the Clean My File page at the root route", () => {
    renderRoute("/");

    expect(
      screen.getByRole("heading", { level: 1, name: "Clean My File" })
    ).toBeInTheDocument();
  });

  it("navigates to Review Changes from the primary navigation", async () => {
    renderRoute("/");

    const primaryNavigation = screen.getByRole("navigation", {
      name: "Primary navigation"
    });
    fireEvent.click(
      within(primaryNavigation).getByRole("link", { name: "Review Changes" })
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Review Changes"
      })
    ).toBeInTheDocument();
  });

  it("renders the not-found page for an unknown route", () => {
    renderRoute("/not-a-real-page");

    expect(
      screen.getByRole("heading", { level: 1, name: "Page not found" })
    ).toBeInTheDocument();
  });

  it("updates the document title for the model evaluation route", async () => {
    renderRoute("/model-evaluation");

    await waitFor(() => {
      expect(document.title).toBe("Model Evaluation | TabulaClean");
    });
  });
});
