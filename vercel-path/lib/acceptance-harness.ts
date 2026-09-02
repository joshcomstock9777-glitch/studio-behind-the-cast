export type ScenarioId = "A_short_form" | "B_horror_story" | "C_review_trend";

export interface AcceptanceEvidence {
  scenario: ScenarioId;
  correlationId: string;
  jobId: string | null;
  sourceAssetIds: string[];
  projectSaveEvidence: { saved: boolean; assetId?: string };
  renderEvidence: { rendered: boolean; externalRenderId?: string; outputUri?: string };
  creatorApprovalEvidence: { approved: boolean; approvedAt?: string };
  destinationHealthEvidence: { destinationId: string; connected: boolean; channelId?: string };
  publishRequestEvidence: { requested: boolean };
  externalPlatformId: string | null;
  externalUrl: string | null;
  timestamps: { startedAt: string; finishedAt: string };
  finalState: "blocked" | "failed_closed" | "published";
  blockReason?: string;
}

export function failClosed(partial: Partial<AcceptanceEvidence> & Pick<AcceptanceEvidence, "scenario" | "correlationId">, reason: string): AcceptanceEvidence {
  const now = new Date().toISOString();
  return {
    jobId: null,
    sourceAssetIds: [],
    projectSaveEvidence: { saved: false },
    renderEvidence: { rendered: false },
    creatorApprovalEvidence: { approved: false },
    destinationHealthEvidence: { destinationId: "", connected: false },
    publishRequestEvidence: { requested: false },
    externalPlatformId: null,
    externalUrl: null,
    timestamps: { startedAt: now, finishedAt: now },
    finalState: "failed_closed",
    blockReason: reason,
    ...partial,
    scenario: partial.scenario,
    correlationId: partial.correlationId,
  };
}

export function assertPublishable(evidence: AcceptanceEvidence): void {
  if (!evidence.creatorApprovalEvidence.approved) throw new Error("APPROVAL_ABSENT");
  if (!evidence.renderEvidence.rendered || !evidence.renderEvidence.externalRenderId) {
    throw new Error("STALE_OR_MISSING_RENDER");
  }
  if (!evidence.destinationHealthEvidence.connected || !evidence.destinationHealthEvidence.channelId) {
    throw new Error("DESTINATION_UNHEALTHY");
  }
  if (evidence.externalPlatformId) throw new Error("DUPLICATE_PUBLISH");
}
