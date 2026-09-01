const DESTINATIONS = {
  'youtube-primary': 'YOUTUBE_PRIMARY',
  'youtube-horror': 'YOUTUBE_HORROR',
  'youtube-variety': 'YOUTUBE_VARIETY',
  'youtube-fixit': 'YOUTUBE_FIXIT',
} as const;

export type YouTubeDestinationId = keyof typeof DESTINATIONS;

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface YouTubeDestinationHealth {
  destinationId: YouTubeDestinationId;
  connected: boolean;
  channelId?: string;
  reason?: 'not_configured' | 'oauth_failed' | 'channel_probe_failed';
}

export function isYouTubeDestinationId(value: string): value is YouTubeDestinationId {
  return Object.prototype.hasOwnProperty.call(DESTINATIONS, value);
}

function configFor(destinationId: YouTubeDestinationId): OAuthConfig | null {
  const prefix = DESTINATIONS[destinationId];
  const clientId = process.env[`${prefix}_CLIENT_ID`]?.trim();
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]?.trim();
  const refreshToken = process.env[`${prefix}_REFRESH_TOKEN`]?.trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

async function getAccessToken(config: OAuthConfig): Promise<string | null> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { access_token?: unknown };
  return typeof json.access_token === 'string' && json.access_token ? json.access_token : null;
}

export async function probeYouTubeDestination(destinationId: YouTubeDestinationId): Promise<YouTubeDestinationHealth> {
  const config = configFor(destinationId);
  if (!config) return { destinationId, connected: false, reason: 'not_configured' };

  const accessToken = await getAccessToken(config);
  if (!accessToken) return { destinationId, connected: false, reason: 'oauth_failed' };

  const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true&maxResults=1', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) return { destinationId, connected: false, reason: 'channel_probe_failed' };

  const json = (await response.json()) as { items?: Array<{ id?: unknown }> };
  const channelId = json.items?.[0]?.id;
  if (typeof channelId !== 'string' || !channelId) {
    return { destinationId, connected: false, reason: 'channel_probe_failed' };
  }

  return { destinationId, connected: true, channelId };
}
