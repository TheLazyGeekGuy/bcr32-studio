# BCL/SysEx control programming — local-first implementation

## Scope and evidence

Version **0.46.0-alpha.1**, initial implementation, not a claim of complete native custom-output support. Review/implementation: Codex primary agent, 2026-10-29 02:34 onward, checkout `<workspace>/bcr-studio-firmware-103`, branch `work/bcr32-bcl-sysex`, initially clean full baseline **`78ab3a227d50ef13716e6aa45a19a58e92bd5e32`** plus the subsequently uncommitted parser/model/UI/test/documentation changes. Exact model identifier and reasoning effort are unavailable.

Read scope: existing root BCL/profile/forms/text components, BCR32 profile/read/write/CC transport/preset/store/Workbench, generic parameter state/history and actual host interfaces, build and browser fixtures. This standalone checkout lacks the upstream core-contract/onboarding documents listed by the integration skill; the checked source interfaces are authoritative, not historical SDK sketches. No host SDK, grant, firmware whitelist or transport permission is changed.

Outside-Git source: installed ControlTribe **1.12.4**, executable SHA-256 **`8715b0703ad62a923822deb8b4f3c8eb5943d865f30f70b71940b3c3a44e5d6e`**, inspected read-only with `nm`, `strings` and bounded ARM64 `otool` disassembly. No vendor execution, firmware modification, screenshot or physical MIDI operation was used. Existing static firmware token catalog is supplementary historical evidence, not a new firmware execution test.

## Confirmed in the vendor application

| ARM64 function / address | Observed application-side behavior | Not established |
| --- | --- | --- |
| `BCR32::BclLine`, `0x1005b93f8` | Command20 envelope, model64, two 7-bit line-index bytes; maximum 600 ASCII characters | Acceptance/execution of each custom program on firmware1.0.3 |
| `BCR32::Bcl::check`, `0x1005cc230` | BCR32 revision marker, one targeted control, ASCII/line checks; rejects simultaneous easypar/tx; requires native Type OFF before adding tx | Permission to silently send OFF from a local editor |
| `BCR32::Bcl::detail::checkTx`, `0x1005e3cb8` | Hex bytes with one/two digits after `$`, decimal bytes0..255; plain placeholder list; relative-offset/sign argument0..16383; checksum1/2/3 start-byte argument0..127 | The numerical checksum/relative algorithms or real device feedback |
| `BCR32::Bcl::targetOfElementLine`, `0x1005e0cb4` | Encoder1..32 maps to native index selector+49; button1..50 maps to selector−1 | BCF faders or reserved/system keys being programmable |
| `BCR32Controller::writesWithBcl`, `0x1005c5eb4` | A firmware/availability-dependent BCL path; source also contains generation, send, ACK/import/export and reload functions | Extending Studio's existing firmware gates without physical proof |

The app's 13-token plain table and additional validator branches match the already recorded value/relative/checksum/condition/repeat families. Presence in this validator is **application-side confirmation**, not hardware validation. The native Type OFF prerequisite is distinct from Studio's active custom assignment: Studio retains a `sysex`/`bcl` kind and does not emit an OFF setter while editing.

An indexed native Type OFF reading alone cannot prove that custom BCL output is absent. This lot protects known local custom drafts; discovering/reconciling native custom programs still needs the separate BCL-read qualification. A local structured program is not advertised as a freshly retrieved hardware assignment.

Historical [B-Control implementation material](https://mountainutilities.eu/bc2000) is BCR2000/BCF2000 research context, not authority for BCR32 firmware behavior. The [manufacturer's BCR32 page](https://behringer.com/en/products/0715-AAW) establishes product context only; it is not a specification of custom SysEx/LED/OLED commands. No CV/Gate API is inferred. The byte example supplied by the owner is a synthetic conversion fixture, not a qualified command for an external instrument.

## Use

1. Select one programmable control in **Control**, then open **Custom SysEx / BCL**. Known local selectors cover rotations, pushes, the 16 main buttons and both footswitches; system controls without a qualified selector show an unavailable explanation.
2. Enter a framed 7-bit SysEx template, for example `F0 42 31 03 41 0F {val} F7`, or edit the selected control's BCL **body**. The selector is shown separately: body editing cannot inject a second control, STORE, recall or a global section.
3. Adjust BCL min/max/default and use the independent **Simulation value** slider. Preview is calculated locally, not captured hardware output or a query of an instantaneous value. Generic front-panel custom feedback is not provided by this lot.
4. **Apply custom program locally** updates only that control and stops existing value/assignment senders. It does not upload BCL. The standard fields become inactive; **Restore standard assignment** explicitly restores the retained standard fields/type, also locally. Existing global history covers applied changes; per-editor text history covers unapplied text.
5. Save/export the existing JSON draft/preset/library to retain the structured program. BCL/SYX export produces a **selected-control fragment**, without preset initialization or STORE. These files are not a complete preset backup or a validated upload job. Hardware STORE of an existing hardware preset does **not** include these local custom drafts.
6. Import a BCR32 text or model64 command20 file. Only the selected control is extracted from a single preset/fragment; other controls are not changed. Historical model20/21 files remain parsable by the shared parser but are not silently remapped onto BCR32. The Raw tab retains imported file bytes read-only and can save the original; unsupported/malformed imports never replace the program. Full imported file bytes are retained in the open tool, not embedded into every control's JSON state.

## Representation and compatibility

- `src/bcl-document.ts` is the existing parser relocated into one neutral module. `src/bcl.ts` re-exports its old API and retains legacy profile projection. Model64/BCR32 revision/ranges are explicit; historical model20/21 behavior remains covered. No second parser or MIDI transport is introduced.
- `src/bcl-tx.ts` owns bounded structured byte/value/unsupported tokens, source preservation and pure simulation. Exact simple SysEx supports `val` and the known explicit seven-bit-or-narrower slices. `val` rejects values above127 instead of silently wrapping; 14-bit values use explicit low/high slices.
- Unknown directives/tokens, non-SysEx tx and unsupported constructions remain opaque and exportable. They do not get a guessed preview. Multiple exact tx lines can be previewed together in BCL; the single-message hex editor is read-only for multiple/opaque programs. Comments/source survive unchanged mode switches. Explicit form/hex edits change only their corresponding known directive.
- `Encoder` gains optional `customAssignment` plus `fallbackType`, and active `sysex`/`bcl` variants. Stored AST must match a fresh source parse; a JSON claim of hardware validation is rejected. Legacy standard fields remain the inactive restore fallback; the program's range/default belongs to its own descriptor. Existing v1/v2 JSON remains readable. Custom-bearing files require this newer editor; older readers are not promised forward compatibility. No SDK/schema negotiation is fabricated.
- Standard CC senders reject custom descriptors; assignment planners refuse custom→standard/OFF coercion; indexed hardware reads retain the local custom draft and raw replies separately. Cubase export lists custom controls as unsupported rather than producing a false CC mapping. The legacy BCL projection preserves opaque source through its existing parameter-state compatibility path.
- The UI inherits theme, selection, lock, injected storage, preset/library and global applied-state history. It does not replace the panel geometry, create an output port or add an executable module registration. Technical labels are English; full localization and IDE-grade completion/highlighting remain follow-up work.

## Safety and remaining work

No new sender, query, STORE, command72, bootloader77, global-routing operation, sequencer operation or arbitrary-SysEx grant is introduced. Existing validated operations keep their original gates, including exact firmware checks. A hardware custom upload needs a separate qualified transaction: backup, identity/CTRL/firmware confirmation, explicit handling of native Type OFF, exact lines/ACKs, independent readback and a defined restoration strategy. Native BCL support alone does not satisfy these gates.

Advanced relative/checksum/condition/repeat tokens are retained but not evaluated. Native custom emission, incoming custom feedback, complete multi-control merges, automatic requests/snapshots, LED/OLED protocols, macros and deeper ZAQ/CV functions are **not delivered** here. See [implementation tickets](work-items/2026-10-29-bcl-sysex.md).
