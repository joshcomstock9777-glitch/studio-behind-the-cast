import type { AgentResult, Identity, PathEnvelope } from "../src/path-core/contracts";

const DEFAULT_MODEL = "openai/gpt-5.6-sol";
const FALLBACK_MODELS = ["anthropic/claude-opus-5", "google/gemini-3.6-flash"];
const SOURCE_VERSION = "vercel-ai-gateway-v2-fallbacks";

const SYSTEM: Record<Identity, string> = {
  allie: [
    "You are Allie, Moonshadow Studio's Studio Architect and verifier.",
    "Josh is the Architect and final decision-maker.",
    "Remain distinct from Amber. Never claim evidence you do not have.",
    "Protect Josh's attention, preserve original work, and make every component earn its place.",
    "When you receive Josh's request, analyze it directly. When you receive Amber's handoff, synthesize a concise final answer for Josh."
  ].join(" "),
  amber: [
    "You are Amber, Moonshadow Studio's Studio Manager and infrastructure builder.",
    "Josh is the Architect and final decision-maker.",
    "Remain distinct from Allie. Never guess; flag uncertainty and verification status.",
    "Return concise operational analysis to Allie for final synthesis."
  ].join(" ")
};

type GatewayResponse = {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

async function generate(identity: Identity, envelope: PathEnvelope, transcript: unknown[]): Promise<{ text: string; model: string }> {
  const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!token) throw new Error("AI_GATEWAY_AUTH_MISSING");

  const model = process.env.PATH_MODEL?.trim() || DEFAULT_MODEL;
  const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      models: FALLBACK_MODELS,
      messages: [
        { role: "system", content: SYSTEM[identity] },
        {
          role: "user",
          content: JSON.stringify({
            instruction: envelope.body,
            correlationId: envelope.correlationId,
            turn: envelope.turn,
            transcript
          })
        }
      ],
      temperature: 0.3,
      max_tokens: 700
    })
  });

  const data = (await response.json().catch(() => ({}))) as GatewayResponse;
  if (!response.ok) throw new Error(`AI_GATEWAY_${response.status}:${data.error?.message || "REQUEST_FAILED"}`);
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("AI_GATEWAY_EMPTY_RESPONSE");
  return { text, model: data.model || model };
}

export async function runModelWorker(identity: Identity, envelope: PathEnvelope, transcript: unknown[]): Promise<AgentResult> {
  const { text, model } = await generate(identity, envelope, transcript);
  const isFinal = envelope.turn === envelope.maxTurns - 1;
  return {
    messageId: crypto.randomUUID(),
    correlationId: envelope.correlationId,
    identity,
    kind: isFinal ? "final" : "handoff",
    nextTarget: isFinal ? null : identity === "allie" ? "amber" : "allie",
    body: text,
    statePatch: {},
    model,
    sourceVersion: SOURCE_VERSION
  };
}
