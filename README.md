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

## Moonshadow Content Factory

The new `factory.html` page adds the producer-facing content pipeline: local media intake, versioned editor-adapter actions, approval gates, publish connectors, and export records. It keeps the original Studio Go shell intact and links into the production floor without replacing the existing architecture.

The repository Brain snapshot lives at `brain/current.json`. The Bridge reads and displays that snapshot on load. This proves that the published screen and repository Brain artifact are connected; it does not yet prove realtime write synchronization or autonomous access by separate ChatGPT threads.

## Proof of concept

Bridge V1 is also the first test bed for the Moonshadow 2–7 Agent Workcell: two to seven bounded agents sharing operational memory, assignments, handoffs, live coordination, checkpoints, verification, and human escalation. Testing begins with Amber and Allie, then adds one verified worker at a time until the seven-agent configuration is proven. Test evidence must distinguish demonstrated behavior from planned capability.

## Locked distinction

- **Brain:** persistent operational memory
- **Bridge:** live communication
- **Checkpoint:** proof that a worker is active and synchronized

The Bridge must not impersonate the Brain or report a planned connection as operational.
