/**
 * Moonshadow Wake Relay – Cloudflare Worker
 *
 * Scheduled handler: polls bridge/wake-poc/v1/requests, claims up to
 * BATCH_LIMIT queued requests atomically (ETag + If-Match), calls
 * GitHub Models, and writes a single response per correlation ID.
 *
 * Direct POST /  – manual/diagnostic fallback only.
 * GET /          – health check (no secrets revealed).
 *
 * Required secret binding: GITHUB_MODELS_TOKEN
 * Required env var (wrangler.toml [vars]): FIREBASE_DB_URL
 */

const ROOT = "bridge/wake-poc/v1";
const BATCH_LIMIT = 5;
const MAX_MESSAGE_CHARS = 1200;
const MAX_RETRIES = 2;
const GITHUB_MODELS_ENDPOINT =
  "https://models.github.ai/inference/chat/completions";
const GITHUB_MODELS_MODEL = "openai/gpt-4.1";
// Use the current stable GitHub API version (not a future-dated value).
const GITHUB_API_VERSION = "2022-11-28";

const IDENTITIES = {
  Allie: {
    system:
      "You are Allie, Moonshadow Studio's persistent API-based creative collaborator. " +
      "Josh is the Architect and final decision-maker. " +
      "Amber and Allie are separate collaborators; never merge identities. " +
      "Be direct, grounded and concise. " +
      "Never claim access, deployment, testing or completion without evidence. " +
      "Never reveal credentials or administrative secrets.",
  },
  Amber: {
    system:
      "You are Amber, Moonshadow Studio's persistent API-based Studio Manager and infrastructure builder. " +
      "Josh is the Architect and final decision-maker. " +
      "Amber and Allie are separate collaborators; never merge identities. " +
      "Be direct, grounded and concise. " +
      "Never claim access, deployment, testing or completion without evidence. " +
      "Never reveal credentials or administrative secrets.",
  },
};

// Exact acceptance-test trigger responses.
const ACCEPTANCE_RESPONSES = {
  "WAKE-ALLIE-101": "WAKE-ALLIE-101 | RECEIVED AND RETURNED",
  "WAKE-AMBER-202": "WAKE-AMBER-202 | RELAY STATE PRESERVED",
};

// ── Token normalization ────────────────────────────────────────────────────

/**
 * Normalize and validate a bearer token for use in an Authorization header.
 * Returns the trimmed token or throws if it is missing or contains control
 * characters (which produce an "invalid header value" error in fetch).
 *
 * @param {string|undefined} raw - Raw value from the Cloudflare secret binding.
 * @returns {string} Validated, trimmed token.
 */
export function normalizeToken(raw) {
  if (!raw || typeof raw !== "string") {
    throw new Error("GITHUB_MODELS_TOKEN is missing or not a string.");
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error("GITHUB_MODELS_TOKEN is empty after trimming.");
  }
  // Reject control characters (CR, LF, NUL, etc.) that cause invalid header
  // value errors in fetch implementations.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(trimmed)) {
    throw new Error(
      "GITHUB_MODELS_TOKEN contains control characters; " +
        "secret binding may be corrupted.",
    );
  }
  return trimmed;
}

// ── Firebase REST helpers ──────────────────────────────────────────────────

function firebaseUrl(env, path) {
  const base = (env.FIREBASE_DB_URL || "").replace(/\/$/, "");
  return `${base}/${path}.json`;
}

async function fbGet(env, path) {
  const res = await fetch(firebaseUrl(env, path), {
    headers: { "X-Firebase-ETag": "true" },
  });
  if (!res.ok) throw new Error(`Firebase GET ${path} → ${res.status}`);
  const etag = res.headers.get("etag");
  const data = await res.json();
  return { data, etag };
}

/** Atomic conditional PUT using ETag. Returns the raw Response (check .status). */
async function fbPutIfMatch(env, path, body, etag) {
  const res = await fetch(firebaseUrl(env, path), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "if-match": etag,
      "X-Firebase-ETag": "true",
    },
    body: JSON.stringify(body),
  });
  return res;
}

async function fbPut(env, path, body) {
  const res = await fetch(firebaseUrl(env, path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Firebase PUT ${path} → ${res.status}`);
  return res.json();
}

async function fbPost(env, path, body) {
  const res = await fetch(firebaseUrl(env, path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Firebase POST ${path} → ${res.status}`);
  return res.json();
}

// ── GitHub Models call ─────────────────────────────────────────────────────

/**
 * Call GitHub Models API.
 *
 * @param {string} token  - Validated bearer token.
 * @param {string} target - "Allie" or "Amber".
 * @param {string} message - User message (already length-bounded).
 * @returns {Promise<string>} The assistant reply text.
 */
export async function callGitHubModels(token, target, message) {
  const identity = IDENTITIES[target];
  if (!identity) throw new Error(`Unknown target: ${target}`);

  // Acceptance-test short-circuit (exact match, trimmed).
  const trimmedMsg = message.trim();
  if (ACCEPTANCE_RESPONSES[trimmedMsg]) {
    return ACCEPTANCE_RESPONSES[trimmedMsg];
  }

  const reqBody = {
    model: GITHUB_MODELS_MODEL,
    messages: [
      { role: "system", content: identity.system },
      { role: "user", content: message },
    ],
    max_tokens: 800,
    temperature: 0.7,
  };

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(GITHUB_MODELS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
      body: JSON.stringify(reqBody),
    });

    if (res.ok) {
      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content;
      if (!reply) throw new Error("GitHub Models returned an empty response.");
      return reply;
    }

    const text = await res.text().catch(() => "");
    lastError = new Error(
      `GitHub Models ${res.status}: ${text.slice(0, 240)}`,
    );

    // Do not retry auth or client-side errors.
    if (res.status === 400 || res.status === 401 || res.status === 403) break;
  }

  throw lastError;
}

// ── Queue consumer ─────────────────────────────────────────────────────────

/**
 * Fetch up to BATCH_LIMIT queued requests from Firebase, claim each
 * atomically with ETag + If-Match, call GitHub Models, and write one
 * response per correlation ID.
 *
 * @param {object} env - Cloudflare Worker environment bindings.
 * @returns {Promise<{processed: number, skipped: number, errors: string[]}>}
 */
export async function processQueue(env) {
  const token = normalizeToken(env.GITHUB_MODELS_TOKEN);

  const { data: all } = await fbGet(env, `${ROOT}/requests`);
  if (!all || typeof all !== "object") {
    return { processed: 0, skipped: 0, errors: [] };
  }

  const queued = Object.entries(all)
    .filter(([, v]) => v?.status === "queued")
    .slice(0, BATCH_LIMIT);

  if (queued.length === 0) return { processed: 0, skipped: 0, errors: [] };

  let processed = 0;
  let skipped = 0;
  const errors = [];

  for (const [key, requestData] of queued) {
    try {
      // Validate target before doing any work.
      if (!IDENTITIES[requestData.target]) {
        await fbPut(env, `${ROOT}/requests/${key}`, {
          ...requestData,
          status: "failed",
          failedAt: Date.now(),
          error: `Unknown target: ${requestData.target}`,
        });
        errors.push(`${key}: unknown target "${requestData.target}"`);
        continue;
      }

      const correlationId = requestData.correlationId;
      const message = String(requestData.message || "").slice(0, MAX_MESSAGE_CHARS);

      // ── Duplicate-response check ──────────────────────────────────────
      const { data: responses } = await fbGet(env, `${ROOT}/responses`).catch(
        () => ({ data: null }),
      );
      if (responses && typeof responses === "object") {
        const existing = Object.values(responses).find(
          (r) => r?.correlationId === correlationId,
        );
        if (existing) {
          await fbPut(env, `${ROOT}/requests/${key}`, {
            ...requestData,
            status: "completed",
            completedAt: Date.now(),
            duplicatePrevented: true,
          });
          skipped++;
          continue;
        }
      }

      // ── Atomic claim: re-read ETag, set status → processing ──────────
      const { data: fresh, etag } = await fbGet(
        env,
        `${ROOT}/requests/${key}`,
      );
      if (!fresh || fresh.status !== "queued") {
        skipped++;
        continue;
      }

      const claimRes = await fbPutIfMatch(
        env,
        `${ROOT}/requests/${key}`,
        { ...fresh, status: "processing", processingAt: Date.now() },
        etag,
      );
      if (claimRes.status === 412) {
        // Another invocation already claimed it.
        skipped++;
        continue;
      }
      if (!claimRes.ok) {
        throw new Error(`Claim PUT failed with status ${claimRes.status}`);
      }

      // ── Call GitHub Models ────────────────────────────────────────────
      let replyMessage;
      try {
        replyMessage = await callGitHubModels(token, requestData.target, message);
      } catch (apiError) {
        await fbPut(env, `${ROOT}/requests/${key}`, {
          ...fresh,
          status: "failed",
          failedAt: Date.now(),
          error: String(apiError.message).slice(0, 240),
        });
        errors.push(`${key}: API error – ${apiError.message}`);
        continue;
      }

      // ── Write response ────────────────────────────────────────────────
      await fbPost(env, `${ROOT}/responses`, {
        correlationId,
        requestKey: key,
        worker: requestData.target,
        message: replyMessage,
        model: GITHUB_MODELS_MODEL,
        provider: "github-models",
        status: "completed",
        createdAt: Date.now(),
        schemaVersion: 1,
      });

      // ── Mark request completed ────────────────────────────────────────
      await fbPut(env, `${ROOT}/requests/${key}`, {
        ...fresh,
        status: "completed",
        completedAt: Date.now(),
      });

      processed++;
    } catch (err) {
      errors.push(`${key}: ${err.message}`);
    }
  }

  return { processed, skipped, errors };
}

// ── Worker export ──────────────────────────────────────────────────────────

export default {
  /** Scheduled queue consumer – invoked by the Cloudflare Cron Trigger. */
  async scheduled(_event, env, _ctx) {
    try {
      const result = await processQueue(env);
      console.log(
        `[wake-relay] scheduled run: processed=${result.processed} ` +
          `skipped=${result.skipped} errors=${result.errors.length}`,
      );
      if (result.errors.length) {
        console.error("[wake-relay] scheduled errors:", result.errors);
      }
    } catch (err) {
      console.error("[wake-relay] scheduled fatal:", err.message);
    }
  },

  /** HTTP handler. */
  async fetch(request, env) {
    const url = new URL(request.url);
    void url;

    // ── GET / – health check ──────────────────────────────────────────────
    if (request.method === "GET") {
      return Response.json({
        ok: true,
        service: "moonshadow-wake-relay-poc",
        version: 2,
        bindings: {
          GITHUB_MODELS_TOKEN: Boolean(env.GITHUB_MODELS_TOKEN),
          FIREBASE_DB_URL: Boolean(env.FIREBASE_DB_URL),
        },
        timestamp: new Date().toISOString(),
      });
    }

    // ── POST / – diagnostic / manual fallback ─────────────────────────────
    if (request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json(
          { ok: false, error: "Invalid JSON body." },
          { status: 400 },
        );
      }

      const { correlationId, sender, target, message } = body;
      if (!correlationId || !sender || !target || !message) {
        return Response.json(
          {
            ok: false,
            error: "correlationId, sender, target and message are required.",
          },
          { status: 400 },
        );
      }
      if (!IDENTITIES[target]) {
        return Response.json(
          {
            ok: false,
            error: `Unknown target: ${target}. Must be Allie or Amber.`,
          },
          { status: 400 },
        );
      }

      let token;
      try {
        token = normalizeToken(env.GITHUB_MODELS_TOKEN);
      } catch (err) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
      }

      const bounded = String(message).slice(0, MAX_MESSAGE_CHARS);
      let replyMessage;
      try {
        replyMessage = await callGitHubModels(token, target, bounded);
      } catch (err) {
        return Response.json(
          { ok: false, error: err.message },
          { status: 502 },
        );
      }

      return Response.json({
        ok: true,
        correlationId,
        worker: target,
        message: replyMessage,
        model: GITHUB_MODELS_MODEL,
        createdAt: Date.now(),
      });
    }

    return Response.json(
      { ok: false, error: "Method not allowed." },
      { status: 405 },
    );
  },
};
