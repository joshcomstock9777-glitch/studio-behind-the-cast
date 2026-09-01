# Packet 2 — Production commissioning (Grok)

**Branch:** `grok/packet-2-commissioning`  
**Base:** `studio-behind-the-cast` `main` @ `1a2bbc4`  
**Studio Go main left untouched** (Ellie).  
**HQ left untouched** (Amber).

Probed live Path: `https://moonshadow-path-proof.vercel.app` on 2026-09-01.

This is **not COMPLETE**. Published is not a database field.

## Live evidence (this run)

| Surface | Probe | Result |
|---|---|---|
| Asset storage | `GET /api/assets/health` | **503** `Asset storage server configuration is incomplete.` |
| Renderer | `GET /api/renderer/health` | **503** `Renderer worker server configuration is incomplete.` |
| YouTube primary | `GET /v1/youtube/destinations/youtube-primary/health` | **503** `not_configured` |
| YouTube horror | same pattern | **503** `not_configured` |
| YouTube variety | same pattern | **503** `not_configured` |
| YouTube fixit | same pattern | **503** `not_configured` |
| Wrong path `/app/v1/youtube/...` | | **404** — do not use |

Code for storage, renderer, and four-destination probes **already exists** on main. Production is missing server env and a render worker.

## Human-only gates (cannot be faked from this packet)

1. Vercel project for Path — set, do not commit:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ASSET_STORAGE_BUCKET`
   - `RENDERER_WORKER_URL`
   - `RENDERER_WORKER_TOKEN` (optional)
2. Create the Storage bucket named in `ASSET_STORAGE_BUCKET`.
3. Stand up or point `RENDERER_WORKER_URL` at a worker that implements `GET /health` and `POST /renders` and returns `rendered`, `externalRenderId`, `outputUri`.
4. Google Cloud OAuth client + four consent grants. One consent per channel/account.

After (1)+(2), re-hit `/api/assets/health`. Connected is only true on HTTP 200 with `connected: true`.
After (3), re-hit `/api/renderer/health` the same way.
After (4), store refresh tokens **only** in Vercel env:

| Destination ID | Intended channel | Env prefix |
|---|---|---|
| `youtube-horror` | What’s That in the Corner | `YOUTUBE_HORROR_*` |
| `youtube-variety` | WTF? | `YOUTUBE_VARIETY_*` |
| `youtube-fixit` | Buffalo Bills Wildlife / Fix-It | `YOUTUBE_FIXIT_*` |
| `youtube-primary` | Joshua Comstock personal | `YOUTUBE_PRIMARY_*` |

Each prefix needs `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`.

Handles are **not** verified. Do not map a handle until `/v1/youtube/destinations/{id}/health` returns `connected: true` and a `channelId`.

## What this branch adds (no secrets)

- Destination registry with the four identities above
- `GET /v1/youtube/destinations` list probe
- OAuth start + callback routes that stop at the human consent URL
- Acceptance harness types + fail-closed tests
- Tool-shelf audit against Studio Go `main` `9f8d1a8` (read-only)

## Tool shelf (Studio Go main — classified, not rewritten)

| Control | Class |
|---|---|
| Editor surface / undo / redo / split / trim / fade / delete | WORKING on main per packet (do not redo) |
| Durable project save | WORKING on main per packet |
| Asset provenance contract | WORKING in app code; storage backend BLOCKED EXTERNALLY |
| Media import | PARTIAL until storage 200 |
| Render / export | BLOCKED EXTERNALLY — no worker URL |
| Publish | BLOCKED EXTERNALLY — four destinations `not_configured` |
| Mic / voice capture | PARTIAL — device-side; no live Path proof this run |

Ellie branches remain hers. This packet does not merge them.

## Scenarios A/B/C

Not executable against production until storage + renderer + one OAuth destination are green.
Harness file defines the evidence shape those runs must emit.

## Definition of done (still open)

- [ ] Storage health 200 + one upload/retrieve with provenance
- [ ] Renderer health 200 + one stored render artifact
- [ ] Four destinations individually probed (connected or honest not_configured)
- [ ] One external YouTube video ID + URL after creator approval
- [ ] Failure cases fail closed (tested in harness; live only after env exists)

Do not treat this document as a publish.
