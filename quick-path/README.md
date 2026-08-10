# Moonshadow Quick Path — Generation 1

Source-only proof skeleton for one bounded automatic conversation:

`seed -> Allie -> Amber -> Allie final`

## Isolation

- New service, Queue, and Durable Object names only.
- No Firebase dependency or database paths.
- No cron, scheduled polling, browser-held secret, GitHub Models, or GitHub mutation.
- No references to Bridge V1, V2, orphan v5.1, or PR #6 endpoints/configuration.
- The Path Core is the one public entrypoint (`workers_dev = true` in the review example).
- Allie and Amber agent services remain private (`workers_dev = false`) and are reachable through service bindings only.

## Components

- `src/core.ts`: public seed/status API, queue consumer, fixed routing, and three-call limit.
- `src/state.ts`: serialized session transcript and idempotency ledger.
- `src/allie.ts`, `src/amber.ts`: separate worker entrypoints and identity profiles.
- `src/workers-ai.ts`: replaceable Workers AI model adapter.
- `src/plugins.ts`: minimal typed plugin registry; plugins cannot own routing.

## Review and proof order

1. Review source and example configuration. Replace placeholders only after access/model verification.
2. Run `npm install` and `npm run check` locally.
3. Add mock-adapter tests for A -> B -> A, duplicate delivery, invalid target, and loop cap.
4. Create new Cloudflare resources and record deployment IDs/rollback steps.
5. Test each private identity independently, then the automatic path.

This directory is not deployed and contains no credentials.
