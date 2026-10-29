# Custom MIDI message types in the Control inspector

Status: implemented locally in 0.46.0-alpha.4; not published by this work item.

## Request and scope

Expose SysEx and BCL in the existing MIDI message Type dropdown. Show the corresponding editor only when selected, for encoder rotation and push. Keep the established parser, descriptor model and explicit hardware transfer service.

## Traceable review

- Repository: `bcr-studio-firmware-103`, branch `work/bcr32-bcl-sysex`.
- Full baseline: `55107e924d4da8988734a37975dffaaf1dfed506`.
- Reviewer/implementer: Codex primary agent, no sub-agents. Exact model identifier and reasoning effort are not exposed by this session; model-level traceability is therefore incomplete.
- Review and verification: 2026-10-29, approximately 09:43–09:51 CET.
- Read: `src/editors/bcontrol/bcr32/{Workbench,CustomProgramEditor}.tsx`, `multi-selection.ts`, `src/styles.css`, `scripts/e2e-{bcl-sysex,custom-program-transfer}.cjs`, existing sidebar/version tests and the user guide.
- Reviewed uncommitted changes: these UI/CSS/browser-test files, this work item, user guide, changelog, README and synchronized package/site version fields. No external or untracked source was used as implementation evidence.

## Delivered

- Type includes SysEx and BCL; a selected custom representation hides the standard fields and reveals its editor. Raw bytes remain an internal read-only view.
- Representation is separate from exact/opaque program semantics, preserving profile validation and lossless source.
- Unapplied source survives hiding/showing the editor on the same control. Invalid hex blocks switching between custom representations. Applied custom representation is persisted per control with the injected storage service.
- Returning from an applied custom definition to a standard type restores the fallback locally. Global Undo restores the custom definition and representation.
- Multi-selection and reserved controls do not enable custom programming. Existing explicit read/transfer/restore/STORE paths remain intact.
- No physical MIDI messages were sent for this change.

## Acceptance evidence

- `npm test`: 51/51 scripts and TypeScript passed.
- `META_CSP=1 npm run build`: passed, distribution verified.
- `e2e-bcl-sysex.cjs`: passed against the production build with fake MIDI only. Covers conditional visibility, Type switching, invalid hex, source preservation, local apply, standard restoration, Undo, reload, opaque/raw and zero write commands.
- `e2e-custom-program-transfer.cjs`: passed against the production build with fake MIDI only. Covers read, backup/OFF/upload/readback, explicit STORE, restoration, NAK and push defaults using the new Type entry point.
- `git diff --check`: passed.

## Delivery boundary

Local preview: port 5193, `/editor/?native=0`. No new hardware qualification, GitHub push or production deployment is claimed. Earlier real-device evidence remains limited to its recorded firmware and scenarios.
