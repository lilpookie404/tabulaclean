import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject
} from "react-router-dom";
import { describe, expect, it } from "vitest";
import { appRoutes } from "./router";

function renderRoute(path: string, routes: RouteObject[] = appRoutes) {
  const router = createMemoryRouter(routes, {
    initialEntries: [path]
  });

  render(<RouterProvider router={router} />);
}

describe("app routes", () => {
  it("renders the Clean My File page at the root route", () => {
    renderRoute("/");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Messy data,\s*made clear\./
      })
    ).toBeInTheDocument();
  });

  it("navigates to Review Changes from the primary navigation", async () => {
    renderRoute("/");

    const primaryNavigation = screen.getByRole("navigation", {
      name: "Primary navigation"
    });
    expect(
      within(primaryNavigation).queryByRole("link", { name: "Model Evaluation" })
    ).not.toBeInTheDocument();
    expect(
      within(primaryNavigation).queryByRole("link", { name: "Failure Cases" })
    ).not.toBeInTheDocument();

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

  it("redirects /review to the canonical Review Changes route", async () => {
    renderRoute("/review");

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

    expect(
      screen.getByRole("heading", { level: 1, name: "Model Evaluation" })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe("Model Evaluation | TabulaClean");
    });
  });

  it("keeps the failure cases route available by direct URL", async () => {
    renderRoute("/failure-cases");

    expect(
      screen.getByRole("heading", { level: 1, name: "Failure Cases" })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe("Failure Cases | TabulaClean");
    });
  });

  it("keeps the application shell around a friendly route error", async () => {
    const rootRoute = appRoutes[0];
    const routesWithFailure: RouteObject[] = [
      {
        path: rootRoute.path,
        element: rootRoute.element,
        errorElement: rootRoute.errorElement,
        children: [
          ...(rootRoute.children ?? []),
          {
            path: "route-error-test",
            loader: () => {
              throw new Error("Sensitive internal details");
            },
            element: <div />
          }
        ]
      }
    ];

    renderRoute("/route-error-test", routesWithFailure);

    expect(
      await screen.findByRole("link", { name: "TabulaClean" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Primary navigation" })
    ).toBeInTheDocument();

    const main = screen.getByRole("main");
    expect(
      within(main).getByRole("heading", {
        level: 1,
        name: "We could not open this page"
      })
    ).toBeInTheDocument();
    expect(
      within(main).getByText(
        "Something went wrong while opening this page. Please return to Clean My File and try again."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Sensitive internal details")
    ).not.toBeInTheDocument();
  });

  it("normalizes a trailing slash when updating the document title", async () => {
    renderRoute("/model-evaluation/");

    await waitFor(() => {
      expect(document.title).toBe("Model Evaluation | TabulaClean");
    });
  });
});
