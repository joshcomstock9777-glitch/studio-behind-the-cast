import { YOUTUBE_DESTINATIONS } from "../../../../lib/youtube-destinations";
import { probeYouTubeDestination } from "../../../../lib/youtube-publisher";

export async function GET(): Promise<Response> {
  const destinations = await Promise.all(
    YOUTUBE_DESTINATIONS.map(async (meta) => {
      const health = await probeYouTubeDestination(meta.destinationId);
      return {
        ...meta,
        connected: health.connected,
        channelId: health.channelId ?? null,
        reason: health.reason ?? null,
        handleVerified: false,
        lastVerifiedAt: new Date().toISOString(),
      };
    }),
  );

  return Response.json(
    { destinations },
    { status: destinations.every((d) => d.connected) ? 200 : 503 },
  );
}
