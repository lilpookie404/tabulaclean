import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CustomCursor from "./CustomCursor";

function mockMatchMedia({
  finePointer,
  reducedMotion
}: {
  finePointer: boolean;
  reducedMotion: boolean;
}) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches:
        query === "(pointer: fine)" ? finePointer : reducedMotion,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  );
}

describe("CustomCursor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders for a fine pointer without reduced motion", () => {
    mockMatchMedia({ finePointer: true, reducedMotion: false });

    const { unmount } = render(<CustomCursor />);

    expect(screen.getByTestId("custom-cursor")).toBeInTheDocument();
    expect(document.body).toHaveClass("custom-cursor-enabled");

    unmount();

    expect(document.body).not.toHaveClass("custom-cursor-enabled");
  });

  it("does not render when reduced motion is requested", () => {
    mockMatchMedia({ finePointer: true, reducedMotion: true });

    render(<CustomCursor />);

    expect(screen.queryByTestId("custom-cursor")).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass("custom-cursor-enabled");
  });

  it("follows the pointer and adopts the nearest section tone", () => {
    mockMatchMedia({ finePointer: true, reducedMotion: false });

    render(
      <>
        <CustomCursor />
        <section data-cursor-tone="forest">
          <div data-testid="forest-area">Workspace</div>
        </section>
      </>
    );

    fireEvent.pointerMove(screen.getByTestId("forest-area"), {
      clientX: 120,
      clientY: 240
    });

    expect(screen.getByTestId("custom-cursor")).toHaveAttribute(
      "data-tone",
      "forest"
    );
    expect(screen.getByTestId("custom-cursor")).toHaveStyle({
      transform: "translate3d(120px, 240px, 0)"
    });
  });

  it("hides over interactive controls", () => {
    mockMatchMedia({ finePointer: true, reducedMotion: false });

    render(
      <>
        <CustomCursor />
        <a href="#workspace">Explore</a>
      </>
    );

    fireEvent.pointerMove(screen.getByRole("link", { name: "Explore" }));

    expect(screen.getByTestId("custom-cursor")).toHaveClass("is-hidden");
  });
});
