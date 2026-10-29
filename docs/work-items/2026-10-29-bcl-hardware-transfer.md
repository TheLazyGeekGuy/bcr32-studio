# BCL-08 — explicit selected-control transfer from the inspector

## Result and scope

The local BCL/SysEx editor had no hardware transfer action. Add current-control reads, an explicit backup/Type-OFF/upload/read-back transaction, original-control restoration and backup download through the existing BCR32 host and ACK sender. No automatic custom upload, persistent STORE, firmware operation, global setting or sequencer change is part of this ticket.

Reader/implementer: Codex primary agent; exact model identifier and effort are not exposed. Started 2026-10-29 07:11 CET on `/bcr-studio-firmware-103`, branch `work/bcr32-bcl-sysex`, clean baseline **`ee00af4e24cf39db43f330603ac2747efdfadc28`**. The implementation, tests and documentation listed here are subsequent uncommitted changes until the delivery commit. Vendor evidence is the previously inspected installed ControlTribe1.12.4 binary, outside Git, with hash/functions in [the dossier](../BCL-SYSEX-EDITOR.md); the initial read was static; subsequent physical evidence is recorded below.

## Contract and decisions

- Reuse `ControllerPresets`' existing reader, ACK sender and operation serialization. The inspector gets an instance-local `ProgramTools` ref; no new MIDI port, generic sender or shared SDK contract is introduced.
- The host admits a prepared, single-target fragment on exactly firmware1.0.2/1.0.3. Existing complete-preset/global/STORE jobs retain their1.0.2 gates. Broadcast writes, another device, another generation, out-of-order/replayed lines and locked instances remain refused.
- `setProgramTypeOff(index)` is a narrow module-specific operation. It sends only addressed Type0, with a temporary edit-buffer grant. The ordinary1.0.3 indexed-write path remains refused. The transaction performs an independent Type GET after a160ms settle; a setter echo alone cannot confirm OFF.
- Before Type OFF: require two identical complete working-preset reads, one unambiguous native selector and a restoration fragment that can be validated. Persist the full original preset, original control body, proposed body, identity and time; read storage back byte-for-byte. Missing backup, changed hardware or unsupported original control means no mutation.
- Initial upload supports exact simple SysEx definitions. Original restoration supports qualified CC/NRPN/OFF bodies or exact custom definitions. Other original types, unknown directives, advanced tokens and unqualified resolution settings refuse before Type OFF; their source remains available for file export. This is a deliberate initial qualification limit, not proof that the firmware lacks them.
- Successful upload requires a complete independent working-preset read, matching tx bytes/tokens and requested min/max/default/showvalue/mode, and unchanged other preset contents. Comments/whitespace may normalize. Success also applies the matching local custom definition. ACK-only success is never labeled confirmed.
- Restoration is explicit and targets only the original control, verified against a fresh current-preset read. Failure/cancellation does not automatically retry or replay a backup over intervening user changes. Backups remain in injected instance storage at `bcr32-studio.before-custom-program.v1`, and can be downloaded as JSON. Same-session restoration requires matching target/device/firmware; after reconnect/reload the durable file remains downloadable, but automatic recovery import is not implemented.
- Controller/Sequencer switching is blocked while this shared preset operation is active. Existing indexed writes and CC emission are stopped before an inspector hardware action. Connection changes close the existing readers/sender; partial changes are reported honestly.

## Acceptance

- [x] Selected-control transaction fixtures: backup/stale/change refusals; timeout, OFF failure, NAK, wrong read-back and unrelated-control mutation retain backup; no automatic retries/STORE; verified restoration.
- [x] Actual broker/bridge fixtures: exact1.0.3 fragment and scoped OFF accepted, old STORE/general indexed setters/future firmware/lock/replayed frames refused.
- [x] Production-browser fake-port UI: read, explicit upload, local apply, original restoration, NAK retention and no STORE/bootloader writes.
- [x] Final full suite/typecheck/build, local-only browser regression and measured artifact/CPU cost recorded below.
- [ ] Physical1.0.2/1.0.3 acceptance: custom emission, complete native read-back canonicalization and restoration on the actual BCR32. Software fixtures do not establish this.
- [ ] Persistent storage/power-cycle acceptance: not part of this ticket.

Rollback: revert this ticket's commit to return to local-only custom programming. Keep the durable backup and local drafts. A code rollback cannot undo an already executed hardware transfer; restore the saved original explicitly and verify it.

## Physical acceptance record

2026-10-29 07:25–07:28 CET, Codex primary, same full baseline plus the identified dirty alpha2 transaction/host/UI files; exact model/effort unavailable, so model-level review provenance is incomplete. Unique BCR32 ports were enumerated natively; identity returned firmware1.0.3/device0. ControlTribe was not running. The initial product/current-preset observations sent no mutation or page switch. A host-state read was refused with status02; no transport or mode inference/action was made from that refusal.

Following the user's go and the announced temporary control32 test: a full257-line working preset was read and backed up, Type2 independently read, addressed Type0 written and independently confirmed, then the selected custom fragment sent and independently read back. The original control was explicitly restored. **The entire final preset equals the original byte-for-byte**; upload+restore used14 BCL lines, all ACK status0; no STORE/bootloader/page command was sent. The actual native export adds `.mode 1dot`, now recognized without losing old alpha1 opaque descriptors. No control was physically turned during this test, so runtime emitted SysEx is still unverified.

- Filtered, non-personal fixture: `scripts/fixtures/bcl-control-103.json`, SHA256 `e780d3d319efc06ef2fd1ff23358e898af56df5b987050e0fabdaec9c1311d93`.
- Complete local capture: `output/observations/bcl-hardware/physical-test.json` (ignored), SHA256 `31c64ea87d49b55e3ebd5cfe1b00162283370b6494abf7eb4b6732091845b376`.
- Complete before-read/before-write records remain ignored in that directory, including the original preset. Only control directives, ACK statuses and full-preset digests are committed in the fixture; unrelated preset contents/names are omitted.

This completes the bounded1.0.3 upload/read-back/restoration experiment. It does not close the broader physical-emission/persistence criterion above.

## Software delivery verification

2026-10-29 07:32–07:36 CET, same baseline plus the final dirty patch, Codex primary (exact model/effort unavailable): **51/51 test scripts**, TypeScript and production distribution build passed. Production-browser fixtures passed for custom reads/uploads/restoration/native ring canonicalization/retained backup download, local-only custom editing (zero assignment writes), and the existing sequencer-host workflow. Generic privacy gate passed387 source files. Existing large-chunk build warnings remain; no remote push/deployment was performed.

Measured emitted JavaScript against the alpha1 build with the same local dependencies: **2,185,588 → 2,196,294 raw bytes**, gzip **849,058 → 852,534 bytes**; delta **10,706 raw / 3,476 gzip bytes**. This is artifact cost, not heap usage. Initial CPU preflight baseline on AppleM4Max/Node26.8.2: extracting control1 from a synthetic82-control/5,465-byte working preset and validating its restoration fragment,100 warmups then2,000 samples: p50 **0.062750ms**, p95 **0.103833ms**, p99 **0.124833ms**, max **0.205125ms**, below the initial16.7ms CPU budget. Raw samples, source hashes and environment are retained at `output/performance/bcl-hardware/preflight.json` (ignored). That measurement preceded the final stricter unrelated-preset comparison, which is outside the measured extraction/fragment workload. It does not establish MIDI roundtrip latency, paint timing, memory savings or a speedup over alpha1.

Final isolated verification at07:36–07:37 CET: clean implementation commit **`49a745d8db9640064acf2edd5e960de9577de9ae`**, separate checkout with declared React/ReactDOM19.3.1 dependencies. All51 test scripts, TypeScript, production build/distribution and the custom-transfer browser workflow passed again. Reader: Codex primary, exact model/effort not exposed. This final record is a subsequent documentation-only change; code and physical evidence are unchanged.
