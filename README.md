# Moonshadow Bridge V1

The first deployed coordination surface for Moonshadow Studio. Bridge V1 is separate from Moonshadow Creative OS/editor Version 28.

## Current state

This first checkpoint is a static, local-only prototype suitable for GitHub Pages. It provides:

- a responsive Bridge screen for Chromebook and phone
- an explicitly unverified crew roster
- local message testing
- the mandatory Bridge checkpoint format
- honest backend and Brain connection indicators

Messages are currently stored only in the browser's local storage. They are not shared between devices or workers. A realtime backend and authentication layer are required before the Bridge can be called live.

The repository Brain snapshot lives at `brain/current.json`. The Bridge reads and displays that snapshot on load. This proves that the published screen and repository Brain artifact are connected; it does not yet prove realtime write synchronization or autonomous access by separate ChatGPT threads.

## Proof of concept

Bridge V1 is also the first test bed for the Moonshadow 2–7 Agent Workcell: two to seven bounded agents sharing operational memory, assignments, handoffs, live coordination, checkpoints, verification, and human escalation. Testing begins with Amber and Allie, then adds one verified worker at a time until the seven-agent configuration is proven. Test evidence must distinguish demonstrated behavior from planned capability.

## Locked distinction

- **Brain:** persistent operational memory
- **Bridge:** live communication
- **Checkpoint:** proof that a worker is active and synchronized

The Bridge must not impersonate the Brain or report a planned connection as operational.

## 2026-08-10 correction

- Verified deployment evidence: GitHub Actions workflow run `31341668398` for commit `01961801ce80e4c9e8f7ef387f17eefc5bf04e27` completed successfully.
- Verified repository state: V2 frontend is deployed from the `main` branch and still loads its isolated Firebase configuration from `v2/firebase-config.js`.
- Direct live V2 queue testing was blocked in this session because the browser MCP was unavailable and outbound DNS to the GitHub Pages host was unavailable.
- Queue write/read evidence, second-session live readback, and V1 live-runtime confirmation remain unverified here.
- No automatic API worker was verified in this session.
