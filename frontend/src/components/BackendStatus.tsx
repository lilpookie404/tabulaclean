import useBackendHealth from "../hooks/useBackendHealth";

const labels = {
  checking: "Checking",
  connected: "Connected",
  unavailable: "Unavailable"
};

export default function BackendStatus() {
  const { state, retry } = useBackendHealth();

  return (
    <div aria-live="polite" className={`backend-status ${state}`}>
      <span aria-hidden="true" className="backend-status-dot" />
      <span>{labels[state]}</span>
      {state === "unavailable" ? (
        <button onClick={() => void retry()} type="button">
          Retry connection
        </button>
      ) : null}
    </div>
  );
}
