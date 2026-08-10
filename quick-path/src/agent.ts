import { IDENTITIES } from "./identity";
import { otherIdentity, type AgentResult, type Identity, type PathEnvelope } from "./contracts";
import { PluginRegistry } from "./plugins";

export async function runAgent(
  identity: Identity,
  envelope: PathEnvelope,
  transcript: unknown[],
  registry: PluginRegistry,
  sourceVersion: string
): Promise<AgentResult> {
  if (envelope.to !== identity) throw new Error("IDENTITY_ROUTE_MISMATCH");
  const safeEnvelope = await registry.beforeAgent(envelope);
  const body = await registry.model.generate({
    identity,
    system: IDENTITIES[identity].system,
    envelope: safeEnvelope,
    transcript
  });

  // The path owns routing. Model text can never select a target or extend the loop.
  const isFinal = envelope.turn === envelope.maxTurns - 1;
  const result: AgentResult = {
    messageId: crypto.randomUUID(),
    correlationId: envelope.correlationId,
    identity,
    kind: isFinal ? "final" : "handoff",
    nextTarget: isFinal ? null : otherIdentity(identity),
    body,
    statePatch: {},
    model: registry.model.id,
    sourceVersion
  };
  return registry.afterAgent(result);
}
