import { getRendererConfig, probeRenderer } from "../../../../lib/renderer";

export async function GET(): Promise<Response> {
  const config = getRendererConfig();
  if (!config) {
    return Response.json(
      {
        connected: false,
        backend: "renderer-worker",
        message: "Renderer worker server configuration is incomplete.",
      },
      { status: 503 },
    );
  }

  const health = await probeRenderer(config);
  return Response.json(health, { status: health.connected ? 200 : 503 });
}
