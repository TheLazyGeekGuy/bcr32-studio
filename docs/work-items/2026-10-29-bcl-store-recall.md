# BCL-10 — hardware STORE, preset recall and complete rollback

## Scope and provenance

Requested by the owner after the alpha2 working-buffer test: verify custom assignments through an actual STORE, change to another preset, recall and independent read-back, then restore the original device state. No power cycle, emitted control-message test, firmware operation or remote publication is included.

Codex primary agent, 2026-10-29 09:03–09:15 CET; exact model identifier/reasoning effort unavailable, so that part of review provenance is incomplete. Repository `bcr-studio-firmware-103`, branch `work/bcr32-bcl-sysex`, initially clean full commit **`823d7e215d6c5e9987cfe75752e5d88ad185c1c7`**. Read scope: preset reader/ACK sender/store planner, shortcut transaction, custom transaction, host policy/bridge and inspector. The successful physical run used this baseline plus uncommitted `src/bcl-tx.ts` and `custom-program-transfer.ts` fixes described below. Later UI/gate/test/docs changes are separately uncommitted alpha3 implementation inputs until the delivery commit. Native test scripts/captures under `output/observations/bcl-store-recall-20261029/` are outside Git; no new vendor-binary evidence is claimed.

## Before mutation

- A unique native BCR32 input/output pair returned firmware1.0.3/device0. No ControlTribe process was present; a3-second quiet check detected no unsolicited SysEx.
- Read and durably saved the global block, complete257-line working preset and **all64 individual memory slots**. Reads sent no page command.
- Selected slot63 because it was absent from the active shortcut bindings and its complete original contents could be prepared for exact restoration. An empty slot was not assumed safely erasable.
- Rechecked global/working/destination contents against the backup before mutation. Temporary assignments targeted encoder32 (native index81) and push1 (`$button17`, native index16), with noncommercial manufacturer7D test templates. No physical turn/press was requested.

## Initial refusal and correction

The first attempt successfully installed/read the rotation but stopped before STORE on push read-back: all lines received ACK0, yet the device omitted `.default 0` and exported `.mode down`. Treating ACK alone as success would have hidden this difference. The entire working preset, globals and64 slots were restored and compared unchanged.

Alpha3 omits `.default` from new push/button examples and hides its form field. An imported push/button body containing that directive is preserved but hardware sending is refused **before any query/mutation**; it is never silently stripped. The observed `.mode down` remains exact/source-preserved. Old opaque descriptors retain their previous-source compatibility. No other button mode is inferred from this one observation.

## Successful physical sequence

1. Install and independently verify the two custom working controls. Rotation: `.tx $F0 $7D $11 val $F7`; push: `.tx $F0 $7D $12 val $F7`, without `.default` on the push.
2. Read the native working preset, name the complete test copy `BCL STORE TEST`, send it with **`$store 63`**, then independently read memory slot63. It matched the proposed complete preset exactly.
3. Temporarily bind/select T4→63 through the existing four-line `.tracks` transaction and verify the working preset equals the stored copy.
4. Select T1→1 and verify the working preset equals the previously backed-up slot1.
5. Select T4→63 again. The complete working preset, including both `.tx` assignments, was identical to the stored copy. Stored/recalled SHA256: **`5ea2af053ad0fb6d11b743f1c32369f32ab12454a0e23c0bf8abf40db213d97e`**.
6. Explicitly restore the original slot63 with a second `$store 63` and independently verify it.
7. Restore the original shortcut/global block and original working preset, then independently reread **all64 slots**, globals and working contents. Every compared BCL text was byte-identical to its original. Working before/after SHA256: **`8b333eb3dc42e67c7b6160893f4b2f3553a9bfd77ccf5f141b233e093d842b0c`**.

The successful bounded run took about44 seconds, including quiet check, ACK pacing and complete bank comparison; this is not a per-message latency benchmark. **805 BCL acknowledgements, all status0**. Two `$store 63` lines total: test and restoration. No command72/global STORE, bootloader77, transport or hardware page switch was sent. Exact BCL restoration does not assert retention of transient knob values, hidden fields absent from exports, or persistence after power removal.

## Evidence and application delta

- Public filtered fixture: `scripts/fixtures/bcl-store-recall-103.json`, SHA256 **`3cff911815d24ce9dd62cf663899bce560892cc4d661dbe4e5a780c77ed22b09`**. Contains only target bodies, digest comparisons and counts; full original names/unrelated preset contents remain local.
- Complete successful local capture `output/observations/bcl-store-recall-20261029/test.json`, SHA256 **`9afe7fececf6dafdc2029ff612be03766a5c627f63a54ccabb511a699f7f1b31`**.
- Failed-first-attempt capture `attempt-1.json`, SHA256 **`12a5764f15b3587121f098f4ac8b62a5e6fe4b9d2c93c500005a1c9d5b06a97d`**, with confirmed full restoration and no STORE.
- `before.json` retains the complete original bank/globals/working backup; the native run script is retained beside it but is not an application transport.

Based on the actual1.0.3 evidence, the existing prepared complete-preset STORE and four-line shortcut paths now admit **exactly1.0.2/1.0.3**; native `.minmax` lines are accepted in persistent jobs. Other firmware, unprepared jobs, arbitrary globals, command72/77 and generic1.0.3 indexed setters remain refused. The application continues to use the existing broker/lease and readers/sender. STORE remains an explicit Presets→BCR32 action; unsent local drafts are excluded. Native physical acceptance is distinct from browser tests of the application.

## Acceptance

- [x] Hardware STORE/change/recall for the captured rotation and push templates.
- [x] Complete bank/global/working rollback independently verified.
- [x] Physical fixture retained without personal preset content.
- [x] Final software regression/typecheck/build/browser checks recorded below.
- [ ] Actual custom MIDI emitted on a physical turn/press; power-cycle persistence: still untested.

No published tracker issue is created or closed by this repository-local work item. No remote push/deployment is part of this test request.

## Software verification

2026-10-29 09:13–09:18 CET, same baseline plus the listed alpha3 dirty sources, Codex primary (exact model/effort unavailable): **51/51 test scripts**, TypeScript and production build/distribution passed. Existing large-chunk warnings remain. Production headless-browser fixtures passed for explicit1.0.3 UI STORE of a native custom program (including slot read-back and working restoration), local-only editing with zero writes, native custom read/upload/restoration, refused push defaults, durable backups, and existing sequencer behavior. Preset/global automatic reads and shortcut monitoring are now gated to the Controller view, preventing an implicit CTRL page switch during sequencer use. The generic privacy gate passed389 files; full private captures remain ignored. These browser results use simulated MIDI and are separate from the real native STORE/recall experiment above.
