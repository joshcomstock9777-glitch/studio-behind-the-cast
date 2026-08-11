import type { AgentResult, Identity, PathEnvelope } from "./contracts";

export interface ModelRequest {
  identity: Identity;
  system: string;
  envelope: PathEnvelope;
  transcript: unknown[];
}

export interface ModelAdapter {
  readonly id: string;
  generate(request: ModelRequest): Promise<string>;
}

export interface PathPlugin {
  readonly id: string;
  beforeAgent?(envelope: PathEnvelope): Promise<PathEnvelope>;
  afterAgent?(result: AgentResult): Promise<AgentResult>;
}

export class PluginRegistry {
  readonly model: ModelAdapter;
  readonly plugins: PathPlugin[];

  constructor(model: ModelAdapter, plugins: PathPlugin[] = []) {
    this.model = model;
    this.plugins = plugins;
  }

  async beforeAgent(envelope: PathEnvelope): Promise<PathEnvelope> {
    let current = envelope;
    for (const plugin of this.plugins) {
      if (plugin.beforeAgent) {
        const candidate = await plugin.beforeAgent(current);
        assertEnvelopeControlFields(current, candidate, plugin.id);
        current = candidate;
      }
    }
    return current;
  }

  async afterAgent(result: AgentResult): Promise<AgentResult> {
    let current = result;
    for (const plugin of this.plugins) {
      if (plugin.afterAgent) {
        const candidate = await plugin.afterAgent(current);
        assertResultControlFields(current, candidate, plugin.id);
        current = candidate;
      }
    }
    return current;
  }
}

const ENVELOPE_CONTROL_FIELDS = [
  "schema",
  "sessionId",
  "messageId",
  "correlationId",
  "causationId",
  "idempotencyKey",
  "from",
  "to",
  "kind",
  "turn",
  "maxTurns",
  "stateVersion",
  "createdAt"
] as const satisfies ReadonlyArray<keyof PathEnvelope>;

const RESULT_CONTROL_FIELDS = [
  "messageId",
  "correlationId",
  "identity",
  "kind",
  "nextTarget",
  "model",
  "sourceVersion"
] as const satisfies ReadonlyArray<keyof AgentResult>;

function assertEnvelopeControlFields(
  before: PathEnvelope,
  after: PathEnvelope,
  pluginId: string
): void {
  for (const field of ENVELOPE_CONTROL_FIELDS) {
    if (after[field] !== before[field]) throw new Error(`PLUGIN_CONTROL_FIELD_MUTATION:${pluginId}:${field}`);
  }
}

function assertResultControlFields(
  before: AgentResult,
  after: AgentResult,
  pluginId: string
): void {
  for (const field of RESULT_CONTROL_FIELDS) {
    if (after[field] !== before[field]) throw new Error(`PLUGIN_CONTROL_FIELD_MUTATION:${pluginId}:${field}`);
  }
}
