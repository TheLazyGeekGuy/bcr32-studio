# Complete catalogue visibility after SXM persistence

Tracking: [issue48](https://github.com/TheLazyGeekGuy/bcr32-studio/issues/48), correction of the persistence gap left by44. Version0.46.0-alpha.18.

## Review provenance

Codex primary agent,2026-11-08 02:48 CET onward. Exact model identifier and reasoning effort are unavailable; provenance is incomplete on those fields. Repository baseline `7b5c48295e7aae0bc6308a4e9497c74cb75610fc`, dedicated branch `work/sysex-bcl-inspector`, initially clean. Read `src/sysex-catalog/{CatalogPicker.tsx,catalog.ts,expanded.sxm.json,starter.sxm.json,tables/*.json}`, SXM serializer/validator, offline compiler and catalogue/browser tests. The user's screenshot and live Firefox accessibility state are outside-Git observations; no claim is made that a downloaded backup file was verified. The user's saved catalogue was not overwritten by this fix.

SDD constraints/specification/plan/tasks were written under `specs/001-catalogue-completeness/` before runtime changes, following the shared Spec Kit instruction. No upstream model protocol was inferred or copied into the catalogue from an unrelated editor registration.

## Root cause and previous test gap

The shipped map contains23 models and3225 definitions. The user's actual Firefox catalogue displayed22/3122. A22-model object refreshed to23 before serialization, but `refreshBuiltinCatalogue(parseMap(serializeMap(old)))` stayed22. SXM canonical serialization sorts object keys; the old `JSON.stringify` equality comparison treated insertion-order differences as a changed user definition.

The previous browser regression supplied raw `JSON.stringify` bytes in the same insertion order as the shipped object. It therefore missed the actual storage boundary. The unit regression now calls the real SXM serializer/parser, and the browser fixture uses recursively sorted object keys.

## Implemented behavior

- Compare JSON object members independently of key order; array order remains meaningful. Semantically changed definitions and known source records still block automatic replacement.
- Refresh unchanged canonical built-in inventories with at least the original20 models and fewer than the current total, including multiple missing additions. Preserve saved preview values/origins and optional metadata; opening remains an in-memory operation.
- Retain independent/scoped imports and customized maps. A full imported inventory indistinguishable from the canonical built-in identity/name/definitions follows the same refresh. Invalid/over-budget merged data falls back to the original validated document.
- Keep native BCL/checksum restrictions,2MiB budget, catalogue loading semantics and MIDI transport unchanged.

## Inventory reconciliation

| Inventory | Result |
| --- | --- |
| Normalized `tables/*.json` |21 tables, every table stem has a shipped device ID |
| Historical seed model IDs |Every ID retained in the shipped map |
| Additional variants / seed-only definition |Microwave XT/XTk explicitly uses the MicrowaveII table with XT overrides; Bass StationII remains in the seed |
| Current shipped collection |23 models /3225 definitions |
| Live missing entry before correction |Yamaha A3000 V2 /103 definitions |
| Other available normalized tables missing from the list |None |

The coverage table in `docs/SYNTH-SYSEX-CATALOG.md` lists every model and its documented scope. This audit does not claim that all instruments ever documented in the separate general MIDI Studio repository have SXM command definitions in this standalone project. Example/demo SXM files are not silently promoted to manufacturer-qualified built-ins.

## Validation and actual UI acceptance

-59/59 scripts and TypeScript passed; production build/distribution passed. The general catalogue test now fails if any normalized table or historical seed model disappears from the shipped list.
- Unit tests cover actual sorted SXM roundtrip,20-model snapshots with three missing additions, saved values/origins, unchanged storage/source object, changed definitions/sources and independent scoped imports.
- Owned Chromium: saved22→23/103 A3000 regression and existing SXM import/export/persistence scenario passed with fake MIDI only and zero writes. The first sandboxed browser launch failed due to macOS Mach-port restrictions; the approved isolated test launch outside that sandbox passed.
- Actual user Firefox: close/reopen after the fix changed the displayed count from22/3122 to23/3225. Searching A3000 selected **Yamaha A3000 V2**, showed103 matching/103 and Program/Sample definitions. The catalogue was left open on that model. No Load/Apply/STORE action was performed in the catalogue.
- Generic leak and whitespace checks are recorded with the final delivery. No performance claim follows from these checks.

## Publication and remaining boundaries

Local branch/code/runtime only; no main/staging/production update, push or deployment. Local commit and shared checkpoint record the final full SHA. This fixes catalogue visibility and reachability of existing definitions, not physical execution of every message, native checksums or whole-instrument completeness.
