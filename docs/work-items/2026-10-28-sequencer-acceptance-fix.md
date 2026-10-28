# BCR103-03 — Real-session sequencer acceptance corrections

Reader: Codex primary agent, exact model ID/effort unavailable. Read 2026-10-28 13:41–13:51 CET. Baseline full commit `75d091084073d73a0fc3ddef8e83037e151e97f9`, branch `work/firmware-103-sequencer`; current implementation initially uncommitted. No independent review claimed.

Read scope: BCR32 sequencer codec/hook/view, Workbench RX and controller-reader effects, broker adapter/policy, existing hardware/browser tests; installed ControlTribe 1.12.4 binary outside Git (digest in the protocol document). New focused native extraction and raw captures are local, outside Git, in `<workspace>/Codex/bcr32-firmware-103-analysis-2026-10-28/`.

## Reported

- Firefox, local preview port 5187: sequencer response timeout; Read current pattern does not complete.
- UI mode selection did not select the hardware page.
- Reading and live editing should be automatic, not a separate enabling procedure.

## Corrected

- [x] Narrow `0B`/`0C` native page selectors, firmware/lease/lock guards; preserve old 1.0.2 behavior.
- [x] Install sequencer RX relay before any read effect, including immediate replies.
- [x] Stop Controller assignment scans in Sequencer instead of concurrently transferring both models of state.
- [x] Read current pattern automatically and arm live editing only after a complete successful read.
- [x] Keep failed reads, lock, stale data and explicit pause fail-closed; no STORE.
- [x] Timeout message contains command/device/RX evidence rather than only a generic error.

## Proof and remaining gate

- Native read: 36 lanes still respond on the actual 1.0.3 hardware after the reported timeout.
- Real Chromium Web MIDI cold-entry test: commands `0C`, `0B` sent; 38 host requests and 38 replies (36 lanes plus two state reads); pattern displayed, live editing on, no step write or STORE during this test.
- Simulated browser regression: automatic live editing, edit/undo, explicit pause, no STORE; also exercised with immediate replies to detect listener-installation races.
- Existing offline suite: 47 scripts plus TypeScript and production build pass.
- [ ] User-session Firefox retest. Chromium success is **not** evidence that the Firefox timeout is fixed. Native/Chromium observations do not establish its exact cause.
- [ ] User-visible physical page change confirmation; the page command has no acknowledgement, and the state reply is not a documented page indicator.

Version: `0.45.0-alpha.13`, same local `/editor/` route. No push/merge/deployment; main unchanged.
