# Big City Protocol

Big City is a future coordination layer, not a giant combined repository.

## Operating rules

- Separate repositories do not communicate automatically.
- Deployed applications can communicate through authenticated APIs, webhooks, Firebase queues, or another message bus.
- Every participating system keeps ownership of its own code and data.
- Cross-system messages must use one versioned envelope with:
  - `messageId`
  - `correlationId`
  - `schemaVersion`
  - `sourceSystem`
  - `targetSystem`
  - `messageType`
  - `status`
  - `createdAt`
  - `payload`
- Messages must support retries without duplicate work.
- Every system must return an acknowledgement or failure state.
- Josh remains the final authority for spending, publishing, deletion, access changes, and production deployment.
- Big City remains `PLANNED / NOT OPERATIONAL`.

## Status

Planning only. Do not connect repositories or build Big City until Josh approves the next stage.
