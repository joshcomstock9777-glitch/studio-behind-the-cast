import { getRun } from "workflow/api";
import type { PathRunEvidence } from "../../../../src/path-core/portable";
import { json, originAllowed } from "../../../../lib/http";

function externalizeSession(evidence: PathRunEvidence, sessionId: string) {
  return {
    ...evidence.record,
    sessionId,
    transcript: evidence.record.transcript.map((entry) =>
      "sessionId" in entry ? { ...entry, sessionId } : entry
    )
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
): Promise<Response> {
  const origin = request.headers.get("origin");
  if (!originAllowed(origin)) return Response.json({ error: "ORIGIN_DENIED" }, { status: 403 });

  const { sessionId } = await context.params;
  try {
    const run = getRun<PathRunEvidence>(sessionId);
    const status = await run.status;
    if (status === "completed") {
      const evidence = await run.returnValue;
      return json(externalizeSession(evidence, sessionId), 200, origin);
    }
    if (status === "failed" || status === "cancelled") {
      return json({ sessionId, status: "error", error: "PATH_RUN_FAILED" }, 200, origin);
    }
    return json({ sessionId, status: "open", calls: 0, stateVersion: 0, transcript: [] }, 200, origin);
  } catch {
    return json({ error: "SESSION_NOT_FOUND" }, 404, origin);
  }
}
