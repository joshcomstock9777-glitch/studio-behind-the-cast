import type { AgentResult, Identity, PathEnvelope } from "../src/path-core/contracts";
import {
  MemorySessionStore,
  PortablePathEngine,
  type PathRunEvidence,
  type PathRunInput,
  type WorkerRuntime
} from "../src/path-core/portable";

async function runPortablePath(input: PathRunInput): Promise<PathRunEvidence> {
  "use step";

  const workers: WorkerRuntime = {
    async run(identity: Identity, envelope: PathEnvelope): Promise<AgentResult> {
      const isFinal = envelope.turn === envelope.maxTurns - 1;
      return {
        messageId: crypto.randomUUID(),
        correlationId: envelope.correlationId,
        identity,
        kind: isFinal ? "final" : "handoff",
        nextTarget: isFinal ? null : identity === "allie" ? "amber" : "allie",
        body: `${identity} portable test response for turn ${envelope.turn + 1}`,
        statePatch: {},
        model: "deterministic-zero-cost-test-worker",
        sourceVersion: "vercel-portable-test-v1"
      };
    }
  };

  return new PortablePathEngine(new MemorySessionStore(), workers).run(input);
}

export async function pathWorkflow(input: PathRunInput): Promise<PathRunEvidence> {
  "use workflow";
  return runPortablePath(input);
}
