# Moonshadow Brain Job Event Contract

## Purpose

Brain is the single source of truth for what happened to a studio request. Brain remembers; it does not route, execute, edit, publish, or make creative decisions.

The canonical history is an append-only event log. Current status, checkpoints, dashboards, and handoff views are projections that can be rebuilt from that history.

## Boundary ownership

- **Path** owns routing, limits, correlation, idempotency, and workflow enforcement.
- **Workers** perform bounded work and return results.
- **Editor** modifies or produces artifacts and records the touch.
- **Review** records approval, rejection, or requested changes.
- **Brain** persists the canonical event history.
- **Bridge / Studio Go** display and control the system through narrow contracts; they do not own competing job state.

## Event envelope

Every meaningful state-changing action uses the same envelope:

```ts
{
  schema: "moonshadow.brain.event.v1",
  eventId: string,
  requestId: string,
  correlationId: string,
  causationId: string | null,
  actor: "josh" | "path" | "amber" | "allie" | "editor" | "review",
  type: string,
  stateVersion: number,
  createdAt: string,
  payload: object
}
```

## Initial event types

- `request.created`
- `route.assigned`
- `worker.result`
- `handoff.recorded`
- `editor.touched`
- `review.completed`
- `request.finalized`
- `request.failed`

Corrections are new events. Existing events are never silently rewritten.

## Minimum end-to-end proof

One request must prove this exact loop before expansion:

1. Josh creates request.
2. Amber routing logic assigns one worker.
3. One worker executes once and returns a bounded result.
4. Editor touches the artifact once.
5. Review records the decision.
6. Final result returns to Josh.
7. Brain recalls the complete request history afterward.
8. A current-state view rebuilt from the event history matches the final state.

## Legacy boundary

Bridge V1 and V2 remain legacy/isolated paths. New Studio Go / Path integration must not depend on `bridge/v1` or `bridge/wake-poc/v1` unless an explicit migration is approved and tested.

## Go-live rule

Do not add more workers, editor features, publishing paths, or automation until the minimum proof above passes with evidence.