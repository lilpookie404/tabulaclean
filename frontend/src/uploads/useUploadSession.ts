import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  approveUploadChange,
  fetchUploadSession,
  previewUploadChange,
  rejectUploadChange,
  resetUploadChanges,
  submitUploadChange,
  undoUploadChange,
  UploadApiError,
  uploadSpreadsheet
} from "./api";
import type {
  ChangePreview,
  CleaningAction,
  UploadOperationState,
  UploadSession,
  UploadViewState
} from "./types";

export const SESSION_STORAGE_KEY = "tabulaclean.upload-session-id";

interface UploadSessionState {
  state: UploadViewState;
  session: UploadSession | null;
  message: string | null;
  uploadFile: (file: File) => Promise<void>;
  resetSession: () => void;
  downloadUrl: string | null;
  operationState: UploadOperationState;
  operationMessage: string | null;
  previewChange: (action: CleaningAction) => Promise<ChangePreview>;
  submitChange: (action: CleaningAction) => Promise<UploadSession>;
  approvePending: () => Promise<UploadSession>;
  rejectPending: (changeId?: string) => Promise<UploadSession>;
  undoLatest: () => Promise<UploadSession>;
  resetToOriginal: () => Promise<UploadSession>;
  refreshSession: () => Promise<UploadSession | null>;
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
  const [operationState, setOperationState] =
    useState<UploadOperationState>("idle");
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const operationInFlight = useRef(false);

  const restore = useCallback(async (
    sessionId: string,
    signal?: AbortSignal
  ): Promise<UploadSession> => {
    const restored = await fetchUploadSession(sessionId, signal);
    setSession(restored);
    setMessage(null);
    setState("success");
    return restored;
  }, []);

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
      setOperationMessage(null);
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
    setOperationState("idle");
    setOperationMessage(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const sessionId = savedSessionId();
    if (!sessionId) return null;
    return restore(sessionId);
  }, [restore]);

  const requireSession = useCallback(() => {
    if (!session) {
      throw new UploadApiError(
        "Open a spreadsheet before starting a fix.",
        "session_required",
        409
      );
    }
    return session;
  }, [session]);

  const runOperation = useCallback(
    async <T,>(operation: (current: UploadSession) => Promise<T>): Promise<T> => {
      if (operationInFlight.current) {
        throw new UploadApiError(
          "Another spreadsheet action is still in progress.",
          "operation_in_progress",
          409
        );
      }
      const current = requireSession();
      operationInFlight.current = true;
      setOperationState("working");
      setOperationMessage(null);
      try {
        const result = await operation(current);
        setOperationState("idle");
        return result;
      } catch (error) {
        const friendly =
          error instanceof Error
            ? error.message
            : "We could not complete that spreadsheet action.";
        setOperationState("error");
        setOperationMessage(friendly);
        if (
          error instanceof UploadApiError &&
          error.code === "stale_revision"
        ) {
          await refreshSession().catch(() => null);
        }
        throw error;
      } finally {
        operationInFlight.current = false;
      }
    },
    [refreshSession, requireSession]
  );

  const previewChange = useCallback(
    (action: CleaningAction) =>
      runOperation((current) =>
        previewUploadChange(
          current.session_id,
          current.revision,
          action
        )
      ),
    [runOperation]
  );

  const submitChange = useCallback(
    (action: CleaningAction) =>
      runOperation(async (current) => {
        const updated = await submitUploadChange(
          current.session_id,
          current.revision,
          action
        );
        setSession(updated);
        return updated;
      }),
    [runOperation]
  );

  const approvePending = useCallback(
    () =>
      runOperation(async (current) => {
        if (!current.pending_change) {
          throw new UploadApiError(
            "There is no pending change to approve.",
            "change_not_found",
            404
          );
        }
        const updated = await approveUploadChange(
          current.session_id,
          current.pending_change.change_id,
          current.revision
        );
        setSession(updated);
        return updated;
      }),
    [runOperation]
  );

  const rejectPending = useCallback(
    (changeId?: string) =>
      runOperation(async (current) => {
        const selectedId = changeId ?? current.pending_change?.change_id;
        if (!selectedId) {
          throw new UploadApiError(
            "There is no pending change to reject.",
            "change_not_found",
            404
          );
        }
        const updated = await rejectUploadChange(
          current.session_id,
          selectedId,
          current.revision
        );
        setSession(updated);
        return updated;
      }),
    [runOperation]
  );

  const undoLatest = useCallback(
    () =>
      runOperation(async (current) => {
        const updated = await undoUploadChange(
          current.session_id,
          current.revision
        );
        setSession(updated);
        return updated;
      }),
    [runOperation]
  );

  const resetToOriginal = useCallback(
    () =>
      runOperation(async (current) => {
        const updated = await resetUploadChanges(
          current.session_id,
          current.revision
        );
        setSession(updated);
        return updated;
      }),
    [runOperation]
  );

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
    downloadUrl,
    operationState,
    operationMessage,
    previewChange,
    submitChange,
    approvePending,
    rejectPending,
    undoLatest,
    resetToOriginal,
    refreshSession
  };
}
