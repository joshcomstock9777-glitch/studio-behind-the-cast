import { describe, expect, it, vi } from "vitest";
import type { AgentResult, Identity, PathEnvelope, SessionRecord } from "../../src/contracts";
import { MemorySessionStore, PortablePathEngine, type WorkerRuntime } from "../../src/portable";

function workers(): WorkerRuntime & { run: ReturnType<typeof vi.fn> } {
  return {
    run: vi.fn(async (identity: Identity, envelope: PathEnvelope): Promise<AgentResult> => ({
      messageId: crypto.randomUUID(),
      correlationId: envelope.correlationId,
      identity,
      kind: envelope.turn === 2 ? "final" : "handoff",
      nextTarget: envelope.turn === 2 ? null : identity === "allie" ? "amber" : "allie",
      body: `${identity}:${envelope.turn}`,
      statePatch: {},
      model: "portable-test-model",
      sourceVersion: "portable-test"
    }))
  };
}

describe("provider-neutral Path engine", () => {
  it("runs the capped Allie -> Amber -> Allie path without platform services", async () => {
    const runtime = workers();
    const evidence = await new PortablePathEngine(new MemorySessionStore(), runtime)
      .run({ target: "allie", message: "prove portability" });

    const results = evidence.record.transcript.filter(
      (entry): entry is AgentResult => "identity" in entry
    );
    expect(results.map(result => result.identity)).toEqual(["allie", "amber", "allie"]);
    expect(results.map(result => result.kind)).toEqual(["handoff", "handoff", "final"]);
    expect(evidence.record.calls).toBe(3);
    expect(evidence.record.status).toBe("final");
    expect(evidence.record.stateVersion).toBe(3);
    expect(results.every(result => result.correlationId === evidence.correlationId)).toBe(true);
    expect(runtime.run).toHaveBeenCalledTimes(3);
  });

  it("rejects a worker identity mismatch before saving it", async () => {
    const runtime: WorkerRuntime = {
      async run(_identity, envelope) {
        return {
          messageId: crypto.randomUUID(),
          correlationId: envelope.correlationId,
          identity: "amber",
          kind: "final",
          nextTarget: null,
          body: "wrong worker",
          statePatch: {},
          model: "portable-test-model",
          sourceVersion: "portable-test"
        };
      }
    };

    await expect(new PortablePathEngine(new MemorySessionStore(), runtime)
      .run({ target: "allie", message: "reject mismatch" }))
      .rejects.toThrow("AGENT_RESULT_MISMATCH");
  });

  it("keeps idempotent results from incrementing calls twice", async () => {
    const store = new MemorySessionStore();
    const seed = {
      schema: "moonshadow.path.v1" as const,
      sessionId: "session-portable",
      messageId: "seed-message",
      correlationId: "correlation-portable",
      causationId: null,
      idempotencyKey: "session-portable:0:allie",
      from: "josh" as const,
      to: "allie" as const,
      kind: "seed" as const,
      turn: 0,
      maxTurns: 3 as const,
      stateVersion: 0,
      body: "test",
      createdAt: new Date().toISOString()
    };
    const record: SessionRecord = {
      sessionId: seed.sessionId,
      correlationId: seed.correlationId,
      status: "open",
      calls: 0,
      stateVersion: 0,
      transcript: [seed],
      processed: {}
    };
    const result: AgentResult = {
      messageId: "result-message",
      correlationId: seed.correlationId,
      identity: "allie",
      kind: "handoff",
      nextTarget: "amber",
      body: "handoff",
      statePatch: {},
      model: "portable-test-model",
      sourceVersion: "portable-test"
    };

    await store.create(record);
    const first = await store.applyResult(seed.sessionId, seed.idempotencyKey, result);
    const second = await store.applyResult(seed.sessionId, seed.idempotencyKey, result);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.record.calls).toBe(1);
    expect(second.record.stateVersion).toBe(1);
  });
});
