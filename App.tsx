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

export function usePathMessage() {
  const config = (globalThis as { __PATH_CONFIG__?: { apiBaseUrl?: string } }).__PATH_CONFIG__ ?? {};
  const apiBaseUrl = String(config.apiBaseUrl ?? "").trim();

  const state: PathMessageState = {
    status: apiBaseUrl ? "PATH LOADING" : "PATH NOT CONFIGURED",
    correlationId: null,
    transcript: [],
    error: null
  };

  return {
    apiBaseUrl,
    state,
    send(message: string, target: "allie" | "amber") {
      return { message, target, correlationId: crypto.randomUUID() };
    }
  };
}

export default function App() {
  return usePathMessage();
}
