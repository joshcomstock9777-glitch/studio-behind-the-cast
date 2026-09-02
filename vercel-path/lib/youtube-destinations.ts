export const YOUTUBE_DESTINATIONS = [
  {
    destinationId: "youtube-horror" as const,
    intendedName: "What's That in the Corner",
    envPrefix: "YOUTUBE_HORROR",
    studioFamily: "dark-fiction",
  },
  {
    destinationId: "youtube-variety" as const,
    intendedName: "WTF?",
    envPrefix: "YOUTUBE_VARIETY",
    studioFamily: "comedy",
  },
  {
    destinationId: "youtube-fixit" as const,
    intendedName: "Buffalo Bills Wildlife / Fix-It",
    envPrefix: "YOUTUBE_FIXIT",
    studioFamily: "lifestyle-review",
  },
  {
    destinationId: "youtube-primary" as const,
    intendedName: "Joshua Comstock personal",
    envPrefix: "YOUTUBE_PRIMARY",
    studioFamily: "personal",
  },
];

export type DestinationRecord = (typeof YOUTUBE_DESTINATIONS)[number];
