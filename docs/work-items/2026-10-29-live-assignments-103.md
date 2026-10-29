# Restore live standard assignments after the firmware 1.0.3 sequencer integration

Status: development implementation; production remains alpha.17.

Owner reports CC/GS/type OFF edits do not reach the BCR32 even with assignment sending enabled; selecting SysEx should apply the selected program in live edit mode without a separate Apply/Send journey. Later clarification separates encoder25's missing current value from its correctly read assignment.

## Review and physical read-only evidence

Codex primary, exact model/effort unavailable, 2026-10-29 18:27–18:35 CET. Repository bcr-studio-firmware-103, full clean baseline b2720127a902d18371105d71a1acc35acfd211fc, followed by identified uncommitted ControllerPresets/Workbench/custom-program-transfer/standard-program/live-control-queue edits. Read those sources, registration.tsx, controller-write.ts, controller-write-plan.ts and host-policy.ts.

The accessible Firefox window was **localhost:5187/editor/**, not the private production window. UI selection and independent **read-only** current-control BCL GETs confirmed encoder9: `.easypar CC 1 71 0 127 absolute`, mode1dot/default0; encoder25: `.easypar CC 1 7 0 127 absolute`, mode1dot/off/default63. Indexed replies matched those channel/parameter/range values. No STORE or hardware setter was sent in these UI reads. Returning from an unapplied BCL view to CC unexpectedly disabled the assignment toggle; its original on state was explicitly restored. This is another confirmed UI bug.

Confirmed code causes: the indexed standard writer is restricted to live firmware1.0.2; firmware1.0.3 custom transfers are a different qualified path. The alpha.8 live custom edit flow schedules text changes but deliberately excludes Type selection. Native push `.mode down` can also prevent restoration preflight.

## Scope and acceptance

- Reuse the checked selected-control BCL transaction for standard edits on1.0.3, with fresh native backup, no STORE, single-flight/latest pending edits, ACKs and independent current-preset read-back. Do not remove the host's indexed-write firmware guard or introduce a blanket sender.
- Explicit Type SysEx/BCL selection activates a valid program in live mode. Mount, read, import, reconnect and simulation remain inert. View switches preserve the assignment toggle.
- OFF for a standard assignment changes only its Type; OFF for native custom output also removes .tx, with verification.
- Share known standard BCL encoding; preserve independent button values and explicitly refuse unqualified PC bank serialization. Unsupported source stays visible, never coerced to OFF.
- Simulated UI tests cover encoder8 OFF, CC/channel edits, GS, SysEx selection and push/button equivalents; transaction tests cover backup/preparation changes/NAK/readback/disconnection.
- Encoder25's .default63 is not automatically presented as an observed instantaneous value. Live values still require events or a separately proven value query.
- Publish this correction to develop only; staging and production source branches stay unchanged.

## Authorized physical test — 2026-10-29 18:46–18:51 CET

Codex primary; exact model identifier and reasoning effort unavailable. Same baseline commit and uncommitted implementation listed above. Tested the local Firefox editor at http://127.0.0.1:5187/editor/, real BCR32 firmware 1.0.3, CTRL, T2. No STORE, preset change or global setting change.

- Changed encoder 9 rotation from CC71/channel1 to CC23/channel1 using the UI parameter picker. The checked transaction independently read back the assignment from hardware successfully.
- Entered value42 through the OLED inline value editor. MIDI Monitor recorded at 18:46:17.558: `To Behringer BCR-32 / Control / channel1 / Controller23 / 42`. This proves the UI output route and expected CC/value; it does not prove physical encoder emission or destination LED behavior.
- Restored CC71/channel1 through the UI picker; independent assignment read-back succeeded. Returned the displayed test value to0. MIDI Monitor recorded at 18:51:18.011: `To Behringer BCR-32 / Control / channel1 / Timbre/Harmonic Intensity / 0` (CC71).
- Read the working preset without writing. The native accessibility view truncates the displayed BCL before encoder9, so this observation does not qualify a live-value query based on `.default`.
- MIDI Monitor's Control filter and output spying for BCR32 were enabled for this test and left enabled for inspection. System Exclusive display was temporarily disabled to keep the CC trace readable, then restored. Existing logs were preserved.

Result: real CC assignment change, independent assignment verification, expected outgoing CC/value and assignment restoration confirmed locally. Full patch regression checks and develop publication remain separate gates.

## Custom receive correction and persistence investigation — 18:56 CET onward

Same baseline, Codex primary, exact model/effort unavailable. Additional uncommitted reads/changes: `src/bcl-tx.ts`, `controller-midi.ts`, the BCL/SysEx unit suite and simulated browser suite. User-authorized physical gestures on encoder8 produced actual input `F0 7D 32 F7` and subsequent changing values in the passive input-only recorder. The native program was independently read as `.tx $F0 $7D val $F7`. The old decoder excluded every custom assignment. The correction matches only exact templates with complete supported value slices, updates the existing encoder/push/button value pipeline, and never sends a reply. Missing bits, inconsistent repeated slices, fixed messages and unknown/advanced syntax do not fabricate values. Matching keys now include the actual source, not merely a custom/noncustom flag. Local Firefox subsequently displayed ENC8 value84 with source MIDI. Unit, TypeScript and all56 test scripts pass; hardware emission and GUI receipt are separate evidence from persistence.

The owner then reported loss after STORE and a physical power cycle, including a UI STORE into slot13. Read-only stable double reads at19:01 CET confirmed both slot13 and working encoder8 contain `.easypar CC 1 8 0 127 absolute`, no `.tx`. Local full exports are retained under ignored `output/hw/`; user names and unrelated preset contents are not published. Prior BCL-10 tested warm recall, explicitly not power-cycle persistence. Root cause is not established by the post-restart read. A controlled UI reinstall/read-back/STORE13/read-back is in progress; no guessed global command72 or firmware command is authorized by extrapolation.

At19:04–19:05 CET, the owner-authorized controlled repeat used the real Firefox UI: Type SysEx on encoder8 (independent custom read-back confirmed), Presets → Save to… → source working → destination13 with its existing name. UI reported stored/read-back/restoration success. A separate native reader then obtained two identical well-formed reads of slot13 and working: both258 lines, byte-identical to each other, encoder8 `.minmax 0 127 / .tx $F0 $7D val $F7 / .showvalue on / .mode 1dot / .default 0`. Before-repeat exports are retained separately. The owner was asked to power-cycle only after this proof; post-power reading is pending. This repeat proves the UI STORE includes custom output in the slot read-back before power removal; it does not yet establish flash persistence.

At19:06 CET, after the owner confirmed a physical power cycle, a fresh native input/output pair sent only identity/current-controller/preset-read requests. Two identical well-formed reads of slot13 and working were obtained. Both complete258-line exports were **byte-identical before and after power removal**, SHA256 `180fba648d31e0fbcbf32931f7d61e7855e906a16f56e3f9936de9510100a884`. Encoder8 still contains `.tx $F0 $7D val $F7`. No program was reapplied by the diagnostic reader. The controlled UI STORE therefore persists across this power cycle on firmware1.0.3. The first owner-reported failure remains unexplained; it is not justified to blame the owner, claim a missing flash opcode, or generalize this bounded success to all firmware/templates.

Added a pre-STORE source-consistency gate: when storing the working preset, every applied custom program shown in the UI must match the independently read native message tokens/range. A missing/different program refuses STORE before any write. Native runtime/default/ring presentation differences do not fabricate a mismatch. This avoids silently storing an older standard assignment while displaying an unsent custom draft. Tests cover rejection before any backup/write and canonical equivalent programs.
