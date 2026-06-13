import { useEffect, useRef, useState } from "react";

const interactiveSelector =
  "a, button, input, textarea, select, [role='button'], [contenteditable='true']";

function canUseCustomCursor() {
  if (typeof window.matchMedia !== "function") {
    return false;
  }

  return (
    window.matchMedia("(pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function CustomCursor() {
  const [enabled] = useState(canUseCustomCursor);
  const cursorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;

    if (!enabled || !cursor) {
      return;
    }

    const moveCursor = (event: PointerEvent) => {
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;

      const target = event.target instanceof Element ? event.target : null;
      const toneSection = target?.closest<HTMLElement>("[data-cursor-tone]");

      cursor.dataset.tone = toneSection?.dataset.cursorTone ?? "coral";
      cursor.classList.toggle(
        "is-hidden",
        Boolean(target?.closest(interactiveSelector))
      );
    };

    document.body.classList.add("custom-cursor-enabled");
    window.addEventListener("pointermove", moveCursor);

    return () => {
      window.removeEventListener("pointermove", moveCursor);
      document.body.classList.remove("custom-cursor-enabled");
    };
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className="custom-cursor"
      data-testid="custom-cursor"
      ref={cursorRef}
    />
  );
}
