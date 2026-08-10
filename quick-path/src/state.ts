import type { DurableObject, DurableObjectState } from "@cloudflare/workers-types";
import type { AgentResult, PathEnvelope, SessionRecord } from "./contracts";

export class PathState implements DurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET") {
      const record = await this.state.storage.get<SessionRecord>("session");
      return record ? Response.json(record) : Response.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (request.method !== "POST") return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });

    return this.state.blockConcurrencyWhile(async () => {
      const action = url.pathname.slice(1);
      const payload = (await request.json()) as PathEnvelope | AgentResult;
      let record = await this.state.storage.get<SessionRecord>("session");

      if (action === "seed") {
        if (record) return Response.json({ error: "SESSION_EXISTS" }, { status: 409 });
        const envelope = payload as PathEnvelope;
        record = {
          sessionId: envelope.sessionId,
          correlationId: envelope.correlationId,
          status: "open",
          calls: 0,
          stateVersion: 0,
          transcript: [envelope],
          processed: {}
        };
      } else if (action === "result") {
        if (!record || record.status !== "open") return Response.json({ error: "SESSION_CLOSED" }, { status: 409 });
        const result = payload as AgentResult;
        const key = request.headers.get("x-idempotency-key");
        if (!key) return Response.json({ error: "IDEMPOTENCY_REQUIRED" }, { status: 400 });
        if (record.processed[key]) return Response.json({ duplicate: true, record });
        record.calls += 1;
        record.stateVersion += 1;
        record.transcript.push(result);
        record.processed[key] = result;
        if (result.kind === "final" || result.kind === "error") record.status = result.kind;
      } else {
        return Response.json({ error: "UNKNOWN_ACTION" }, { status: 404 });
      }

      await this.state.storage.put("session", record);
      return Response.json({ duplicate: false, record });
    });
  }
}
