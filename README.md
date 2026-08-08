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

## Locked distinction

- **Brain:** persistent operational memory
- **Bridge:** live communication
- **Checkpoint:** proof that a worker is active and synchronized

The Bridge must not impersonate the Brain or report a planned connection as operational.
