import { useState } from "react";

export type PathMessageStatus =
  | "PATH NOT CONFIGURED"
  | "PATH LOADING"
  | "PATH CONTROL SURFACE"
  | "PATH BACKEND BLOCKED";

export interface PathMessageTranscriptEntry {
  identity?: "allie" | "amber";
  body?: string;
  correlationId?: string;
}

export interface PathMessageState {
  status: PathMessageStatus;
  correlationId: string | null;
  transcript: PathMessageTranscriptEntry[];
  error: string | null;
}

function getPathApiBaseUrl() {
  const config = (globalThis as { __PATH_CONFIG__?: { apiBaseUrl?: string } }).__PATH_CONFIG__ ?? {};
  return String(config.apiBaseUrl ?? "").trim();
}

const initialPathApiBaseUrl = getPathApiBaseUrl();

export function usePathMessage() {
  const notConfiguredError = "Path API base URL is not configured.";
  const apiBaseUrl = initialPathApiBaseUrl;
  const [state, setState] = useState<PathMessageState>({
    status: apiBaseUrl ? "PATH LOADING" : "PATH NOT CONFIGURED",
    correlationId: null,
    transcript: [],
    error: null
  });

  const send = async (message: string, target: "allie" | "amber") => {
    if (!apiBaseUrl) {
      const error = notConfiguredError;
      setState(current => ({ ...current, status: "PATH NOT CONFIGURED", error }));
      throw new Error(error);
    }

    setState(current => ({ ...current, status: "PATH LOADING", error: null }));
    let handled = false;
    try {
      const requestUrl = `${apiBaseUrl.replace(/\/?$/, "/")}sessions`;
      const response = await fetch(requestUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target, message })
      });
      const bodyText = await response.text();
      let payload: unknown = {};
      try {
        payload = bodyText ? JSON.parse(bodyText) : {};
      } catch (cause) {
        const error = "Path request returned invalid JSON.";
        setState(current => ({ ...current, status: "PATH BACKEND BLOCKED", error }));
        handled = true;
        throw new Error(error);
      }
      if (!response.ok) {
        const responsePayload = payload as { error?: unknown; correlationId?: unknown };
        const error = String(responsePayload?.error ?? `Path request failed (${response.status})`);
        setState(current => ({ ...current, status: "PATH BACKEND BLOCKED", error }));
        handled = true;
        throw new Error(error);
      }

      const responsePayload = payload as { correlationId?: unknown };
      const correlationId = String(responsePayload?.correlationId ?? "");
      setState(current => ({
        ...current,
        status: "PATH CONTROL SURFACE",
        correlationId,
        error: null
      }));
      return payload;
    } catch (cause) {
      if (!handled) {
        const error = cause instanceof Error ? cause.message : String(cause);
        setState(current => ({ ...current, status: "PATH BACKEND BLOCKED", error }));
      }
      throw cause;
    }
  };

  return {
    state,
    send
  };
}

export default function App() {
  const { state, send } = usePathMessage();
  return (
    <section>
      <strong>{state.status}</strong>
      <span>{state.correlationId ?? "—"}</span>
      <button type="button" onClick={() => { void send("Preview request", "allie"); }}>
        Preview send
      </button>
    </section>
  );
}
