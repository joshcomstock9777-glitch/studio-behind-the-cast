import assert from "node:assert/strict";
import test from "node:test";
import { clientSecretAccepted, issueNativeToken, verifyNativeToken } from "../lib/native-auth.ts";

async function hashSecret(secret: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)));
  return Buffer.from(bytes).toString("base64url");
}

test("accepts only the client secret matching the configured SHA-256 hash", async () => {
  const hash = await hashSecret("native-client-secret");
  assert.equal(await clientSecretAccepted("native-client-secret", hash), true);
  assert.equal(await clientSecretAccepted("wrong-secret", hash), false);
});

test("issues a short-lived token and verifies its signature", async () => {
  const issued = await issueNativeToken("token-signing-secret", 1_000);
  assert.equal(issued.expiresIn, 300);
  assert.equal(await verifyNativeToken(issued.token, "token-signing-secret", 1_001), true);
});

test("rejects a token signed with a different secret", async () => {
  const issued = await issueNativeToken("token-signing-secret", 1_000);
  assert.equal(await verifyNativeToken(issued.token, "different-secret", 1_001), false);
});

test("rejects an expired token", async () => {
  const issued = await issueNativeToken("token-signing-secret", 1_000);
  assert.equal(await verifyNativeToken(issued.token, "token-signing-secret", 1_301), false);
});
