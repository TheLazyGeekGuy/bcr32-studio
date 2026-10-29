# BCR32 live SysEx editing and authoritative assignment reread

Status: software correction validated locally; physical T2 report and production publication tracked separately.

The owner reports that Apply custom program locally does not program rotation 32, and that rereading assignments leaves UI parameters different from hardware on T2. Requested behavior: valid SysEx edits in live edit mode must use the existing checked hardware writer without a separate apply/send journey.

## Review trace

Codex primary, exact model/effort not exposed, 2026-10-29 17:43 CET. Repository bcr-studio-firmware-103, branch work/bcr32-bcl-sysex, clean baseline 7ccaa7b8ab2410d17d28dca9c1a37ab37219ab15. Read controller-read.ts, Workbench.tsx, ControllerPresets.tsx, CustomProgramEditor.tsx, custom-program-transfer.ts, related BCL parsers and browser fixtures. Subsequent uncommitted changes are identified in this work item.

Confirmed code issue: assignmentFromRead unconditionally refuses all controls with a local customAssignment. An explicit reread can therefore retain a stale local SysEx assignment even when hardware now reports CC. Indexed OFF alone cannot distinguish a native .tx program from an empty control; complete working-preset BCL is needed for that case. Whether this is the sole cause of the reported T2/CC23 discrepancy is not yet physically established.

## Scope and acceptance

- Valid direct text/range edits apply locally and, while Assignments → BCR32 is enabled and a qualified connection is ready, debounce through backup/OFF/BCL/readback. No implicit STORE.
- Opening, selecting a Type, import/catalogue load, simulation, reconnect and restored drafts do not trigger an upload. Invalid/opaque programs remain local with visible status.
- Complete indexed CC/NRPN rereads supersede unchanged stale local custom assignments; ambiguous OFF/custom cases use complete working BCL when available. Preserve drafts edited during a read and back up originals.
- No mixed-preset merge after track/connection changes. Read-only reconciliation never writes.
- Regression fixtures include rotation32, push32, no write on opening/reconnection, valid/invalid live edits and stale custom → CC/OFF/native .tx rereads.
- Trace tests, hardware proof separately, docs and version.

Uses the installed midi-studio-instrument skill and transverse rediger-tickets-actionnables skill. No physical write is launched just to diagnose a mismatch; device writes remain the user's live editing operation, scoped to working memory.

## Implemented delta and review

A second confirmed defect was found in the real-browser fixture: choosing the SysEx type called stopEmission(), which set assignmentLive false. Custom type selection, local application and transaction preparation now stop only live value emission, preserving the assignment toggle. Actual source edits schedule one 700 ms debounced transaction; source restoration, imports, catalogue loads and opening are inert. The previous local-only fixture explicitly disables live assignments, while a new fixture exercises the real live mode.

The existing ProgramTools transaction now exposes a read-only current-preset read using the same reader. After the indexed scan, native custom BCL is reconciled only for requested targets, then complete indexed standard fields are merged. A local custom→CC change clears obsolete custom/fallback metadata. Native OFF is not taken as proof of no .tx. No missing selector is invented as OFF, and edits during reading win. Rebinding/track changes invalidate stale merges. Both the first draft and latest pre-read draft are retained. A single read session cannot be started twice concurrently. No transport/firmware/STORE permission was widened.

Reviewed by Codex primary, exact model/effort unavailable, 2026-10-29 17:55 CET, against baseline 7ccaa7b8ab2410d17d28dca9c1a37ab37219ab15 plus the named uncommitted alpha.8 runtime/test/documentation/version changes. Relevant sources: controller-read.ts, CustomProgramEditor.tsx, ControllerPresets.tsx, Workbench.tsx and custom-program-transfer.ts under src/editors/bcontrol/bcr32/.

## Evidence and limits

- 54/54 unit/conformance scripts and TypeScript passed; includes stale rotation32 custom→CC23, native OFF/.tx resolution, native push32 selector48 and concurrent edit preservation.
- Production build with META_CSP=1 and distribution verification passed.
- Browser live fixture: rotation32/push32 backup/OFF/upload/read-back, debounce to latest valid value, invalid hex refusal, live switch off/on without replay, reload without upload and stale custom→CC23 reread passed with simulated MIDI.
- Existing browser custom transfer fixture passed read, manual backup/OFF/upload/readback, explicit simulated preset STORE, restoration, NAK and backup retention. Local-only BCL/SysEx fixture passed source/comment/history/reload retention and zero writes.
- No physical MIDI output or STORE was sent during this correction. The owner's exact T2 mismatch still needs verification after loading alpha.8; the software reproduction does not establish that all possible preset/cache/firmware differences were the same cause.

Publication uses the already-authorized GitHub and Forgejo main targets, via the isolated release clone and ordinary fast-forward pushes. Local main stays untouched. CI/Pages URLs and public version receipts are retained in ignored local output and reported to the owner after completion.
