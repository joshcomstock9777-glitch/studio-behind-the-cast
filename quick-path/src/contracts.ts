export const SCHEMA = "moonshadow.path.v1" as const;
export const EVENT_SCHEMA = "moonshadow.brain.event.v1" as const;
export const MAX_AGENT_CALLS = 3 as const;

export type Identity = "allie" | "amber";
export type Sender = Identity | "josh" | "path";
export type Actor = Sender | "editor" | "review";
export type MessageKind = "seed" | "handoff" | "final" | "error";
export type BrainEventType =
  | "request.created"
  | "route.assigned"
  | "worker.result"
  | "handoff.recorded"
  | "editor.touched"
  | "review.completed"
  | "request.finalized"
  | "request.failed";

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

export interface BrainEvent {
  schema: typeof EVENT_SCHEMA;
  eventId: string;
  requestId: string;
  correlationId: string;
  causationId: string | null;
  actor: Actor;
  type: BrainEventType;
  stateVersion: number;
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface SessionRecord {
  sessionId: string;
  correlationId: string;
  status: "open" | "final" | "error";
  calls: number;
  stateVersion: number;
  transcript: Array<PathEnvelope | AgentResult>;
  events: BrainEvent[];
  processed: Record<string, AgentResult>;
}

export function isIdentity(value: unknown): value is Identity {
  return value === "allie" || value === "amber";
}

export function otherIdentity(identity: Identity): Identity {
  return identity === "allie" ? "amber" : "allie";
}
