import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../styles/global.css";
import CustomCursor from "./CustomCursor";

type MediaQueryChangeListener =
  | ((event: MediaQueryListEvent) => void)
  | { handleEvent: (event: MediaQueryListEvent) => void };

function createMediaQueryList(media: string, initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<MediaQueryChangeListener>();

  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media,
    onchange: null,
    addEventListener: vi.fn(
      (_type: string, listener: MediaQueryChangeListener) => {
        listeners.add(listener);
      }
    ),
    removeEventListener: vi.fn(
      (_type: string, listener: MediaQueryChangeListener) => {
        listeners.delete(listener);
      }
    ),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  };

  return {
    mediaQueryList,
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      const event = { matches, media } as MediaQueryListEvent;

      listeners.forEach((listener) => {
        if (typeof listener === "function") {
          listener(event);
        } else {
          listener.handleEvent(event);
        }
      });
    }
  };
}

function mockMatchMedia({
  finePointer,
  reducedMotion
}: {
  finePointer: boolean;
  reducedMotion: boolean;
}) {
  const finePointerQuery = createMediaQueryList(
    "(pointer: fine)",
    finePointer
  );
  const reducedMotionQuery = createMediaQueryList(
    "(prefers-reduced-motion: reduce)",
    reducedMotion
  );

  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) =>
      query === "(pointer: fine)"
        ? finePointerQuery.mediaQueryList
        : reducedMotionQuery.mediaQueryList
    )
  );

  return {
    finePointerQuery,
    reducedMotionQuery
  };
}

describe("CustomCursor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

  it("disables the custom cursor when reduced motion changes", () => {
    const { reducedMotionQuery } = mockMatchMedia({
      finePointer: true,
      reducedMotion: false
    });
    const addWindowListener = vi.spyOn(window, "addEventListener");
    const removeWindowListener = vi.spyOn(window, "removeEventListener");

    render(<CustomCursor />);

    expect(screen.getByTestId("custom-cursor")).toBeInTheDocument();
    expect(document.body).toHaveClass("custom-cursor-enabled");

    const pointerMoveListener = addWindowListener.mock.calls.find(
      ([type]) => type === "pointermove"
    )?.[1];

    expect(pointerMoveListener).toBeDefined();

    act(() => {
      reducedMotionQuery.setMatches(true);
    });

    expect(screen.queryByTestId("custom-cursor")).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass("custom-cursor-enabled");
    expect(removeWindowListener).toHaveBeenCalledWith(
      "pointermove",
      pointerMoveListener
    );
  });

  it("responds to live fine-pointer changes", () => {
    const { finePointerQuery } = mockMatchMedia({
      finePointer: false,
      reducedMotion: false
    });

    render(<CustomCursor />);

    expect(screen.queryByTestId("custom-cursor")).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass("custom-cursor-enabled");

    act(() => {
      finePointerQuery.setMatches(true);
    });

    expect(screen.getByTestId("custom-cursor")).toBeInTheDocument();
    expect(document.body).toHaveClass("custom-cursor-enabled");

    act(() => {
      finePointerQuery.setMatches(false);
    });

    expect(screen.queryByTestId("custom-cursor")).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass("custom-cursor-enabled");
  });

  it("unsubscribes from media-query changes on unmount", () => {
    const { finePointerQuery, reducedMotionQuery } = mockMatchMedia({
      finePointer: true,
      reducedMotion: false
    });

    const { unmount } = render(<CustomCursor />);

    const finePointerListener =
      finePointerQuery.mediaQueryList.addEventListener.mock.calls[0]?.[1];
    const reducedMotionListener =
      reducedMotionQuery.mediaQueryList.addEventListener.mock.calls[0]?.[1];

    expect(finePointerListener).toBeDefined();
    expect(reducedMotionListener).toBeDefined();

    unmount();

    expect(
      finePointerQuery.mediaQueryList.removeEventListener
    ).toHaveBeenCalledWith("change", finePointerListener);
    expect(
      reducedMotionQuery.mediaQueryList.removeEventListener
    ).toHaveBeenCalledWith("change", reducedMotionListener);
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

  it("hides over a disclosure summary while preserving a pointer cursor", () => {
    mockMatchMedia({ finePointer: true, reducedMotion: false });

    render(
      <>
        <CustomCursor />
        <details>
          <summary>Menu</summary>
        </details>
      </>
    );

    const summary = screen.getByText("Menu");

    expect(getComputedStyle(summary).cursor).toBe("pointer");

    fireEvent.pointerMove(summary);

    expect(screen.getByTestId("custom-cursor")).toHaveClass("is-hidden");
  });
});
