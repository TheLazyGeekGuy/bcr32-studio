# A3000 V2 catalogue, demo firmware audit and desktop study

Tracking: [delivery42](https://github.com/TheLazyGeekGuy/bcr32-studio/issues/42), [desktop implementation43](https://github.com/TheLazyGeekGuy/bcr32-studio/issues/43), ongoing catalogue37 and native checksum41.

## Review provenance

Codex primary agent,2026-10-30 10:44 CET onward. Exact model identifier and reasoning effort are unavailable; review provenance is incomplete on those fields. Editor baseline `1726b6217e958e8026bbe65a51e658c9a3e31b5f`, branch `work/sysex-bcl-inspector`, initially clean. Read catalogue/compiler/SXM/BCL adapter/UI/tests, actual runtime/broker/MIDI topology/provider composition and native inventory helper, architecture/build documentation. Scope and outside-Git PDF digests are recorded in the linked manufacturer ledger. Delivery changes were uncommitted while read.

External firmware reference: clean research clone at `47765b302150d87ecad5dcd89dd0de28bdb66260`; focused paths and limitations are in [the audit](../BCR32-OPEN-FIRMWARE-AUDIT.md). No untrusted build scripts or firmware executables were run. The referenced upstream import commit was not separately checked out.

## Delivered

- A3000 V2:103 scalar definitions,30 Program/73 Sample, from the original manufacturer table plus V2 replacements. High-first nibbles, indexed fields, selected-object warning, signed software-only paths and explicit ambiguities/exclusions. No new full editor or automatic object selection/read.
- Catalogue now23 models /3,225 definitions; generated SXM1859741 bytes including final newline, below2MiB. Normalized A3000 table SHA-256 `70e2c6721eb8af8034b6c61034ee4cc1e53d394bf61359c1c50283e4ac7221b2`; generated map SHA-256 `8a013b10fe6229d6810c18add43ab896076f171a68e2bb32d0477cd170232522`.
- [A3000 integration guide](../A3000-V2-CATALOGUE.md), [source firmware audit](../BCR32-OPEN-FIRMWARE-AUDIT.md), [desktop architecture](../DESKTOP-APPLICATION-STUDY.md), existing README/architecture/catalogue docs and seven-page generated documentation site.
- App/package/landing/changelog synchronized to0.46.0-alpha.16. No runtime host contract, hardware command grant, physical STORE or firmware change.

## Findings

The reference is demo0.0.1, not commercial1.0.3. Its OLED/LED/CV routines are local firmware calls; the inspected host SysEx handler accepts74 mode query and77 bootloader entry only.74 distinguishes application state, not CTRL/ZAQ. It does not establish a native BCL/checksum/display API.

A desktop edition is feasible using the same editor and host broker. Proposed first proof of concept: Electron and the already-installed Node MIDI binding, behind an optional provider seam; Tauri/midir remains an alternative. Native inventory is currently read-only enumeration, not RX/TX. Desktop binary/packaging and physical/native performance validation remain open in43.

## Validation and corrections

-59/59 test scripts and TypeScript passed; production build/distribution passed. The documentation-site test was strengthened afterward to require all seven pages and passed separately.
- Manufacturer PDF object-edit/base table pages rendered and visually checked.103 definitions tested at three values against an independent nibble algorithm; four independent Python comparisons; all catalogue280316 range values checked by the general codec suite.
- Owned Chromium with exclusively fake MIDI: catalogue browsing/import/export/current rotation/push draft/reload/Undo and zero writes passed. A3000 count/context/cutoff/signed-refusal checks passed. SXM restore-count assertion needed updating from22 to23; this was a stale fixture expectation, not a runtime regression. The import-refusal test also waited for an old generic file-only badge; it now waits for the new persistent-write diagnostic before asserting, avoiding a stale asynchronous render. Initial nibble generation over-narrowed constant-width slices and was corrected before the passing suites; native slice permissions were not relaxed.
- Generic leak scan and whitespace checks passed. The previously recorded full private-history leak-gate findings were not repaired or bypassed by this task; no push was requested or attempted.
- No physical MIDI capture/send, A3000 qualification, firmware installation, desktop executable, Windows/Linux test or new production deployment. Physical input/value observation remains distinct from stored assignments and durable persistence.

## Delivery state

Local work branch only; main, staging and production untouched. A local commit records the named scope; its complete SHA is recorded in the ticket and shared checkpoint after creation. No push/merge/deployment is implied. Continue desktop implementation through43 and native checksum research through41; do not treat this audit as permission to run firmware maintenance commands.
