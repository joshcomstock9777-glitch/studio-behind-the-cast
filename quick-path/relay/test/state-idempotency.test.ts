import { describe, expect, it } from "vitest";
import { PathState } from "../../src/state";
import type { AgentResult, SessionRecord } from "../../src/contracts";
import { envelope } from "./helpers";

class MemoryStorage {
  value: SessionRecord | undefined;
  async get<T>(): Promise<T | undefined> { return this.value as T | undefined; }
  async put(_key: string, value: SessionRecord): Promise<void> { this.value = structuredClone(value); }
}

function stateHarness() {
  const storage = new MemoryStorage();
  const state = {
    storage,
    blockConcurrencyWhile: async <T>(callback: () => Promise<T>) => callback()
  };
  return { durable: new PathState(state as never), storage };
}

describe("persistent idempotency ledger", () => {
  it("records a result once and returns the stored record for duplicate delivery", async () => {
    const { durable } = stateHarness();
    const seed = envelope();
    expect((await durable.fetch(new Request("https://state/seed", { method: "POST", body: JSON.stringify(seed) }))).status).toBe(200);

    const result: AgentResult = {
      messageId: "result-0",
      correlationId: seed.correlationId,
      identity: "allie",
      kind: "handoff",
      nextTarget: "amber",
      body: "Amber, inspect this.",
      statePatch: {},
      model: "mock-zero-dollar-model",
      sourceVersion: "test-source"
    };
    const request = () => new Request("https://state/result", {
      method: "POST",
      headers: { "x-idempotency-key": seed.idempotencyKey },
      body: JSON.stringify(result)
    });

    const first = await (await durable.fetch(request())).json() as { duplicate: boolean; record: SessionRecord };
    const duplicate = await (await durable.fetch(request())).json() as { duplicate: boolean; record: SessionRecord };
    expect(first.duplicate).toBe(false);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.record.calls).toBe(1);
    expect(duplicate.record.transcript).toHaveLength(2);
    expect(duplicate.record.correlationId).toBe(seed.correlationId);
  });
});
