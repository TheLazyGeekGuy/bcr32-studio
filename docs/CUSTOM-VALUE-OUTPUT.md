# Custom SysEx value output

## Current status — alpha.20

**Physical ring/current-value feedback is not qualified for native BCR32 custom assignments.** It remains open in [issue53](https://github.com/TheLazyGeekGuy/bcr32-studio/issues/53).

Mouse, keyboard, screen and auxiliary custom-value gestures now update only the local preview, with an explicit limitation message. Native `.tx` assignment programming, preset storage and passive matching SysEx reception retain their existing paths. Standard CC/NRPN output is unchanged. No assignment is replaced with CC, no `.default` rewrite is used as a surrogate value setter, and no preset/routing/STORE operation is added.

Alpha.19 submitted an external-instrument payload to the BCR32 output. Its OUT monitor row proved host submission, not physical ring synchronization. That path and the broker grant/queue added solely for it have been removed. The SDK and saved-state schema are unchanged. The sections below are historical implementation evidence, not current APIs or capabilities.

The manufacturer's [manual](https://cdn-media.empowertribe.com/611d8696b95f80f8c46dbecd816d0b65/Manual_BE_0715-AAW_BCR32_A4_WW_2026-04-06_Rev1.pdf), printed22–23 (PDF12), documents assignments and preset transfer, not a custom-value feedback API. The B-Control implementation author's [historical explanation](https://mountainutilities.eu/forums/can-bcr2000-respond-nrpn-or-sysex) distinguishes standard receive matching from custom-only output on BCR2000/BCF2000; it is not proof of BCR32 firmware behavior. Bounded ControlTribe and existing1.0.2 inventory checks did not identify a qualified setter; this does not establish that firmware1.0.3 lacks all undocumented mechanisms. See the [research report](work-items/2026-11-08-custom-hardware-feedback.md).

A possible alternative is an explicitly chosen CC/NRPN hardware assignment plus software SysEx translation and standard feedback. It changes the native assignment and requires Studio running; it is not applied automatically. Native feedback acceptance still requires a model/firmware-specific setter or demonstrated receive mechanism and independent physical ring/value confirmation without assignment rewrites.

## Historical alpha.19 implementation — withdrawn

Available locally in0.46.0-alpha.19. This is a host software output path, separate from installing a native BCL assignment, reading device state or storing a preset.

## User behavior

Enable **MIDI → BCR32** and manipulate an assigned rotary control, its screen value, or an auxiliary value. A supported custom `.tx` program renders the chosen value and sends it to the editor's bound output. The MIDI monitor records the outgoing frame. For `.tx $F0 $7D val $F7`, value87 is `F0 7D 57 F7`.

Selecting/editing a custom type preserves the value switch, while cancelling old pending values. Source edits may separately install an assignment when **Assignments → BCR32** is enabled. Neither assignment installation nor preview is a value gesture. The Preview slider never sends MIDI. Opening, imports, RX, reconnect and enabling the switch do not replay values. STORE remains explicit.

Advanced/unknown BCL tokens are retained but not evaluated. The value path supports the existing exact literal and value-slice parser, up to four SysEx frames of256bytes. BCR32's own manufacturer commands and universal system commands are refused here. These restrictions do not change existing qualified device operations.

**Destination limitation:** a synthesizer parameter payload sent to the BCR32 USB output is not a proven BCR32 ring setter. USB-to-DIN forwarding, synthesizer receipt, and native LED feedback depend on separately qualified device behavior/routing. An outgoing monitor row proves software submission only.

## Shared host contract

`MidiBroker.authorizeSysexValue(owner, messages)` is additive. It returns the existing opaque `MidiAuthorization` with operation `value`, scoped internally to an immutable copy of the exact batch, one owner, one lease generation and one send. Ordinary `authorize(owner, 'value')` grants remain voice-only. Modules without this new service retain their existing behavior; an older host is detected before custom output rather than bypassed.

The entire batch must match before any output occurs. Framing, the4-frame/256-byte budget and current SysEx permission are checked; replay, changed bytes, stale generations and foreign leases fail. A consumed grant cannot be reused. This method is a host service for explicit module gestures, not a generic raw Web MIDI endpoint and not a hardware capability declaration. It does not itself classify a structurally valid manufacturer command as safe: device adapters retain that responsibility.

BCR32's bridge reparses the source, applies `bcr32CustomValueMessages`, obtains an exact grant, sends through the existing lease, records monitor output and revokes the grant in `finally`. Raw custom messages remain refused by its normal Web-MIDI-shaped output wrapper. The workbench captures the generation before queueing so an old gesture cannot be rebound to a new device before React cleanup runs.

`createCustomValueQueue` is a pure reusable transport scheduler. Rotations retain the latest value per control; auxiliary gestures retain order. Each tick processes at most four rotation jobs and four ordered jobs, with128-control/128-ordered-job bounds. Queue construction never sends. Disable, lock, source changes, busy/preset transitions, connection changes and disposal cancel pending work. The adapter checks the latest source before sending; received values never enter this queue.

No editor manifest, serialized state, SDK version or persistent-data schema changes. Optional workbench callbacks allow an older embedding to remain usable for local editing; unavailable output reports a status message.

## Verification and provenance

See [issue50](https://github.com/TheLazyGeekGuy/bcr32-studio/issues/50), [SDD plan](../specs/003-custom-value-output/plan.md), and [diagnostic evidence](work-items/2026-11-08-sysex-rotary-output-diagnostic.md). Focused tests cover7/14-bit templates, exact one-use grants, batch preflight, permission/generation/ownership refusal, ordered/coalesced values and cancellation. The isolated-browser scenario exercises an actual encoder8 mouse drag, simulation, toggle off/on and passive RX using fake MIDI only.

Reviewed by Codex primary, 2026-11-08 03:35–03:50 CET, baseline `e9f7b87e02cf322b0ebeeefccb620208f4bfab53` plus uncommitted implementation/test/docs listed by the work item. Exact model identifier and reasoning effort are unavailable; provenance is incomplete for those fields. No firmware, physical STORE or synthesizer acceptance is established by these software tests.
