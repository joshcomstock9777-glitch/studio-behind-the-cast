export type AssetKind = "source_media" | "project_state" | "rendered_output";

export interface PersistAssetInput {
  name: string;
  kind: AssetKind;
  uri?: string;
  mimeType?: string;
  projectName?: string;
  parentAssetIds: string[];
  metadata?: Record<string, string | number | boolean | null>;
}

export interface StoredAsset {
  id: string;
  name: string;
  kind: AssetKind;
  storageState: "durable";
  uri?: string;
  mimeType?: string;
  provenance: {
    source: "editor_project" | "renderer" | "user_uri";
    sourceUri?: string;
    projectName?: string;
    createdAt: number;
    parentAssetIds: string[];
  };
  metadata: Record<string, string | number | boolean | null>;
}

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

export function getAssetStorageConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.ASSET_STORAGE_BUCKET?.trim();
  if (!url || !serviceRoleKey || !bucket) return null;
  return { url, serviceRoleKey, bucket };
}

export async function probeAssetStorage(config: SupabaseConfig): Promise<{ connected: boolean; backend: string; message?: string }> {
  try {
    const response = await fetch(`${config.url}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`, {
      method: "GET",
      headers: authHeaders(config),
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        connected: false,
        backend: "supabase-storage",
        message: `Supabase Storage bucket probe returned HTTP ${response.status}.`,
      };
    }
    return { connected: true, backend: "supabase-storage" };
  } catch (error) {
    return {
      connected: false,
      backend: "supabase-storage",
      message: error instanceof Error ? error.message : "Supabase Storage probe failed.",
    };
  }
}

export async function persistAssetRecord(config: SupabaseConfig, input: PersistAssetInput) {
  validateInput(input);

  const confirmedAt = Date.now();
  const id = `asset-${confirmedAt}-${crypto.randomUUID()}`;
  const objectPath = `${input.kind}/${new Date(confirmedAt).toISOString().slice(0, 10)}/${id}.json`;
  const asset: StoredAsset = {
    id,
    name: input.name,
    kind: input.kind,
    storageState: "durable",
    uri: input.uri,
    mimeType: input.mimeType,
    provenance: {
      source: input.kind === "rendered_output" ? "renderer" : input.kind === "source_media" ? "user_uri" : "editor_project",
      sourceUri: input.kind === "source_media" ? input.uri : undefined,
      projectName: input.projectName,
      createdAt: confirmedAt,
      parentAssetIds: [...input.parentAssetIds],
    },
    metadata: {
      ...(input.metadata ?? {}),
      durable: true,
      storageBackend: "supabase-storage",
      storageObjectPath: objectPath,
    },
  };

  const response = await fetch(
    `${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      headers: {
        ...authHeaders(config),
        "Content-Type": "application/json",
        "x-upsert": "false",
      },
      body: JSON.stringify(asset),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase Storage persistence returned HTTP ${response.status}.`);
  }

  return {
    durable: true as const,
    externalStorageId: `${config.bucket}/${objectPath}`,
    confirmedAt,
    asset,
  };
}

function authHeaders(config: SupabaseConfig) {
  return {
    Authorization: `Bearer ${config.serviceRoleKey}`,
    apikey: config.serviceRoleKey,
  };
}

function validateInput(input: PersistAssetInput) {
  if (!input || typeof input !== "object") throw new Error("INVALID_ASSET_INPUT");
  if (!input.name?.trim()) throw new Error("ASSET_NAME_REQUIRED");
  if (!(["source_media", "project_state", "rendered_output"] as const).includes(input.kind)) {
    throw new Error("INVALID_ASSET_KIND");
  }
  if (!Array.isArray(input.parentAssetIds) || input.parentAssetIds.some((id) => typeof id !== "string")) {
    throw new Error("INVALID_PARENT_ASSET_IDS");
  }
  if (input.kind === "rendered_output" && !input.uri) throw new Error("RENDERED_OUTPUT_URI_REQUIRED");
}
