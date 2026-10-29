# Simplify the SysEx/BCL inspector

Tracking: [GitHub #38](https://github.com/TheLazyGeekGuy/bcr32-studio/issues/38). Version:0.46.0-alpha.13.

## Review provenance

Codex primary agent, 2026-10-29 23:09–23:18 CET. Exact model identifier and reasoning effort are unavailable, so that provenance field is incomplete. Repository `bcr-studio-firmware-103`, branch `work/sysex-bcl-inspector`, full baseline `1c8c049c285bed2fdc8a95ca7fb189822928956c`, initially clean. Read scope: CustomProgramEditor, Workbench custom/unsupported inspector, module CSS, shared language/translatedTree, catalogue view, existing BCL/custom-transfer/SXM browser scenarios and unit tests. Changes were uncommitted during verification. Outside Git: the owner-provided screenshot and owned-browser fake-MIDI rendering under ignored `output/research/`; no desktop screenshot or physical-control write was used.

## Changes and boundaries

The visual thesis is a compact editor using the existing dark surface/accent, with source and range as the primary work area. The content plan is source/compact state first, optional preview second, optional files/recovery third. Interaction uses native disclosures and focus/hover help, without decorative motion or a new dependency.

The previous component opted out of translatedTree and did not translate itself. It now consumes the shared language context and translates its own native tree. The catalogue does likewise. English/French labels, accessible names, help and routine status are covered. Other untranslated languages deliberately retain English fallback. User source bytes, labels, model names and raw technical diagnostics remain data rather than translation targets.

Long persistent prose moved to contextual help or Compatibility details. Manual Apply/read/send/recovery/import/export are retained under Files and recovery. Live direct edits keep the same700ms scheduling and existing backup/OFF/upload/read-back flow; the presentation does not grant MIDI access or alter STORE. Simulation remains local. The generic unsupported-standard warning is omitted only when the selected control has a structured custom descriptor, and remains visible for genuinely unrepresented standard data.

CSS is scoped to the BCR32 module. Range inputs share a row; mobile spacing keeps the sticky status bar clear of the final disclosure. Source, history, selection, permissions, hardware pages and registration are unchanged.

## Verification

-57/57 unit-script suites and TypeScript pass, including i18n catalogue completeness/unique-key checks; build/distribution pass.
- New owned-browser ergonomics scenario passes collapsed defaults, compact height, French/English labels/help, Escape dismissal, source and open-disclosure preservation across locale changes, local simulation, narrow-field containment and zero MIDI writes.
- Existing BCL/SysEx browser scenario passes invalid-source refusal, exact comments/source, isolated fragment export, local Apply/restore, Undo/reload, opaque/raw views and no writes.
- Simulated custom-hardware scenario passes independent read/write, backup/OFF/send/read-back, explicit preset STORE, restore, NAK/backup retention and push-specific defaults. It is not a new physical hardware test.
- Catalogue and SXM browser scenarios pass full-map import/export, parameter selection, rotation/push isolation and zero writes.
- Owned-render visual inspection passed after fixing the narrow sticky-footer overlap.

No new hardware qualification, push or production deployment is claimed. Native parsing diagnostics and manufacturer metadata may remain in their original language inside technical details.

## Final local checks — 23:18–23:21 CET

Same baseline/reviewer provenance as above; UI, dictionary, tests, release metadata and docs remained uncommitted during checks. Final version/type rendering, i18n completeness/unique-key checks, build/distribution, generic publication scanning and whitespace checks pass. Existing private publication findings are unchanged; this lot is not pushed.

Two additional simulated-browser regressions pass: live custom rotation32/push32 upload/debounce/invalid refusal/no replay/stale-custom-to-CC reread; and standard encoder/button/push CC/OFF/GS/NOTE behavior with custom-to-OFF clearing. Their synchronization-text expectations were updated to the new concise messages; byte, read-back, timing and no-STORE assertions remain intact. An initial run waited for the old assignment-off wording; after updating that expectation, the full scenario passes.

The final presentation requires no new dependency, MIDI port, firmware gate or transport permission. A local documentation/code commit follows; no production deployment or new physical writing test is claimed.
