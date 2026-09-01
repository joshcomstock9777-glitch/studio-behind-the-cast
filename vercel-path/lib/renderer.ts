import { getAssetStorageConfig, persistAssetRecord } from "./asset-storage";

type RendererConfig = {
  workerUrl: string;
  workerToken?: string;
};

export interface RenderRequestInput {
  projectAssetId: string;
  outputName: string;
  projectName?: string;
  mimeType?: string;
}

export function getRendererConfig(): RendererConfig | null {
  const workerUrl = process.env.RENDERER_WORKER_URL?.trim().replace(/\/+$/, "");
  const workerToken = process.env.RENDERER_WORKER_TOKEN?.trim();
  if (!workerUrl) return null;
  return { workerUrl, workerToken };
}

export async function probeRenderer(config: RendererConfig) {
  try {
    const response = await fetch(`${config.workerUrl}/health`, {
      method: "GET",
      headers: rendererHeaders(config),
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        connected: false,
        backend: "renderer-worker",
        message: `Renderer worker health returned HTTP ${response.status}.`,
      };
    }
    const body = (await response.json()) as { connected?: unknown; backend?: unknown; message?: unknown };
    if (body.connected !== true) {
      return {
        connected: false,
        backend: typeof body.backend === "string" ? body.backend : "renderer-worker",
        message: typeof body.message === "string" ? body.message : "Renderer worker did not confirm connectivity.",
      };
    }
    return {
      connected: true,
      backend: typeof body.backend === "string" ? body.backend : "renderer-worker",
      message: typeof body.message === "string" ? body.message : undefined,
    };
  } catch (error) {
    return {
      connected: false,
      backend: "renderer-worker",
      message: error instanceof Error ? error.message : "Renderer worker probe failed.",
    };
  }
}

export async function renderAndPersist(config: RendererConfig, input: RenderRequestInput) {
  validateRenderInput(input);
  const storageConfig = getAssetStorageConfig();
  if (!storageConfig) throw new Error("ASSET_STORAGE_NOT_CONFIGURED");

  const response = await fetch(`${config.workerUrl}/renders`, {
    method: "POST",
    headers: {
      ...rendererHeaders(config),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Renderer worker returned HTTP ${response.status}.`);

  const body = (await response.json()) as {
    rendered?: unknown;
    externalRenderId?: unknown;
    outputUri?: unknown;
    mimeType?: unknown;
  };
  if (body.rendered !== true) throw new Error("Renderer worker did not confirm completion.");
  if (typeof body.externalRenderId !== "string" || !body.externalRenderId.trim()) {
    throw new Error("Renderer worker omitted external render evidence.");
  }
  if (typeof body.outputUri !== "string" || !body.outputUri.trim()) {
    throw new Error("Renderer worker omitted a durable output URI.");
  }

  const stored = await persistAssetRecord(storageConfig, {
    name: input.outputName,
    kind: "rendered_output",
    uri: body.outputUri,
    mimeType: typeof body.mimeType === "string" ? body.mimeType : input.mimeType,
    projectName: input.projectName,
    parentAssetIds: [input.projectAssetId],
    metadata: {
      externalRenderId: body.externalRenderId,
      rendererBackend: config.workerUrl,
    },
  });

  return {
    rendered: true as const,
    externalRenderId: body.externalRenderId,
    confirmedAt: stored.confirmedAt,
    asset: stored.asset,
  };
}

function rendererHeaders(config: RendererConfig): Record<string, string> {
  const headers: Record<string, string> = {};
  if (config.workerToken) headers.Authorization = `Bearer ${config.workerToken}`;
  return headers;
}

function validateRenderInput(input: RenderRequestInput) {
  if (!input || typeof input !== "object") throw new Error("INVALID_RENDER_INPUT");
  if (!input.projectAssetId?.trim()) throw new Error("PROJECT_ASSET_ID_REQUIRED");
  if (!input.outputName?.trim()) throw new Error("OUTPUT_NAME_REQUIRED");
}
