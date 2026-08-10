import type { ExportedHandler } from "@cloudflare/workers-types";
import { runAgent } from "./agent";
import { isIdentity, type Identity, type PathEnvelope } from "./contracts";
import type { AgentEnv } from "./env";
import { PluginRegistry } from "./plugins";
import { WorkersAiAdapter } from "./workers-ai";

export function createAgentWorker(identity: Identity): ExportedHandler<AgentEnv> {
  return {
    async fetch(request, env): Promise<Response> {
      if (request.method !== "POST") return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
      const payload = (await request.json()) as { envelope?: PathEnvelope; transcript?: unknown[] };
      if (!payload.envelope || !isIdentity(payload.envelope.to) || payload.envelope.to !== identity) {
        return Response.json({ error: "IDENTITY_ROUTE_MISMATCH" }, { status: 400 });
      }
      try {
        const registry = new PluginRegistry(new WorkersAiAdapter(env.AI, env.AI_MODEL));
        const result = await runAgent(
          identity,
          payload.envelope,
          payload.transcript ?? [],
          registry,
          env.SOURCE_VERSION
        );
        return Response.json(result);
      } catch {
        // Upstream/provider errors may contain credentials, prompt fragments, or URLs.
        // The public contract returns a fixed code; detailed diagnostics belong only in
        // secret-redacted platform observability.
        return Response.json(
          { error: "AGENT_EXECUTION_FAILED", correlationId: payload.envelope.correlationId },
          { status: 502 }
        );
      }
    }
  };
}
