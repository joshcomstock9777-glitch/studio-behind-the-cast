# Crate 002 — Wake Bridge V2 (Studio 3)

Live UI: https://joshcomstock9777-glitch.github.io/studio-behind-the-cast/v2/
Worker: https://moonshadow-wake-relay-poc.joshcomstock9777.workers.dev
Firebase project: moonshadow-wake-relay-poc
Namespace: bridge/wake-poc/v1

## Chain
1. Pages UI (`v2/index.html` + `app.js`)
2. Anonymous Firebase auth + RTDB queue
3. POST Cloudflare worker
4. Worker calls GitHub Models, then Azure Models, then OpenAI
5. UI writes response back into RTDB `/responses`

## Probe 2026-09-01
Worker GET: 200. Service `Moonshadow Wake Relay POC v5.1`. CORS `*`.
Agents advertised: Allie, Amber, Designer, Editor, Publisher, Runner, Producer, Caretaker.
Flags: githubModelsTokenPresent, openaiKeyPresent, ntfyReady, crossTalkEnabled, caretakerScheduled.

Worker POST: 500. No LLM provider available.
- GitHub models.github.ai → 410 (endpoint gone)
- Azure models.inference.ai.azure.com → 530
- OpenAI → 401. Secret is not an API key (value starts like a name, not `sk-`).

UI on Pages: 200.
Vercel `/v2`: 404. This studio is Pages + Worker + Firebase, not Path.

Worker source is NOT in this repo. Cannot patch provider URLs from GitHub.

## Hookup blocker
Replace Cloudflare Worker secrets with a real model key, and/or update the worker to a live GitHub Models URL. Until then the queue will mark requests `failed`.

## Verdict
Skin + queue + worker process: UP.
Brain of the worker: DEAD keys.
Tag: hook-blocked.
