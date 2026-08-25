import { start } from "workflow/api";
import { nativeRequestAuthorized } from "../../../../lib/native-auth";
import { isIdentity } from "../../../../src/path-core/contracts";
import { pathWorkflow } from "../../../../workflows/path";

const MAX_BODY_BYTES = 16_000;

export async function POST(request: Request): Promise<Response> {
  if (!(await nativeRequestAuthorized(request))) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return Response.json({ error: "BODY_TOO_LARGE" }, { status: 413 });
  }

  let input: { target?: unknown; message?: unknown };
  try {
    input = JSON.parse(raw);
  } catch {
    return Response.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (!isIdentity(input.target) || typeof input.message !== "string" || !input.message.trim()) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const correlationId = crypto.randomUUID();
  const run = await start(pathWorkflow, [{
    target: input.target,
    message: input.message.trim(),
    correlationId
  }]);
  return Response.json({ sessionId: run.runId, correlationId, status: "open" }, { status: 202 });
}
