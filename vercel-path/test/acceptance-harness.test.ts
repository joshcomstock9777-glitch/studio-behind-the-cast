import { failClosed, assertPublishable, type AcceptanceEvidence } from "../lib/acceptance-harness";

function sample(over: Partial<AcceptanceEvidence> = {}): AcceptanceEvidence {
  return {
    scenario: "A_short_form",
    correlationId: "corr-1",
    jobId: "job-1",
    sourceAssetIds: ["asset-1"],
    projectSaveEvidence: { saved: true, assetId: "proj-1" },
    renderEvidence: { rendered: true, externalRenderId: "rnd-1", outputUri: "https://example/out.mp4" },
    creatorApprovalEvidence: { approved: true, approvedAt: "2026-09-01T00:00:00Z" },
    destinationHealthEvidence: { destinationId: "youtube-horror", connected: true, channelId: "UC123" },
    publishRequestEvidence: { requested: false },
    externalPlatformId: null,
    externalUrl: null,
    timestamps: { startedAt: "2026-09-01T00:00:00Z", finishedAt: "2026-09-01T00:00:00Z" },
    finalState: "blocked",
    ...over,
  };
}

const cases: Array<[string, Partial<AcceptanceEvidence>, string]> = [
  ["approval absent", { creatorApprovalEvidence: { approved: false } }, "APPROVAL_ABSENT"],
  ["stale render", { renderEvidence: { rendered: false } }, "STALE_OR_MISSING_RENDER"],
  ["oauth/destination dead", { destinationHealthEvidence: { destinationId: "youtube-horror", connected: false } }, "DESTINATION_UNHEALTHY"],
  ["duplicate publish", { externalPlatformId: "yt-already" }, "DUPLICATE_PUBLISH"],
];

for (const [name, over, expected] of cases) {
  try {
    assertPublishable(sample(over));
    throw new Error(`${name}: expected throw`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message !== expected) throw new Error(`${name}: got ${message}`);
  }
}

const closed = failClosed({ scenario: "B_horror_story", correlationId: "corr-2" }, "RENDERER_UNAVAILABLE");
if (closed.finalState !== "failed_closed") throw new Error("failClosed state");
if (closed.externalUrl) throw new Error("failClosed must not invent a URL");

console.log("acceptance-harness fail-closed cases passed");
