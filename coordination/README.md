# Moonshadow Coordination Contract

This directory defines the shared work-packet format used by Allie, Amber,
Cassandra, and Josh. It is deliberately separate from Bridge V1 and runtime
Path code.

## Rules

- Josh supplies one outcome and remains final decision-maker.
- Allie creates the packet, acceptance tests, and final PASS/FAIL card.
- Amber owns inventory, preservation, and operational evidence.
- Cassandra owns integration, blocker diagnosis, and rollback evidence.
- No packet may enter `passed` without evidence.
- Manual work enters `awaiting_josh` with one objective, one expected signal,
  and one screenshot clue.
- A tool name is not proof of connection; evidence must identify the verified
  action or result.
- Separate ChatGPT threads are not treated as automatic communication.

## State flow

`queued -> active -> verifying -> passed`

Any state may enter `blocked`, `failed`, or `awaiting_josh`. A blocked action is
retried no more than twice before escalation. Release still requires Josh's
explicit approval.

## Validation

Run:

```sh
node --test coordination/tests/schema-contract.test.mjs
```

