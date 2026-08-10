import type { ExportedHandler, MessageBatch } from "@cloudflare/workers-types";
import { MAX_AGENT_CALLS, SCHEMA, isIdentity, type AgentResult, type PathEnvelope, type SessionRecord } from "./contracts";
import type { CoreEnv } from "./env";
export { PathState } from "./state";

const MAX_BODY_BYTES = 16_000;

function stateStub(env: CoreEnv, sessionId: string) {
  return env.PATH_STATE.get(env.PATH_STATE.idFromName(sessionId));
}

function cors(env: CoreEnv, origin: string | null): HeadersInit {
  return origin === env.ALLOWED_ORIGIN
    ? { "access-control-allow-origin": origin, "vary": "Origin" }
    : {};
}

function nextEnvelope(previous: PathEnvelope, result: AgentResult, stateVersion: number): PathEnvelope {
  if (!result.nextTarget) throw new Error("NEXT_TARGET_REQUIRED");
  return {
    ...previous,
    messageId: crypto.randomUUID(),
    causationId: result.messageId,
    idempotencyKey: `${previous.sessionId}:${previous.turn + 1}:${result.nextTarget}`,
    from: result.identity,
    to: result.nextTarget,
    kind: "handoff",
    turn: previous.turn + 1,
    stateVersion,
    body: result.body,
    createdAt: new Date().toISOString()
  };
}

const core: ExportedHandler<CoreEnv, PathEnvelope> = {
  async fetch(request, env): Promise<Response> {
    const origin = request.headers.get("origin");
    if (request.method === "OPTIONS") {
      if (origin !== env.ALLOWED_ORIGIN) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          ...cors(env, origin),
          "access-control-allow-methods": "POST, GET, OPTIONS",
          "access-control-allow-headers": "content-type"
        }
      });
    }

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname.startsWith("/sessions/")) {
      const sessionId = url.pathname.split("/")[2];
      return stateStub(env, sessionId).fetch("https://state/session");
    }
    if (request.method !== "POST" || url.pathname !== "/sessions") {
      return Response.json({ error: "NOT_FOUND" }, { status: 404, headers: cors(env, origin) });
    }
    if (origin !== env.ALLOWED_ORIGIN) {
      return Response.json({ error: "ORIGIN_DENIED" }, { status: 403 });
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return Response.json({ error: "BODY_TOO_LARGE" }, { status: 413, headers: cors(env, origin) });
    }
    let input: { target?: unknown; message?: unknown };
    try { input = JSON.parse(raw); } catch { return Response.json({ error: "INVALID_JSON" }, { status: 400 }); }
    if (!isIdentity(input.target) || typeof input.message !== "string" || !input.message.trim()) {
      return Response.json({ error: "INVALID_REQUEST" }, { status: 400, headers: cors(env, origin) });
    }

    const sessionId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();
    const envelope: PathEnvelope = {
      schema: SCHEMA,
      sessionId,
      messageId: crypto.randomUUID(),
      correlationId,
      causationId: null,
      idempotencyKey: `${sessionId}:0:${input.target}`,
      from: "josh",
      to: input.target,
      kind: "seed",
      turn: 0,
      maxTurns: MAX_AGENT_CALLS,
      stateVersion: 0,
      body: input.message.trim(),
      createdAt: new Date().toISOString()
    };
    const seeded = await stateStub(env, sessionId).fetch("https://state/seed", {
      method: "POST", body: JSON.stringify(envelope)
    });
    if (!seeded.ok) return Response.json({ error: "STATE_SEED_FAILED" }, { status: 502 });
    await env.PATH_QUEUE.send(envelope);
    return Response.json({ sessionId, correlationId, status: "open" }, { status: 202, headers: cors(env, origin) });
  },

  async queue(batch: MessageBatch<PathEnvelope>, env): Promise<void> {
    for (const message of batch.messages) {
      const envelope = message.body;
      try {
        if (!isIdentity(envelope.to) || envelope.turn >= envelope.maxTurns) throw new Error("LOOP_LIMIT");
        const stub = stateStub(env, envelope.sessionId);
        const currentResponse = await stub.fetch("https://state/session");
        if (!currentResponse.ok) throw new Error("SESSION_NOT_FOUND");
        const current = (await currentResponse.json()) as SessionRecord;
        if (current.status !== "open") { message.ack(); continue; }
        if (current.processed[envelope.idempotencyKey]) { message.ack(); continue; }

        const service = envelope.to === "allie" ? env.ALLIE : env.AMBER;
        const response = await service.fetch("https://agent/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ envelope, transcript: current.transcript })
        });
        if (!response.ok) throw new Error(`AGENT_${response.status}`);
        const result = (await response.json()) as AgentResult;
        if (result.identity !== envelope.to || result.correlationId !== envelope.correlationId) {
          throw new Error("AGENT_RESULT_MISMATCH");
        }
        const savedResponse = await stub.fetch("https://state/result", {
          method: "POST",
          headers: { "x-idempotency-key": envelope.idempotencyKey },
          body: JSON.stringify(result)
        });
        if (!savedResponse.ok) throw new Error("STATE_RESULT_FAILED");
        const saved = (await savedResponse.json()) as { duplicate: boolean; record: SessionRecord };
        if (!saved.duplicate && result.kind === "handoff") {
          if (saved.record.calls >= MAX_AGENT_CALLS) throw new Error("LOOP_LIMIT");
          await env.PATH_QUEUE.send(nextEnvelope(envelope, result, saved.record.stateVersion));
        }
        message.ack();
      } catch {
        // No prompt, token, or upstream body is logged. Queue retry is bounded by wrangler config.
        message.retry();
      }
    }
  }
};

export default core;
