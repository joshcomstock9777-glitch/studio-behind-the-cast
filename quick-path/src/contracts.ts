export const SCHEMA = "moonshadow.path.v1" as const;
export const MAX_AGENT_CALLS = 3 as const;

export type Identity = "allie" | "amber";
export type Sender = Identity | "josh" | "path";
export type MessageKind = "seed" | "handoff" | "final" | "error";

export interface PathEnvelope {
  schema: typeof SCHEMA;
  sessionId: string;
  messageId: string;
  correlationId: string;
  causationId: string | null;
  idempotencyKey: string;
  from: Sender;
  to: Identity;
  kind: MessageKind;
  turn: number;
  maxTurns: typeof MAX_AGENT_CALLS;
  stateVersion: number;
  body: string;
  createdAt: string;
}

export interface AgentResult {
  messageId: string;
  correlationId: string;
  identity: Identity;
  kind: "handoff" | "final" | "error";
  nextTarget: Identity | null;
  body: string;
  statePatch: Record<string, unknown>;
  model: string;
  sourceVersion: string;
}

export interface SessionRecord {
  sessionId: string;
  correlationId: string;
  status: "open" | "final" | "error";
  calls: number;
  stateVersion: number;
  transcript: Array<PathEnvelope | AgentResult>;
  processed: Record<string, AgentResult>;
}

export function isIdentity(value: unknown): value is Identity {
  return value === "allie" || value === "amber";
}

export function otherIdentity(identity: Identity): Identity {
  return identity === "allie" ? "amber" : "allie";
}
