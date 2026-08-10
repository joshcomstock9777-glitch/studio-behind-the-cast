import { SCHEMA, MAX_AGENT_CALLS, type Identity, type PathEnvelope } from "../../src/contracts";

export function envelope(overrides: Partial<PathEnvelope> = {}): PathEnvelope {
  return {
    schema: SCHEMA,
    sessionId: "session-test",
    messageId: "message-0",
    correlationId: "correlation-test",
    causationId: null,
    idempotencyKey: "session-test:0:allie",
    from: "josh",
    to: "allie",
    kind: "seed",
    turn: 0,
    maxTurns: MAX_AGENT_CALLS,
    stateVersion: 0,
    body: "Ask Amber, then return a final answer.",
    createdAt: "2026-08-10T14:00:00.000Z",
    ...overrides
  };
}

export function nextEnvelope(previous: PathEnvelope, identity: Identity, body: string): PathEnvelope {
  const to: Identity = identity === "allie" ? "amber" : "allie";
  return envelope({
    sessionId: previous.sessionId,
    messageId: `message-${previous.turn + 1}`,
    correlationId: previous.correlationId,
    causationId: `result-${previous.turn}`,
    idempotencyKey: `${previous.sessionId}:${previous.turn + 1}:${to}`,
    from: identity,
    to,
    kind: "handoff",
    turn: previous.turn + 1,
    stateVersion: previous.stateVersion + 1,
    body
  });
}
