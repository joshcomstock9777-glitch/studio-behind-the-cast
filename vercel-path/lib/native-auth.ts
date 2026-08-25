const TOKEN_TTL_SECONDS = 300;

type NativeTokenPayload = {
  aud: "moonshadow-native";
  exp: number;
  iat: number;
  jti: string;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function stringToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToString(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function hmac(value: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return mismatch === 0;
}

export async function clientSecretAccepted(candidate: string, expectedHash: string): Promise<boolean> {
  if (!candidate || !expectedHash) return false;
  const actual = bytesToBase64Url(await sha256(candidate));
  return timingSafeEqual(new TextEncoder().encode(actual), new TextEncoder().encode(expectedHash.trim()));
}

export async function issueNativeToken(signingSecret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!signingSecret) throw new Error("NATIVE_AUTH_NOT_CONFIGURED");
  const payload: NativeTokenPayload = {
    aud: "moonshadow-native",
    iat: nowSeconds,
    exp: nowSeconds + TOKEN_TTL_SECONDS,
    jti: crypto.randomUUID()
  };
  const header = stringToBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = stringToBase64Url(JSON.stringify(payload));
  const unsigned = `${header}.${body}`;
  const signature = bytesToBase64Url(await hmac(unsigned, signingSecret));
  return { token: `${unsigned}.${signature}`, expiresIn: TOKEN_TTL_SECONDS };
}

export async function verifyNativeToken(token: string, signingSecret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!token || !signingSecret) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [header, body, suppliedSignature] = parts;
  try {
    const expectedSignature = bytesToBase64Url(await hmac(`${header}.${body}`, signingSecret));
    if (!timingSafeEqual(new TextEncoder().encode(suppliedSignature), new TextEncoder().encode(expectedSignature))) return false;
    const payload = JSON.parse(base64UrlToString(body)) as Partial<NativeTokenPayload>;
    return payload.aud === "moonshadow-native" && typeof payload.exp === "number" && payload.exp > nowSeconds && typeof payload.jti === "string";
  } catch {
    return false;
  }
}

export function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

export async function nativeRequestAuthorized(request: Request): Promise<boolean> {
  return verifyNativeToken(bearerToken(request), process.env.TOKEN_SIGNING_SECRET ?? "");
}
