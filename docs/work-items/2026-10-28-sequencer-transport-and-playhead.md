# BCR103-05 — UI transport and synchronized playback position

Status: **partial/open**, not a completed transport implementation.

## Provenance

Reviewed by Codex, primary agent, 2026-10-28 14:19–14:41 CET. Exact model identifier/effort are not exposed; these review fields remain incomplete. Repository `bcr32-studio`, worktree `<workspace>/bcr-studio-firmware-103`, branch `work/firmware-103-sequencer`, full baseline **`806e56d15dccb4e60c4402b5a6e632228b7071b9`**, plus initially uncommitted hook/view/CSS/browser-test/version/documentation changes. Read scope: host codec/hook, Workbench MIDI RX, sequencer view/shared constants, broker validators, existing hardware tools, protocol documentation and ControlTribe 1.12.4 ARM64 state/parser/dispatcher functions.

Outside-Git inputs: same installed binary/digest as the protocol dossier; new capture/test files under `<workspace>/Codex/bcr32-firmware-103-analysis-2026-10-28/`. Manufacturer manual outside Git: `Manual_BE_0715-AAW_BCR32_A4_WW_2026-04-06_Rev1.pdf`, SHA-256 `619f3ecfdf874210bf2c84e28b0d3d20583c83801781e53aee485ca8557fee04`, Clock Out section 27 (PDF spread 11, printed pp.20–21). Text inspection establishes the stated routing options, not a visual rendering review.

## Confirmed acceptance and failure

- User confirms the physical Controller/Sequencer switch works, and physical Start/Stop is reflected in the editor.
- UI Play/Stop and Space are still unavailable; this is an existing missing implementation, not a newly working control being claimed as complete.
- There is no synchronized in-pattern playhead. Do not confuse hardware pattern selection, edit cursor and playback cursor.
- User reports PAT'N CH = Off. Independent read of Clock Out returned `F0 00 20 32 00 64 51 00 F7` (0/Off).
- Eight-second passive capture while running contained eight `48 00` state replies from the browser's polls, no MIDI clock, note output or absolute step position. This bounds what was received; it does not prove the hardware can never provide a position through another configured route.

## Authorized experiment: selector 00 plus value

Native `ZaqHost::stateCommand` at `0x1005e6878` builds either a selector-only request or selector + packed int16; that builder alone does not establish the meaning/acceptance of each selector/value combination.

The user explicitly authorized a single boolean-valued selector-00 test. Initial read was refused with `48 00 02`; after the known Sequencer page command `0B`, the read succeeded with `[0,0,0,0,0]`. One candidate Start was sent:

`F0 00 20 32 7F 64 48 00 00 00 01 F7`

The device answered `F0 00 20 32 00 64 48 00 07 F7`. Independent state read remained `[0,0,0,0,0]`. The candidate was rejected, not added to a validator or UI sender. No second speculative value, STORE, firmware operation or opcode scan was sent. Raw records: `transport-value-00-1428.json` (initial read refusal), `transport-value-00-after-page.json` (actual test); temporary explicitly gated test source `test_transport_value_00.mjs` remains outside Git. Do not rerun the disproved candidate as a transport feature.

## Implemented alpha.15 scope

- A live, armed hardware snapshot automatically follows an actual pattern/context change with an atomic 36-lane read.
- That follow does **not** send a page selector during playback, or a step write. It waits for the existing single-flight poll/edit work to settle.
- Paused local edits are not overwritten by this auto-follow. Context changes cancel stale queued edits; cancellation is not reported as an acknowledged write.
- Pitch bars visibly show note names; Chord bars show separate chord codes, not misleading note labels.

## Remaining acceptance gates

- [x] User-visible physical page switch and physical-running feedback.
- [x] Browser simulation: pattern change triggers a fresh read, no mode selector or note write, and paused local draft preserved.
- [ ] Physical pattern-chain follow validated by the user.
- [ ] Working UI Play/Stop and Space through an independently confirmed command/route, with lock/disconnect/error guards.
- [ ] Exact in-pattern cursor from a qualified device position or clock/track timing source. No timer-only simulated cursor.
- [ ] Pending physical routing test: the user was asked to temporarily set PAT'N CH = CH16 and Clock Out = USB, leave settings and press PLAY. Both original values were Off; restore after the test, no STORE. No CC is sent until readiness is confirmed. No settings were automatically rewritten by this patch.

Transport remains gated. These unresolved criteria keep this ticket open. There is no push/merge/deployment, firmware flash or sequencer STORE in this lot.

## Executed software checks

2026-10-28 14:38–14:41 CET: 47/47 offline scripts and TypeScript pass; production build/distribution passes with the existing large-chunk warning. Normal and synchronous-reply production browser runs pass, including auto-follow without page/step writes, paused-draft preservation and visible Pitch/Chord distinctions. Production subpath/offline regression passes; smoke serves `0.45.0-alpha.15`. One development-browser run was interrupted by navigation during concurrent regeneration/build; the stable production runs passed afterward. These are software checks, not physical transport/playhead proof.
