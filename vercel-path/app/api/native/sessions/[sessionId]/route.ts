import { getRun } from "workflow/api";
import { nativeRequestAuthorized } from "../../../../../lib/native-auth";
import type { PathRunEvidence } from "../../../../../src/path-core/portable";

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
  if (!(await nativeRequestAuthorized(request))) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { sessionId } = await context.params;
  try {
    const run = getRun<PathRunEvidence>(sessionId);
    const status = await run.status;
    if (status === "completed") {
      return Response.json(externalizeSession(await run.returnValue, sessionId));
    }
    if (status === "failed" || status === "cancelled") {
      return Response.json({ sessionId, status: "error", error: "PATH_RUN_FAILED" });
    }
    return Response.json({ sessionId, status: "open", calls: 0, stateVersion: 0, transcript: [] });
  } catch {
    return Response.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
  }
}
