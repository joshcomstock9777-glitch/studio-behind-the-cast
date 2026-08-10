import type { Ai, DurableObjectNamespace, Fetcher, Queue } from "@cloudflare/workers-types";
import type { PathEnvelope } from "./contracts";

export interface CoreEnv {
  PATH_STATE: DurableObjectNamespace;
  PATH_QUEUE: Queue<PathEnvelope>;
  ALLIE: Fetcher;
  AMBER: Fetcher;
  ALLOWED_ORIGIN: string;
  SOURCE_VERSION: string;
}

export interface AgentEnv {
  AI: Ai;
  AI_MODEL: string;
  SOURCE_VERSION: string;
}
