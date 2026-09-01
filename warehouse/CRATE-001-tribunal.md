# Crate 001 — Moonshadow Studio #2 Tribunal Edition

## Skin
3-seat cockpit. Mock SSE. Seats: Herman / Allie / Dynamite.

## PATH contract (verified)
POST https://moonshadow-path-proof.vercel.app/api/sessions
Body must be `{ "target": "allie" | "amber", "message": "..." }`
Tribunal payload `{ sessionId, prompt, config }` → 400 INVALID_REQUEST even with a good Origin.

CORS: exact origin. Same-origin with the Vercel app works. Loose HTML / this sandbox → 403 ORIGIN_DENIED.
GET collection → 405. Poll GET /api/sessions/:id.

## Live session 2026-09-01
Opened as Origin `https://moonshadow-path-proof.vercel.app`
- sessionId: `wrun_01M1D61B8ETSPPG4NFSRSR9GA7`
- correlationId: `cf67b44c-ab16-4bab-8391-442c665faf42`
- seed → amber → allie → amber final
- calls: 3 / maxTurns: 3
- status: final
- model on all three: `openai/gpt-5.6-sol` via `vercel-ai-gateway-v2-fallbacks`
- They correctly refused a vague “warehouse probe” with no target/scope. Kernel is alive.

## Verdict
KEEP skin. Wire later only if hosted on an allowlisted origin and speaking `{target,message}` + poll, not fake SSE.
Tag: parts.
