import { clientSecretAccepted, issueNativeToken } from "../../../../lib/native-auth";

export async function POST(request: Request): Promise<Response> {
  const expectedHash = process.env.NATIVE_CLIENT_SECRET_HASH ?? "";
  const signingSecret = process.env.TOKEN_SIGNING_SECRET ?? "";
  if (!expectedHash || !signingSecret) {
    return Response.json({ error: "NATIVE_AUTH_NOT_CONFIGURED" }, { status: 503 });
  }

  const candidate = request.headers.get("x-native-client-secret") ?? "";
  if (!(await clientSecretAccepted(candidate, expectedHash))) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const issued = await issueNativeToken(signingSecret);
  return Response.json({ accessToken: issued.token, tokenType: "Bearer", expiresIn: issued.expiresIn });
}
