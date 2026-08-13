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

## Boundary ownership

- Path routes, correlates, enforces limits, and prevents duplicate delivery.
- Workers execute bounded work and return results.
- Brain is the canonical persistent history; see `../brain/JOB_EVENT_CONTRACT.md`.
- Bridge and Studio Go are control surfaces. They do not own competing job state.
- Editor is a tool surface and records its artifact touch; it does not own routing.

## Components

- `src/core.ts`: public seed/status API, queue consumer, fixed routing, and three-call limit.
- `src/state.ts`: serialized session transcript and idempotency ledger.
- `src/allie.ts`, `src/amber.ts`: separate worker entrypoints and identity profiles.
- `src/workers-ai.ts`: replaceable Workers AI model adapter.
- `src/plugins.ts`: minimal typed plugin registry; plugins cannot own routing.
- `src/contracts.ts`: Path message contract plus the versioned Brain event envelope.

## Go-live proof

Do not expand the studio until one bounded request proves:

1. Josh creates one request.
2. Path preserves one request/correlation identity throughout the run.
3. Amber routing logic assigns one worker.
4. One worker executes and returns a bounded result.
5. Editor touches the artifact once and records that touch.
6. Review records the decision.
7. The final result returns to Josh.
8. Brain recalls the complete history afterward.
9. No new route depends on `bridge/v1` or `bridge/wake-poc/v1`.

## Review and proof order

1. Run `npm install`, `npm run check`, and `npm test`.
2. Verify the model/provider available to the Cloudflare account.
3. Create only the resources named in the chosen Wrangler configuration.
4. Test Allie and Amber private identities independently.
5. Run the automatic Path proof.
6. Connect one control surface to the proven Path contract.
7. Add the single Editor touch and Brain recall proof.
8. Only then add more workers/plugins.

This directory is not yet declared live and contains no credentials.
