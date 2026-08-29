import type { AgentResult, Identity, PathEnvelope } from "../src/path-core/contracts";
import {
  MemorySessionStore,
  PortablePathEngine,
  type PathRunEvidence,
  type PathRunInput,
  type WorkerRuntime
} from "../src/path-core/portable";
import { runModelWorker } from "../lib/agent-runtime";

async function runPortablePath(input: PathRunInput): Promise<PathRunEvidence> {
  "use step";

  const workers: WorkerRuntime = {
    async run(identity: Identity, envelope: PathEnvelope, transcript): Promise<AgentResult> {
      return runModelWorker(identity, envelope, transcript);
    }
  };

  return new PortablePathEngine(new MemorySessionStore(), workers).run(input);
}

export async function pathWorkflow(input: PathRunInput): Promise<PathRunEvidence> {
  "use workflow";
  return runPortablePath(input);
}
