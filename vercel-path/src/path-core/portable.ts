// Vendored from quick-path/src/portable.ts for the isolated Vercel proof bundle.
import { MAX_AGENT_CALLS, SCHEMA, isIdentity, type AgentResult, type Identity, type PathEnvelope, type SessionRecord } from "./contracts";
export interface SessionStore { create(record: SessionRecord): Promise<void>; get(sessionId: string): Promise<SessionRecord | null>; applyResult(sessionId: string, idempotencyKey: string, result: AgentResult): Promise<{ duplicate: boolean; record: SessionRecord }>; }
export interface WorkerRuntime { run(identity: Identity, envelope: PathEnvelope, transcript: SessionRecord["transcript"]): Promise<AgentResult>; }
export interface PathRunInput { target: Identity; message: string; correlationId?: string; }
export interface PathRunEvidence { sessionId: string; correlationId: string; record: SessionRecord; }
function nextEnvelope(previous: PathEnvelope, result: AgentResult, stateVersion: number): PathEnvelope { if (!result.nextTarget) throw new Error("NEXT_TARGET_REQUIRED"); return { ...previous, messageId: crypto.randomUUID(), causationId: result.messageId, idempotencyKey: `${previous.sessionId}:${previous.turn + 1}:${result.nextTarget}`, from: result.identity, to: result.nextTarget, kind: "handoff", turn: previous.turn + 1, stateVersion, body: result.body, createdAt: new Date().toISOString() }; }
export class PortablePathEngine {
  constructor(private readonly sessions: SessionStore, private readonly workers: WorkerRuntime) {}
  async run(input: PathRunInput): Promise<PathRunEvidence> {
    if (!isIdentity(input.target) || typeof input.message !== "string" || !input.message.trim()) throw new Error("INVALID_REQUEST");
    const sessionId = crypto.randomUUID(); const correlationId = input.correlationId || crypto.randomUUID();
    let envelope: PathEnvelope = { schema: SCHEMA, sessionId, messageId: crypto.randomUUID(), correlationId, causationId: null, idempotencyKey: `${sessionId}:0:${input.target}`, from: "josh", to: input.target, kind: "seed", turn: 0, maxTurns: MAX_AGENT_CALLS, stateVersion: 0, body: input.message.trim(), createdAt: new Date().toISOString() };
    await this.sessions.create({ sessionId, correlationId, status: "open", calls: 0, stateVersion: 0, transcript: [envelope], processed: {} });
    while (true) { const current = await this.sessions.get(sessionId); if (!current) throw new Error("SESSION_NOT_FOUND"); if (current.status !== "open") return { sessionId, correlationId, record: current }; if (current.calls >= MAX_AGENT_CALLS || envelope.turn >= envelope.maxTurns) throw new Error("LOOP_LIMIT"); const result = await this.workers.run(envelope.to, envelope, current.transcript); if (result.identity !== envelope.to || result.correlationId !== correlationId) throw new Error("AGENT_RESULT_MISMATCH"); const saved = await this.sessions.applyResult(sessionId, envelope.idempotencyKey, result); if (saved.record.status !== "open") return { sessionId, correlationId, record: saved.record }; if (saved.duplicate) throw new Error("DUPLICATE_OPEN_STEP"); envelope = nextEnvelope(envelope, result, saved.record.stateVersion); }
  }
}
export class MemorySessionStore implements SessionStore {
  private readonly records = new Map<string, SessionRecord>();
  async create(record: SessionRecord): Promise<void> { if (this.records.has(record.sessionId)) throw new Error("SESSION_EXISTS"); this.records.set(record.sessionId, structuredClone(record)); }
  async get(sessionId: string): Promise<SessionRecord | null> { const record = this.records.get(sessionId); return record ? structuredClone(record) : null; }
  async applyResult(sessionId: string, idempotencyKey: string, result: AgentResult): Promise<{ duplicate: boolean; record: SessionRecord }> { const record = this.records.get(sessionId); if (!record || record.status !== "open") throw new Error("SESSION_CLOSED"); if (record.processed[idempotencyKey]) return { duplicate: true, record: structuredClone(record) }; record.calls += 1; record.stateVersion += 1; record.transcript.push(structuredClone(result)); record.processed[idempotencyKey] = structuredClone(result); if (result.kind === "final" || result.kind === "error") record.status = result.kind; return { duplicate: false, record: structuredClone(record) }; }
}
