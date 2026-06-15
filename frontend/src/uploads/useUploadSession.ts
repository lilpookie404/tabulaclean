import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchUploadSession,
  UploadApiError,
  uploadSpreadsheet
} from "./api";
import type { UploadSession, UploadViewState } from "./types";

export const SESSION_STORAGE_KEY = "tabulaclean.upload-session-id";

interface UploadSessionState {
  state: UploadViewState;
  session: UploadSession | null;
  message: string | null;
  uploadFile: (file: File) => Promise<void>;
  resetSession: () => void;
  downloadUrl: string | null;
}

function savedSessionId(): string | null {
  return sessionStorage.getItem(SESSION_STORAGE_KEY);
}

export function useUploadSession(): UploadSessionState {
  const [state, setState] = useState<UploadViewState>(() =>
    savedSessionId() ? "restoring" : "initial"
  );
  const [session, setSession] = useState<UploadSession | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = savedSessionId();
    if (!sessionId) {
      return;
    }

    const controller = new AbortController();
    fetchUploadSession(sessionId, controller.signal)
      .then((restored) => {
        setSession(restored);
        setMessage(null);
        setState("success");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setSession(null);
        if (error instanceof UploadApiError && error.status === 404) {
          setMessage(
            "Your temporary session expired. Please upload the file again."
          );
          setState("expired");
          return;
        }
        setMessage(
          error instanceof Error
            ? error.message
            : "We could not restore this temporary session."
        );
        setState("error");
      });

    return () => controller.abort();
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    setState("uploading");
    setMessage(null);
    try {
      const uploaded = await uploadSpreadsheet(file);
      sessionStorage.setItem(SESSION_STORAGE_KEY, uploaded.session_id);
      setSession(uploaded);
      setState("success");
    } catch (error) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setSession(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not process that spreadsheet. Please try again."
      );
      setState("error");
    }
  }, []);

  const resetSession = useCallback(() => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
    setMessage(null);
    setState("initial");
  }, []);

  const downloadUrl = useMemo(
    () =>
      session
        ? `/api/sessions/${encodeURIComponent(session.session_id)}/download`
        : null,
    [session]
  );

  return {
    state,
    session,
    message,
    uploadFile,
    resetSession,
    downloadUrl
  };
}
