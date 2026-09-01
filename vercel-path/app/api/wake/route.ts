import { getRun, start } from "workflow/api";
import { isIdentity, type Identity } from "../../../src/path-core/contracts";
import type { PathRunEvidence } from "../../../src/path-core/portable";
import { pathWorkflow } from "../../../workflows/path";

const MAX_BODY_BYTES = 16_000;
const POLL_MS = 400;
const MAX_WAIT_MS = 18_000;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type"
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS });
}

function mapTarget(value: unknown): Identity {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "allie" ? "allie" : "amber";
}

function finalText(evidence: PathRunEvidence | undefined): { message: string; model: string; worker: string } {
  const transcript = evidence?.record?.transcript ?? [];
  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    const entry = transcript[index] as { body?: string; identity?: string; model?: string; kind?: string };
    if (entry?.body) {
      return {
        message: entry.body,
        model: entry.model || "openai/gpt-5.6-sol",
        worker: entry.identity || "amber"
      };
    }
  }
  return { message: "Path completed with an empty transcript.", model: "unknown", worker: "path" };
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(): Promise<Response> {
  return json({
    ok: true,
    service: "Moonshadow Path Wake Bridge",
    worker: "ready",
    agents: ["Allie", "Amber"],
    provider: "vercel-ai-gateway",
    note: "Replaces the Cloudflare wake worker for V2. Extra seats fold into Amber."
  });
}

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: "BODY_TOO_LARGE" }, 413);
  }

  let input: { correlationId?: unknown; sender?: unknown; target?: unknown; message?: unknown };
  try {
    input = JSON.parse(raw || "{}");
  } catch {
    return json({ ok: false, error: "INVALID_JSON" }, 400);
  }

  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!message) return json({ ok: false, error: "INVALID_REQUEST" }, 400);

  const target = mapTarget(input.target);
  if (!isIdentity(target)) return json({ ok: false, error: "INVALID_REQUEST" }, 400);

  const correlationId = typeof input.correlationId === "string" && input.correlationId
    ? input.correlationId
    : crypto.randomUUID();
  const sender = String(input.sender ?? "Josh");
  const originalTarget = String(input.target ?? target);
  const wrapped = `${sender} → ${originalTarget}\n${message}`;

  try {
    const run = await start(pathWorkflow, [{ target, message: wrapped, correlationId }]);
    const started = Date.now();
    while (Date.now() - started < MAX_WAIT_MS) {
      const handle = getRun<PathRunEvidence>(run.runId);
      const status = await handle.status;
      if (status === "completed") {
        const evidence = await handle.returnValue;
        const result = finalText(evidence);
        return json({
          ok: true,
          correlationId,
          sessionId: run.runId,
          worker: result.worker,
          message: result.message,
          model: result.model,
          createdAt: Date.now()
        });
      }
      if (status === "failed" || status === "cancelled") {
        return json({ ok: false, error: "PATH_RUN_FAILED", correlationId, sessionId: run.runId }, 502);
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
    return json({
      ok: true,
      correlationId,
      sessionId: run.runId,
      worker: target,
      message: "Path accepted the wake and is still running. Poll the session on PATH if you need the rest.",
      model: "pending",
      createdAt: Date.now(),
      status: "open"
    });
  } catch (error) {
    return json({
      ok: false,
      error: error instanceof Error ? error.message : "WAKE_BRIDGE_FAILED"
    }, 500);
  }
}
