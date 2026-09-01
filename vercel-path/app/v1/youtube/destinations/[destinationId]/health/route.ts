import { NextResponse } from 'next/server';
import { isYouTubeDestinationId, probeYouTubeDestination } from '../../../../../../lib/youtube-publisher';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ destinationId: string }> },
) {
  const { destinationId } = await context.params;
  if (!isYouTubeDestinationId(destinationId)) {
    return NextResponse.json({ error: 'unknown_destination' }, { status: 404 });
  }

  const health = await probeYouTubeDestination(destinationId);
  return NextResponse.json(health, {
    status: health.connected ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
