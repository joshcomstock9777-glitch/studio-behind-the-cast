import { describe, expect, it } from "vitest";
import { createAgentWorker } from "../../src/agent-worker";
import { envelope } from "./helpers";

const SECRET = "ghp_DO_NOT_LEAK_THIS_TEST_SECRET";

function failingEnv(failure: unknown) {
  return {
    AI_MODEL: "mock-model",
    SOURCE_VERSION: "test-source",
    AI: { run: async () => { throw failure; } }
  };
}

describe("provider timeout/error redaction", () => {
  it.each([
    new Error(`upstream timeout Authorization: Bearer ${SECRET}`),
    new Error(`provider 500 token=${SECRET}`)
  ])("returns a normalized error without provider details or secrets", async failure => {
    const worker = createAgentWorker("allie");
    const seed = envelope();
    const response = await worker.fetch!(new Request("https://agent/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ envelope: seed, transcript: [] })
    }), failingEnv(failure) as never, {} as never);
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("Authorization");
    expect(text).not.toContain("token=");
    expect(JSON.parse(text)).toEqual({ error: "AGENT_EXECUTION_FAILED", correlationId: seed.correlationId });
  });
});
