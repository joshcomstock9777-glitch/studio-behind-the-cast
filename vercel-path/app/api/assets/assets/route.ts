import { getAssetStorageConfig, persistAssetRecord, type PersistAssetInput } from "../../../../lib/asset-storage";

export async function POST(request: Request): Promise<Response> {
  const config = getAssetStorageConfig();
  if (!config) {
    return Response.json(
      { error: "ASSET_STORAGE_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  let input: PersistAssetInput;
  try {
    input = (await request.json()) as PersistAssetInput;
  } catch {
    return Response.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  try {
    const confirmation = await persistAssetRecord(config, input);
    return Response.json(confirmation, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Asset persistence failed.";
    const validationError = [
      "INVALID_ASSET_INPUT",
      "ASSET_NAME_REQUIRED",
      "INVALID_ASSET_KIND",
      "INVALID_PARENT_ASSET_IDS",
      "RENDERED_OUTPUT_URI_REQUIRED",
    ].includes(message);

    return Response.json(
      { error: validationError ? message : "ASSET_PERSISTENCE_FAILED" },
      { status: validationError ? 400 : 502 },
    );
  }
}
