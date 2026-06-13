import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CleanMyFilePage from "./CleanMyFilePage";

describe("CleanMyFilePage", () => {
  it("presents the product story with a Phase 2 upload boundary", () => {
    const { container } = render(<CleanMyFilePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Messy data,\s*made clear\./
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Useful features,\s*told like a story/
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Playful motion, never at the cost of clarity."
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Upload controls arrive in Phase 2")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });
});
