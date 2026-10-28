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

## Physical routing test — 2026-10-28 16:41–16:51 CET

Codex primary agent, exact model/effort unavailable, reviewed full commit `b18dbfb1221602bd0842e900112862fb3455c2da` with a clean worktree before these documentation-only additions. The new explicitly gated test script and captures are outside Git in the existing analysis dossier. ControlTribe was not running when checked; this does not exclude every other possible MIDI client.

The owner confirmed readiness after setting PAT'N CH = CH16 and Clock Out = USB and starting playback. Input-only recording received **112 F8 messages in 8 seconds**, then **2,520 in a separate 180-second window**, 14 per second throughout. The long window also contains the 28 explicitly requested read-only timing replies below, and no captured FA/FC event. The additional physical STOP → PLAY → STOP action was requested but is not yet confirmed performed; absence of FA/FC here must not be presented as proof that the device never emits them.

Independent settings reads: operating mode `1F=0` (USB), clock source `50=0` (Internal), clock output `51=4` (USB), clock rate `18=3` (24 PPQ option). `47 01 00` read the native Tempo field as raw int16 350. The observed 14 F8/second corresponds to 35 BPM under standard 24-PPQ MIDI clock; retain raw 350 rather than silently promoting a new tempo-write unit contract.

The only performance write was **`BF 04 00`**, CC4=0 on channel16. Independent host reads before and after both returned `[1,0,0,0,0]`: **Stop was not confirmed**. No second CC, speculative selector, globals write, mode change, STORE or firmware command followed. The test did not qualify UI transport and does not establish whether another routing mode/DIN path could work. Do not enable the writer from a documented sibling model alone.

Timing read requests were `F0 00 20 32 7F 64 46 01 track field F7`, four tracks × seven fields. All 28 returned status0, 15-byte frames; every track reported start1, length32, offset0, divider code4, shuffle even/odd0, direction0. These selectors are independently mapped by native `buildTrack` at `0x1005bb750`: 0 start, 1 length, 2 offset, 3 divider, 4/5 shuffle, 6 direction. The native divider table maps code4 to six MIDI ticks/step. These **reads are research evidence, not newly enabled UI writes or a completed playhead**.

Evidence:

- `cc4-ch16-1642.json`, SHA-256 `6d27a93a1f71370b291fc3afe785afba63916186ca95544f06f594e43476c8be`.
- `track-timing-1646.json`, SHA-256 `10ea4f2d8105d5e503ab7ca167032e6bb91717fe7c18ff842cbb8b568c81f39e`.
- Local ignored passive logs: `output/hw/2026-10-28T15-41-14-635Z-all.log` and `output/hw/2026-10-28T15-44-49-482Z-all.log` (F8 counted in the recorder's terminal summary, not individually written to those log files).

Next physical gate: capture the owner's STOP → PLAY → STOP with Clock Out still USB, to establish a phase/reset anchor. PAT'N CH16 and Clock Out USB are temporary owner changes and are **not yet restored** while that test remains pending. Ask the owner to return both to Off after the test; no automatic undocumented setting writer is introduced. UI transport and exact playhead remain open.

At 16:53 the owner reported the physical cycle completed, but the 180-second recorder had already ended at approximately 16:47:49. That action was **missed**, not a negative MIDI result. Do not infer missing FA/FC support from it. At 16:54:39 a new input-only persistent recorder was armed, writing an interim capture every second and retaining the result after an observed Start → clocks → Stop. It has a 30-minute safety cap rather than a short three-minute interaction window. The owner was asked to repeat PLAY → wait two seconds → STOP once. Outside-Git source/capture: `listen_until_transport.cjs`, `transport-persistent-1655.json`. No hardware output is possible from this recorder.

## Alpha.16 follow-up — 2026-10-28 17:00–17:27 CET

Reader/implementer: Codex primary agent, exact model/effort unavailable. Baseline full commit `afaf47e8dd770537e60bbd8793043817571b17cf`, plus initially uncommitted `sequencer-follow.ts`, host timing reads, hook/view/CSS, fixtures/tests, translations/version/docs. Native binary digest/source dossier unchanged. This is not an independent review.

The persistent recorder successfully ended on the owner's cycle at 16:59:57 CET: FA at 16:59:52.649, 71 F8, FC at 16:59:57.668. No output port was opened. Sanitized source-hashed fixtures now cover this physical stream and the 28 timing replies; they are replayed into pure code, not onto hardware.

Implemented: passive per-track heads in all four views, separate edit selection; hardware timing reads; observed clock BPM; no guessed midstream phase; Stop/stale/rebind/new snapshot clearing; unsupported direction/shuffle/skip states left unavailable. Step editing does not depend on optional timing success. The state-02 refusal observed while hardware settings were being used now settles as an explicit refusal, not a timeout. No new global/PAT'N CH/clock-output writer is added.

The owner explicitly requires a read-before-test snapshot and verified restoration of any temporary modification. They also reported PAT'N CH reverting from16 to Off. **No captured test frame directly writes PAT'N CH, but the observed reversion is not explained or dismissed.** Possible indirect effects of page selection/volatile setting reload remain a hypothesis, not an established cause. Do not invent a PAT'N CH read/write opcode to restore it. Existing historical tests must not be retroactively described as having read every setting beforehand.

New read-only baseline captured at 17:14:54 CET, outside Git `settings-before-1714.json`: firmware1.0.3/device0, Clock Rate3, operating mode0/USB, clock source0/Internal, Clock Out4/USB. Host-state query returned status02; no page command was sent to force it out of that state. PAT'N CH cannot yet be independently read/restored through a qualified API; the owner's latest Off report is distinct from a read-back. Current Clock Out is already the USB value needed for the follower, so no routing change is necessary. Future experiments must snapshot every affected readable setting and restore only through a qualified writer, then independently verify it. If a required read/restore route is unknown, report that limitation before changing the setting. No automatic clock-routing mutation is claimed.

Remaining: visual physical cursor alignment after loading alpha.16; outgoing UI/Space transport; additional directions/shuffle/skip qualification; explanation/controlled restoration of the reported PAT'N CH reversion. This ticket remains partial/open.

### Final alpha.16 checks, 17:20–17:25 CET

Production build/distribution and TypeScript pass; all 48 offline scripts pass. Real physical FA/71-F8/FC replay and timing fixtures pass. Browser simulations pass for grid/lanes/piano roll/table heads, edit-selection preservation, no MIDI writes from the follower, Stop/stale clearing, missing optional timing without loss of live step editing, and existing mode/import/undo workflows. Immediate-reply and normal paths are exercised separately. Production offline/subpath and alpha.16 smoke checks pass. There is no claimed physical visual alignment or outgoing transport success from those software results.

Functional render budget: 2,400 synthetic 120-Hz clocks produce at most425 step/tempo notifications (not 2,400 full-view updates); the 71-clock physical replay produces fewer than30 notifications. This bounds store notifications only, not measured end-to-end physical latency or universal browser frame rate. A watchdog expires phase but never advances it. Physical timing changes require a fresh read and hardware Start; arbitrary live physical timing edits and continuous pattern-chain phase are not yet qualified.

Read-only post-check `settings-after-1723.json` at17:24 CET matches all readable pre-test settings in `settings-before-1714.json`: firmware identity, Clock Rate3, mode0/USB, clock source0/Internal and Clock Out4/USB. No setting write was required to preserve them. This comparison **does not include PAT'N CH** and must not be presented as a full-device restoration proof. No more physical write/mode command was sent during this alpha.16 implementation/QA interval. All browser QA uses fake MIDI endpoints, not the owner's hardware.
