import { useCallback, useEffect, useRef, useState } from "react";

export type BackendHealthState = "checking" | "connected" | "unavailable";

function isHealthyResponse(payload: unknown): payload is { status: "healthy" } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "status" in payload &&
    payload.status === "healthy"
  );
}

export default function useBackendHealth() {
  const [state, setState] = useState<BackendHealthState>("checking");
  const mountedRef = useRef(true);

  const check = useCallback(async () => {
    setState("checking");

    try {
      const response = await fetch("/health", {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) {
        throw new Error(`Health request failed with ${response.status}`);
      }

      const payload: unknown = await response.json();
      if (!isHealthyResponse(payload)) {
        throw new Error("Health response was not healthy");
      }

      if (mountedRef.current) {
        setState("connected");
      }
    } catch {
      if (mountedRef.current) {
        setState("unavailable");
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const timer = window.setTimeout(() => {
      void check();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      mountedRef.current = false;
    };
  }, [check]);

  return { state, retry: check };
}
