import { getAssetStorageConfig, probeAssetStorage } from "../../../../lib/asset-storage";

export async function GET(): Promise<Response> {
  const config = getAssetStorageConfig();
  if (!config) {
    return Response.json(
      {
        connected: false,
        backend: "supabase-storage",
        message: "Asset storage server configuration is incomplete.",
      },
      { status: 503 },
    );
  }

  const health = await probeAssetStorage(config);
  return Response.json(health, { status: health.connected ? 200 : 503 });
}
