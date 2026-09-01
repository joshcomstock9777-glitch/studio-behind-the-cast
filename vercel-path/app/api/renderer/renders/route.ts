import { getRendererConfig, renderAndPersist, type RenderRequestInput } from "../../../../lib/renderer";

export async function POST(request: Request): Promise<Response> {
  const config = getRendererConfig();
  if (!config) {
    return Response.json(
      {
        rendered: false,
        message: "Renderer worker server configuration is incomplete.",
      },
      { status: 503 },
    );
  }

  try {
    const input = (await request.json()) as RenderRequestInput;
    const result = await renderAndPersist(config, input);
    return Response.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Renderer request failed.";
    const status = message === "ASSET_STORAGE_NOT_CONFIGURED" ? 503 : 400;
    return Response.json({ rendered: false, message }, { status });
  }
}
