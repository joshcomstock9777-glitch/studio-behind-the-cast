import { YOUTUBE_DESTINATIONS } from "../../../../../lib/youtube-destinations";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const destinationId = url.searchParams.get("destinationId");
  const meta = YOUTUBE_DESTINATIONS.find((d) => d.destinationId === destinationId);
  if (!meta) {
    return Response.json({ error: "UNKNOWN_DESTINATION" }, { status: 400 });
  }

  const clientId = process.env[`${meta.envPrefix}_CLIENT_ID`]?.trim();
  const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) {
    return Response.json(
      {
        humanGate: true,
        destinationId: meta.destinationId,
        intendedName: meta.intendedName,
        message:
          "OAuth client is not configured for this destination. Set CLIENT_ID and YOUTUBE_OAUTH_REDIRECT_URI on the server, then retry.",
      },
      { status: 503 },
    );
  }

  const state = `${meta.destinationId}.${crypto.randomUUID()}`;
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("access_type", "offline");
  auth.searchParams.set("prompt", "consent");
  auth.searchParams.set("scope", SCOPES);
  auth.searchParams.set("state", state);

  return Response.json({
    humanGate: true,
    destinationId: meta.destinationId,
    intendedName: meta.intendedName,
    consentUrl: auth.toString(),
    instruction: "Open consentUrl while logged into the Google account that owns this exact channel. One grant per destination.",
  });
}
