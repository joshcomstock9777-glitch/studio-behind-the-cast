import { start } from "workflow/api";
import { isIdentity } from "../../../src/path-core/contracts";
import { json, originAllowed } from "../../../lib/http";
import { pathWorkflow } from "../../../workflows/path";

const MAX_BODY_BYTES = 16_000;

export async function OPTIONS(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (!originAllowed(origin)) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": origin!,
      "access-control-allow-methods": "POST, GET, OPTIONS",
      "access-control-allow-headers": "content-type",
      vary: "Origin"
    }
  });
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (!originAllowed(origin)) return Response.json({ error: "ORIGIN_DENIED" }, { status: 403 });

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json({ error: "BODY_TOO_LARGE" }, 413, origin);
  }

  let input: { target?: unknown; message?: unknown };
  try {
    input = JSON.parse(raw);
  } catch {
    return json({ error: "INVALID_JSON" }, 400, origin);
  }
  if (!isIdentity(input.target) || typeof input.message !== "string" || !input.message.trim()) {
    return json({ error: "INVALID_REQUEST" }, 400, origin);
  }

  const correlationId = crypto.randomUUID();
  const run = await start(pathWorkflow, [{
    target: input.target,
    message: input.message.trim(),
    correlationId
  }]);
  return json({ sessionId: run.runId, correlationId, status: "open" }, 202, origin);
}
