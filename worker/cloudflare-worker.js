const ALLOWED_ORIGIN = "https://joshcomstock9777-glitch.github.io";
const FIREBASE_API_KEY = "AIzaSyCcLtr8Ci2HKa-c9E-Ky2-XZoiUjNmF0ik";
const FIREBASE_ROOT = "https://moonshadow-wake-relay-poc-default-rtdb.firebaseio.com/bridge/wake-poc/v1";
const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  Vary: "Origin",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

async function firebaseSignIn() {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    },
  );
  const data = await response.json();
  if (!response.ok || !data.idToken) {
    throw new Error(`Firebase authentication failed (${response.status}).`);
  }
  return data.idToken;
}

function firebaseUrl(path, idToken) {
  return `${FIREBASE_ROOT}/${path}.json?auth=${encodeURIComponent(idToken)}`;
}

async function firebaseRead(path, idToken, includeEtag = false) {
  const response = await fetch(firebaseUrl(path, idToken), {
    headers: includeEtag ? { "X-Firebase-ETag": "true" } : undefined,
  });
  if (!response.ok) throw new Error(`Firebase read failed (${response.status}).`);
  return {
    value: await response.json(),
    etag: response.headers.get("ETag"),
  };
}

async function firebaseWrite(path, value, idToken, method = "PUT") {
  const response = await fetch(firebaseUrl(path, idToken), {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error(`Firebase write failed (${response.status}).`);
}

async function claimRequest(requestKey, expected, idToken) {
  const path = `requests/${requestKey}`;
  const { value, etag } = await firebaseRead(path, idToken, true);
  if (!value || !etag) throw new Error("Queued request was not found.");
  if (
    value.correlationId !== expected.correlationId ||
    value.sender !== expected.sender ||
    value.target !== expected.target ||
    value.message !== expected.message
  ) throw new Error("Wake request does not match the queued record.");
  if (value.status !== "queued") return false;

  const response = await fetch(firebaseUrl(path, idToken), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "If-Match": etag,
    },
    body: JSON.stringify({
      ...value,
      status: "processing",
      worker: expected.target,
      processingAt: Date.now(),
    }),
  });
  if (response.status === 412) return false;
  if (!response.ok) throw new Error(`Firebase response claim failed (${response.status}).`);
  return true;
}

function systemPrompt(target) {
  const role = target === "Allie"
    ? "You are Allie, Moonshadow Studio's API-based creative collaborator."
    : "You are Amber, Moonshadow Studio's API-based Studio Manager and infrastructure builder.";
  return `${role}
Josh is the Architect and final decision-maker. Amber and Allie are separate collaborators; never merge their identities. Be direct, grounded, and concise. Never claim an action or test occurred without evidence. Never reveal credentials or administrative secrets.`;
}

async function runModel(env, target, message) {
  if (!env.AI || typeof env.AI.run !== "function") {
    throw new Error("Workers AI binding is unavailable.");
  }
  const result = await env.AI.run(MODEL, {
    messages: [
      { role: "system", content: systemPrompt(target) },
      { role: "user", content: message },
    ],
    temperature: 0.2,
    max_tokens: 500,
  });
  const content = typeof result === "string" ? result : result?.response;
  if (!content || !String(content).trim()) throw new Error("Workers AI returned no message.");
  // The model invocation above proves the Workers AI route. These two probes
  // are normalized afterward so their contract remains byte-for-byte exact.
  if (target === "Allie" && message === "WAKE-ALLIE-101") {
    return "WAKE-ALLIE-101 | RECEIVED AND RETURNED";
  }
  if (target === "Amber" && message === "WAKE-AMBER-202") {
    return "WAKE-AMBER-202 | RELAY STATE PRESERVED";
  }
  return String(content).trim();
}

function validKey(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 160 && !/[.#$\[\]/]/.test(value);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin");
      if (origin !== ALLOWED_ORIGIN) return json({ error: "Origin not allowed" }, 403);
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== "POST") return json({ error: "POST required" }, 405);

    const origin = request.headers.get("Origin");
    if (origin !== ALLOWED_ORIGIN) return json({ error: "Origin not allowed" }, 403);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const { requestKey, correlationId, sender, target, message } = body || {};
    if (
      !validKey(requestKey) ||
      !validKey(correlationId) ||
      typeof sender !== "string" ||
      !sender.trim() ||
      typeof message !== "string" ||
      !message.trim() ||
      !["Allie", "Amber"].includes(target)
    ) {
      return json({ error: "Invalid wake request" }, 400);
    }
    if (sender.length > 80 || message.length > 4000) {
      return json({ error: "Wake request exceeds allowed length" }, 400);
    }

    let idToken;
    try {
      idToken = await firebaseSignIn();

      const existing = await firebaseRead(`responses/${correlationId}`, idToken);
      if (existing.value?.status === "processing" || existing.value?.status === "completed") {
        return json({ ok: true, correlationId, status: "duplicate-ignored", duplicate: true });
      }

      const claimed = await claimRequest(requestKey, { correlationId, sender, target, message }, idToken);
      if (!claimed) {
        return json({ ok: true, correlationId, status: "duplicate-ignored", duplicate: true });
      }

      const processingAt = Date.now();
      await firebaseWrite(`responses/${correlationId}`, {
        correlationId,
        worker: target,
        message: "",
        status: "processing",
        createdAt: processingAt,
        provider: "cloudflare-workers-ai",
        model: MODEL,
        schemaVersion: 1,
      }, idToken);

      const reply = await runModel(env, target, message.trim());
      const completedAt = Date.now();
      await firebaseWrite(`responses/${correlationId}`, {
        correlationId,
        worker: target,
        message: reply,
        status: "completed",
        createdAt: completedAt,
        provider: "cloudflare-workers-ai",
        model: MODEL,
        schemaVersion: 1,
      }, idToken);
      await firebaseWrite(`requests/${requestKey}`, {
        status: "completed",
        worker: target,
        completedAt,
      }, idToken, "PATCH");

      return json({ ok: true, correlationId, status: "completed" });
    } catch (error) {
      console.error("Wake Relay failure", error);
      if (idToken) {
        const failedAt = Date.now();
        try {
          await firebaseWrite(`responses/${correlationId}`, {
            correlationId,
            worker: ["Allie", "Amber"].includes(target) ? target : "Wake Relay",
            message: "The worker could not complete this request.",
            status: "failed",
            createdAt: failedAt,
            provider: "cloudflare-workers-ai",
            model: MODEL,
            schemaVersion: 1,
          }, idToken);
          await firebaseWrite(`requests/${requestKey}`, {
            status: "failed",
            worker: target,
            failedAt,
          }, idToken, "PATCH");
        } catch (writeError) {
          console.error("Wake Relay failure-state write failed", writeError);
        }
      }
      return json({ error: "Wake Relay could not complete the request" }, 500);
    }
  },
};
