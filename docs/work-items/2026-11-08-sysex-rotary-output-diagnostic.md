# SysEx rotary output report

Status: diagnosed and corrected locally in0.46.0-alpha.19. The initial03:35–03:38 diagnosis below was read-only; implementation and the later explicit value test are recorded separately.

## Evidence

The owner's Firefox session at `http://127.0.0.1:5187/editor/` shows encoder 8, rotation, with the local body `.minmax 0 127`, `.tx $F0 $7D val $F7`, `.showvalue on`, `.mode 1dot`, `.default 96`. The display reports MIDI value87. Assignment scanning is incomplete (27/656). Both send toggles are enabled; the custom editor badge says “Live editing”. These states do not prove that the current local source has been installed or that a value gesture was transmitted.

Read-only inspection of the existing monitor shows incoming `F0 7D 57 F7` and other `F0 7D … F7` frames. This proves physical MIDI input of this shape in the existing session; it does not prove which gesture the owner currently reports, which synth received it, or persistent storage. No fresh physical gesture was requested or correlated during this read.

## Source findings

- `Workbench.tsx`: `setPreviewValue` calls the standard `encoderMessages` path. Selecting/applying a custom program calls `stopValueEmission`; changing source uses a separate checked assignment-write transaction.
- `src/cc-transport.ts`: `encoderMessages` explicitly returns null for any `customAssignment`. `createCcSender` accepts standard voice/CC messages, not arbitrary SysEx.
- `CustomProgramEditor.tsx`: preview slider is explicitly inert; “Live editing” denotes assignment editing, not value transmission. The badge does not indicate independent read-back success or current transport availability.
- `registration.tsx` and `host-policy.ts`: output only permits recognized device queries, prepared BCL jobs and qualified edit operations. Sending an arbitrary external-synth SysEx to the BCR32 is not an implemented generic value setter and must not bypass these boundaries.

Thus mouse-controlled custom value output is absent by design in the present sender. Physical custom emission and programming the hardware assignment are distinct paths. Clarify mouse rotation versus physical rotation or assignment editing before choosing the fix. For mouse output, identify whether the target is BCR32 visual feedback or an external synthesizer; one is not proof of the other.

## Provenance

Repository: BCR32 Studio, branch `work/sysex-bcl-inspector`, commit `e9f7b87e02cf322b0ebeeefccb620208f4bfab53`, initially clean. Paths read are listed above plus `bcl-tx.ts`, `firmware-codec.ts`, and the previous live custom/read-back work item. This report is the only new uncommitted file. Reader: Codex primary; exact model identifier and reasoning effort unavailable, so provenance is incomplete for those fields. Review: 2026-11-08 03:35–03:38 CET. Browser evidence was read through Firefox accessibility; only the Log/Control tabs were changed, no edits, STORE or transfer actions used. No new tests were run because no runtime source changed.

## Implementation after owner clarification

The owner confirmed “souris8” at03:38. [Issue50](https://github.com/TheLazyGeekGuy/bcr32-studio/issues/50), [specification](../../specs/003-custom-value-output/spec.md) and [shared contract](../CUSTOM-VALUE-OUTPUT.md) describe the completed change. Exact custom values now use one-use, byte-scoped broker grants; normal value grants remain voice-only. The bridge reparses/evaluates source and refuses controller/universal system commands. Bounded queues preserve latest rotations and ordered auxiliary edges; source, preset/busy, permission, lock and generation checks prevent replay/cross-instance output. Custom editing cancels old work without disabling the user's value switch. The switch is now MIDI → BCR32. No imported source is changed and no native assignment or persistent save is implied.

Implementation/review03:38–03:52 CET against the same baseline plus the uncommitted paths above and new broker, queue, policy, tests, specs, version/i18n/docs changes. Reader remains Codex primary, exact model/effort unavailable. Root legacy CC transport was not changed; the dedicated BCR32 sender gains pending-queue cancellation only.

## Acceptance evidence

- 61/61 unit/conformance scripts and TypeScript passed; focused queue, bridge and version checks passed after subsequent refinements.
- Three isolated Chromium/fake-MIDI scenarios passed: encoder8 actual mouse drag, BCL local editing/history/reload with zero writes, and backup/OFF/BCL/readback/explicit simulated STORE/restoration. No simulated test touched physical ports.
- Production compilation and distribution verification passed (existing large-chunk warning retained).
- Generic `leak-gate --ci` passed. This is not a claim that the separate full private pre-push scan is clean.
- At03:50–03:51 CET, the actual owner Firefox at `/editor/` showed MIDI → BCR32 enabled and encoder8's existing test source `.tx $F0 $7D val $F7`. One keyboard increment used the same value callback tested by mouse in Chromium:87→88. The editor reported successful output, and the host MIDI monitor recorded **↑ OUT `F0 7D 58 F7`**. A decrement restored the local test value87. MIDI settings showed both selected ports “Behringer BCR-32” and SysEx allowed. Last-known firmware1.0.3 was displayed but live firmware was not detected; this external payload path does not claim a new firmware command.
- No assignment edit, mode change, native preset write, STORE or firmware operation was performed in that real-session test. Two non-commercial value gestures were submitted to the selected output; the monitor is host evidence, not an independent hardware acknowledgement. Native LED/ring reaction, DIN forwarding and receiving-synth acceptance remain unqualified. Firefox was left on encoder8, value87, MIDI settings closed.

Local delivery only; no push or production deployment authorized by this bug report.
