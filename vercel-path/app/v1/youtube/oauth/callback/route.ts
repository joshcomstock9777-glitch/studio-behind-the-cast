export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const destinationId = state.split(".")[0];

  if (!code || !destinationId) {
    return Response.json({ error: "OAUTH_CALLBACK_INCOMPLETE" }, { status: 400 });
  }

  return Response.json({
    humanGate: true,
    destinationId,
    message:
      "Authorization code received. Exchange must happen server-side. Store only the refresh token in Vercel env as {PREFIX}_REFRESH_TOKEN. Do not return tokens to the browser.",
    next: "Set the refresh token, then GET /v1/youtube/destinations/" + destinationId + "/health",
  });
}
