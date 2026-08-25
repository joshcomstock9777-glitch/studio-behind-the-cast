export function corsHeaders(origin: string | null): HeadersInit {
  const allowed = process.env.ALLOWED_ORIGIN;
  return allowed && origin === allowed
    ? { "access-control-allow-origin": origin, vary: "Origin" }
    : {};
}

export function originAllowed(origin: string | null, requestUrl: string): boolean {
  const sameOrigin = origin === new URL(requestUrl).origin;
  return sameOrigin || Boolean(process.env.ALLOWED_ORIGIN && origin === process.env.ALLOWED_ORIGIN);
}

export function json(body: unknown, status: number, origin: string | null): Response {
  return Response.json(body, { status, headers: corsHeaders(origin) });
}
