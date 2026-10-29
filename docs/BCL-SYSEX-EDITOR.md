# BCL/SysEx control programming — local-first implementation

## Scope and evidence

Version **0.46.0-alpha.8**, explicit hardware-transfer integration after the initial local implementation, not a claim of complete native custom-output support. Review/implementation: Codex primary agent, 2026-10-29 02:34 onward, checkout `<workspace>/bcr-studio-firmware-103`, branch `work/bcr32-bcl-sysex`, initially clean full baseline **`78ab3a227d50ef13716e6aa45a19a58e92bd5e32`** plus the subsequently uncommitted parser/model/UI/test/documentation changes. Exact model identifier and reasoning effort are unavailable.

Read scope: existing root BCL/profile/forms/text components, BCR32 profile/read/write/CC transport/preset/store/Workbench, generic parameter state/history and actual host interfaces, build and browser fixtures. This standalone checkout lacks the upstream core-contract/onboarding documents listed by the integration skill; the checked source interfaces are authoritative, not historical SDK sketches. The initial alpha1 slice changed no permissions. Alpha2 reuses the same host SDK and grants, adding only a qualified selected-control fragment and addressed Type OFF operation on exact firmware1.0.2/1.0.3; existing preset/global/STORE gates remain unchanged. See the transfer ticket for the additive module policy.

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

An indexed native Type OFF reading alone cannot prove that custom BCL output is absent. Complete indexed standard replies now replace an unchanged stale custom draft. Assignment synchronization also requests the complete current working-preset BCL to distinguish native .tx from plain OFF; missing or incomplete BCL remains visibly unconfirmed. A local structured program is not advertised as a freshly retrieved hardware assignment.

Historical [B-Control implementation material](https://mountainutilities.eu/bc2000) is BCR2000/BCF2000 research context, not authority for BCR32 firmware behavior. The [manufacturer's BCR32 page](https://behringer.com/en/products/0715-AAW) establishes product context only; it is not a specification of custom SysEx/LED/OLED commands. No CV/Gate API is inferred. The byte example supplied by the owner is a synthetic conversion fixture, not a qualified command for an external instrument.

## Use

1. Select one programmable control in **Control**, then open **Custom SysEx / BCL**. Known local selectors cover rotations, pushes, the 16 main buttons and both footswitches; system controls without a qualified selector show an unavailable explanation.
2. Enter a framed 7-bit SysEx template, for example `F0 42 31 03 41 0F {val} F7`, or edit the selected control's BCL **body**. The selector is shown separately: body editing cannot inject a second control, STORE, recall or a global section.
3. Adjust BCL min/max/default and use the independent **Simulation value** slider. Preview is calculated locally, not captured hardware output or a query of an instantaneous value. Generic front-panel custom feedback is not provided by this lot.
4. **Direct text/range editing** updates this control after a 700 ms typing pause. With **Assignments → BCR32** enabled and an idle qualified connection, it automatically uses the same backup/OFF/upload/read-back transaction as the manual send action. No separate Apply/Send journey is needed. **Apply custom program locally** remains an explicitly local fallback and does not disable the assignment switch. The standard fields become inactive; **Restore standard assignment** explicitly restores the retained standard fields/type, also locally. Existing global history covers applied changes; per-editor text history covers unapplied text.
5. Save/export the existing JSON draft/preset/library to retain the structured program. BCL/SYX export produces a **selected-control fragment**, without preset initialization or STORE. These files are not a complete preset backup or a validated upload job. Hardware STORE does **not** include unsent local custom drafts. After a verified explicit upload, the native working control is changed; persistent storage remains a separate supported hardware operation.
6. Import a BCR32 text or model64 command20 file. Only the selected control is extracted from a single preset/fragment; other controls are not changed. Historical model20/21 files remain parsable by the shared parser but are not silently remapped onto BCR32. The Raw tab retains imported file bytes read-only and can save the original; unsupported/malformed imports never replace the program. Full imported file bytes are retained in the open tool, not embedded into every control's JSON state.

7. On an idle, unlocked CTRL connection with live firmware1.0.2/1.0.3, use **Read control BCL from BCR32** to populate the text from the actual current preset without applying it locally. **Back up, set Type OFF and send program** explicitly replaces only this control: it saves the original working preset, verifies the Type OFF transition, sends acknowledged BCL lines and checks an independent read-back including other controls. Only exact simple SysEx programs and qualified restoration bodies pass this initial path. Unknown/advanced tokens remain file-only.
8. **Save hardware backup** downloads the full original/proposed record. **Restore original hardware control** replays and verifies only the original control from the current connection's backup. It preserves the local custom draft. Errors retain the durable backup and may leave partial hardware changes; they never trigger an automatic retry/STORE. Connection reload retains the backup in instance storage, but restoration import after reload is a follow-up.

## Representation and compatibility

- `src/bcl-document.ts` is the existing parser relocated into one neutral module. `src/bcl.ts` re-exports its old API and retains legacy profile projection. Model64/BCR32 revision/ranges are explicit; historical model20/21 behavior remains covered. No second parser or MIDI transport is introduced.
- `src/bcl-tx.ts` owns bounded structured byte/value/unsupported tokens, source preservation and pure simulation. Exact simple SysEx supports `val` and the known explicit seven-bit-or-narrower slices. `val` rejects values above127 instead of silently wrapping; 14-bit values use explicit low/high slices.
- Unknown directives/tokens, non-SysEx tx and unsupported constructions remain opaque and exportable. They do not get a guessed preview. Multiple exact tx lines can be previewed together in BCL; the single-message hex editor is read-only for multiple/opaque programs. Comments/source survive unchanged mode switches. Explicit form/hex edits change only their corresponding known directive.
- `Encoder` gains optional `customAssignment` plus `fallbackType`, and active `sysex`/`bcl` variants. Stored AST must match a fresh source parse; a JSON claim of hardware validation is rejected. Legacy standard fields remain the inactive restore fallback; the program's range/default belongs to its own descriptor. Existing v1/v2 JSON remains readable. Custom-bearing files require this newer editor; older readers are not promised forward compatibility. No SDK/schema negotiation is fabricated.
- Standard CC senders reject custom descriptors; assignment planners refuse custom→standard/OFF coercion; indexed hardware reads retain the local custom draft and raw replies separately. Cubase export lists custom controls as unsupported rather than producing a false CC mapping. The legacy BCL projection preserves opaque source through its existing parameter-state compatibility path.
- The UI inherits theme, selection, lock, injected storage, preset/library and global applied-state history. It does not replace the panel geometry, create an output port or add an executable module registration. Technical labels are English; full localization and IDE-grade completion/highlighting remain follow-up work.

## Safety and remaining work

No second MIDI sender, STORE, command72, bootloader77, global-routing operation, sequencer operation or arbitrary-SysEx grant is introduced. Alpha2 uses the existing working-preset/Type queries and ACK sender for an explicit transaction. Backup, source stability, addressed native Type OFF, exact prepared lines, firmware/device/lease checks and independent read-back are implemented and tested on fake ports. A bounded physical upload/read-back/complete-restoration test passed on1.0.3 (encoder32), as recorded in BCL-08. Emitted MIDI and other controls/tokens still require separate acceptance; vendor BCL support alone is not that proof.

Advanced relative/checksum/condition/repeat tokens are retained but not evaluated. Physical custom emission,1.0.2 acceptance and broader restoration coverage, incoming custom feedback, complete multi-control merges, automatic requests/snapshots, LED/OLED protocols, macros and deeper ZAQ/CV functions are **not delivered** here. See [implementation tickets](work-items/2026-10-29-bcl-sysex.md).

Alpha2 implementation and review provenance, limitations and acceptance: [BCL-08 hardware transfer](work-items/2026-10-29-bcl-hardware-transfer.md).

## Physical1.0.3 observation — 2026-10-29

A temporary encoder32 test read the complete257-line current preset, verified backup stability and durable local storage, changed addressed Type2→0, sent `.minmax 0 127`, `.default 0`, `.tx $F0 $7D val $F7`, `.showvalue on`, and independently read the native control back. The device canonicalized it to minmax/tx/showvalue/**mode1dot**/default order. All14 BCL lines across upload and explicit restoration received status0. The complete final current-preset text was byte-identical to the original. No STORE, mode change, firmware command or manual encoder movement was used. This proves acceptance/read-back/restoration for this case, **not actual emitted SysEx, arbitrary tokens, power-cycle persistence or Firefox hardware UI behavior**.

The filtered fixture is `scripts/fixtures/bcl-control-103.json`; full captures/backups remain ignored local observations, with hashes and review provenance in BCL-08. Known ring directives now retain an exact classification; old alpha1 opaque descriptors containing these lines remain valid without source loss and are reclassified only on explicit apply.

## Alpha3 STORE/recall qualification

The subsequent [BCL-10 physical test](work-items/2026-10-29-bcl-store-recall.md) passed STORE→alternate preset→recall for both rotation32 and push1 on1.0.3. All64 memory slots, globals and working contents were explicitly restored and independently compared unchanged. The existing **Presets → BCR32 → Save to…** workflow and T1–T4 shortcuts now admit exact1.0.3 as well as1.0.2. First install the custom draft through a verified live edit or the checked upload action; STORE reads actual hardware contents and excludes unsent local edits. Automatic preset/global reads stay inactive while the sequencer view is selected, so they cannot switch the hardware back to CTRL.

Push/button custom programs expose `.mode down` and do not export `.default`. New examples omit that directive; imported source retains it, but sending is refused until it is explicitly removed. The default-value form is for encoder rotations. Other button modes and actual emitted custom MIDI are not inferred from this observation. Persistent storage across a power cycle remains untested.

## MIDI message Type selection (0.46.0-alpha.4)

In Control, choose **SysEx** or **BCL** from the MIDI message **Type** dropdown. The selected editor replaces the standard assignment fields for the current encoder rotation or push. The editor is hidden for standard types. Raw bytes remain a read-only view inside the custom editor.

Selecting a type opens a local draft and sends nothing to hardware. Direct subsequent edits are applied automatically; with live assignments enabled they are also sent through the checked transaction. The local Apply and manual transfer actions remain fallbacks. Returning to a standard type restores the standard assignment locally. Unapplied source remains available when switching back on the same control. Invalid hex must be fixed before switching between SysEx and BCL. The selected representation of an applied program survives reload independently of whether its syntax is exact or opaque. Custom programming remains unavailable for bulk selection and reserved system controls.

## Built-in synth catalogue

Select Type SysEx or BCL and open **Synth SysEx catalogue**. Search by manufacturer, model or parameter, select a command and configure its destination addressing. **Load into current control draft** replaces only the text for the selected rotation/push; Undo text restores the previous draft even if loading immediately followed typing. Loading remains local. Subsequent direct edits participate in the live assignment workflow; local Apply and manual transfer are available as fallbacks. The catalogue does not change the BCR32 connection or automatically decode instrument replies.

See [catalogue reference](SYNTH-SYSEX-CATALOG.md) for all 20 models, 46 commands, primary documents and checksum limitations. The original Microwave checksum templates select the BCL view and remain file-only. Browsing and previews work offline after the application has been cached.

## Interchange between editors

The catalogue supports the independent [SXM file format](formats/sysex-map-v1/SPECIFICATION.md). Import `.sxm.json`, preview it, and load supported parameters into the selected control. Export one parameter, one synth, the full catalogue or its schema. SXM keeps definition metadata and optional values; a BCL export is a device-specific projection and does not preserve the full SXM document. Neither import nor export sends MIDI. Signed/offset slices or effects unsupported by the BCL adapter remain available as SXM files, with a visible local-load refusal.

## Live-edit and reread correction (alpha.8)

Review: Codex primary (exact model/effort unavailable), 2026-10-29 17:43 CET, full baseline `7ccaa7b8ab2410d17d28dca9c1a37ab37219ab15` plus the identified alpha.8 uncommitted sources in [the work item](work-items/2026-10-29-live-custom-and-readback.md). Direct valid edits are debounced and single-flight; unknown tokens and push-only invalid directives are never uploaded. Changing a simulation slider never sends. Re-enabling live mode or reconnecting cannot replay an old text edit. Opening, reading, loading from the catalogue and file import remain inert; explicitly edit or use the manual send action after such a load.

A manual/automatic assignment reread backs up the latest local profile to `bcr32-studio.last-controller-read-draft.v1`, retaining the initial backup separately. Complete standard indexed replies supersede stale local custom programs; native BCL resolves ambiguous OFF/.tx. Edits made while reading win. Hardware track/port changes invalidate the merge. The 64-name query is only a list of preset names; it neither recalls a stored preset nor loads its assignments into the active editor. Live values remain distinct from assignment configuration.
