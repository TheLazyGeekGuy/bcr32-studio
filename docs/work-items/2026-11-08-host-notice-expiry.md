# Native MIDI recovery notice lifetime

Tracking: [issue 49](https://github.com/TheLazyGeekGuy/bcr32-studio/issues/49).

## Finding and change

The runtime emits a recovery notice after the native port inventory becomes available again. Both `src/editor-host/StandaloneEditorApp.tsx` and `src/editor-host/WorkspaceApp.tsx` previously kept every notice in plain persistent state. Recovery therefore looked like a warning that still required attention.

Both shells now use `useHostNotice`, with a shared `notice-expiry.ts` policy. The known recovery notice expires after 4,000 ms. Warnings/errors keep their existing persistent behavior. Cleanup cancels the timer when the message changes or the shell unmounts; a guarded functional update additionally prevents a stale timer from clearing a newer error.

This is host-owned presentation behavior inherited by all installed modules. The runtime callback remains `(message: string) => void`; no module API, connection state, MIDI traffic or stored data changes. Other host notices remain persistent unless explicitly classified as transient.

## Verification

`node scripts/test-host-notice-expiry.mjs` checks the exact time boundary, a newer error, cancellation and persistent unavailable/lost warnings using an injected clock. It passes, as does `npm run typecheck`. The complete `npm test` run passes all 60 scripts and TypeScript checking (2026-11-08 03:20 CET). No physical disconnect/reconnect was induced and no hardware commands were sent. Live browser expiry has not been induced during this verification.

## Review provenance

Baseline repository: BCR32 Studio, commit `eec3d05bc0c416e303a2d13ea55a836c0c5bdd4d`, branch `work/sysex-bcl-inspector`. Read runtime notice emission and both host shells; worktree was initially clean. Implementation, test and SDD files were uncommitted during verification. Reader: Codex, primary agent. Exact model identifier and reasoning effort are unavailable; provenance is incomplete on those fields. Review: 2026-11-08 03:17–03:20 CET. Governance and skill instructions were read outside this repository. No push or deployment is included.

Specification: `specs/002-host-notice-expiry/`.
