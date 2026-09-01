# Crate 001 — Moonshadow Studio #2 Tribunal Edition

Played with it. Did not flip live blindly.

## What the shell is
Operator skin for a 3-seat tribunal: Herman (judge), Allie (OpenAI), Dynamite (Gemini).
Pretty. Self-contained. Mock stream is honest theater.

## What PATH actually is
Live route: POST https://moonshadow-path-proof.vercel.app/api/sessions

Contract from vercel-path/app/api/sessions/route.ts:
- Body: `{ target: "allie" | "amber", message: string }`
- Not `{ sessionId, prompt, config: { stream, mode } }`
- Returns 202 JSON `{ sessionId, correlationId, status: "open" }`
- Then poll GET `/api/sessions/:id`
- Cap: 3 calls, Allie → Amber → Allie
- Identities: allie | amber only. No Herman. No Dynamite.

## Probe 2026-08-31
- GET /api/sessions → 405
- POST tribunal payload → 403 ORIGIN_DENIED
- CORS is exact-origin. This sandbox is not allowlisted.
- UI claims SSE. Route does not stream.

## Verdict
KEEP as cockpit skin. Protocol mismatch. Tag: parts.
