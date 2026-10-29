# File-only checksum drafts and installed hardware programs

Tracking: [UI issue40](https://github.com/TheLazyGeekGuy/bcr32-studio/issues/40); [native capability gap41](https://github.com/TheLazyGeekGuy/bcr32-studio/issues/41). Version0.46.0-alpha.15.

## Review provenance

Codex primary agent,2026-10-29 23:42–23:53 CET. Exact model identifier and reasoning effort unavailable: review provenance is incomplete on that field. Repository `bcr-studio-firmware-103`, branch `work/sysex-bcl-inspector`, full baseline `4130e53cd5dabed5026109f53f5971fac1c6fa21`, initially clean. Read `src/bcl-tx.ts`, custom-program-transfer, CustomProgramEditor, catalogue/adapter, existing native support notes and relevant browser tests. Changes described here were uncommitted during checks. Outside Git: the owner-provided MIDI log line, plus owned fake-MIDI browser outputs. No new hardware read/write was used for this diagnosis.

## Observed report and code cause

The owner received `F0 7D 5C F7` while a Microwave draft contained `F0 3E 00 00 60 00 03 0C {val} {cks-2} 05 F7`. Code confirms catalogue loading is local-only; checksum tokens remain unsupported by the BCL evaluator/native transfer gate. Consequently the loaded draft did not install the Microwave program. The report is consistent with the previous noncommercial assignment still running, not with a captured Microwave transmission. No independent current hardware read is claimed.

The simple display also printed unsupported checksum tokens and their operands as if they were part of an editable hex template. That representation is inappropriate: `5` is the BCL checksum operand. The original source must remain BCL until it can be interpreted exactly.

## Correction and limits

- File-only drafts have a dedicated badge and persistent native-transfer-unavailable notice. Loading a checksum is named Load file-only draft.
- Unapplied local sources do not receive the Live editing badge solely from the global switch.
- Advanced/non-single-message source stays in BCL; unsupported pseudo-hex rendering is not shown. Mode-change refusal retains source and history.
- Native transfer, checksum execution and STORE gates are unchanged. No unsupported program is uploaded to make the mismatch disappear.

Native checksum support is **not implemented or qualified by this patch**. Issue41 remains open and must require typed operands, independent vectors, backward compatibility, bounded backup/read-back and actual physical emitted bytes before a supported native capability is claimed. The catalogue is a definition inventory, not a hardware-execution matrix.

## Verification and tracking

Focused i18n and custom-transfer tests plus build/type checks pass. Updated browser cases cover file-only labeling, refusing the simple SysEx view, retained source/export/Undo, disabled native sending and zero writes. Final pass results follow below.

Per the newly supplied project-follow-up protocol, the existing repository is summarized in the local vault under `Projets/bcr32-studio/`; an optional sibling-vault pointer is added in repository AGENTS.md. The canonical evidence remains in this repository and GitHub tickets. Vault metadata is local, outside this commit; its required check passed. Other agents' vault entries were preserved. Tracking authorizes no push or deployment.

Final checks23:55–23:56 CET:57/57 scripts, TypeScript and build pass; generic publication/whitespace checks pass. Both BCL/SysEx and catalogue fake-MIDI browser scenarios pass file-only notices, refusal to switch to the misleading simple view, preserved source/Undo/export and zero writes. The pure txToSysex converter also refuses non-exact input, with an added regression assertion; unknown source remains retained in BCL. No native checksum support is claimed, and issue41 remains open.
