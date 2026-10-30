# A3000 missing from a saved catalogue

## Provenance

Codex primary agent,2026-10-30 11:17 CET onward. Exact model/effort unavailable; traceability incomplete on that point. Baseline `aeabd64591a903d2d5824dc1ef8cc497e84aac0b`, branch `work/sysex-bcl-inspector`, initially clean. Read `CatalogPicker.tsx`, `catalog.ts`, catalogue/SXM tests and prior delivery records. The local server reportsalpha.16 at the start; the user's precise URL/storage contents were not inspected, so the observed session cause is not independently established.

## Confirmed code path and fix

CatalogPicker restores its saved SXM map in preference to the current built-in map. An unchanged22-model snapshot therefore lacks A3000 V2 despite the installed23-model catalogue. Add an in-memory refresh for the preceding canonical built-in inventory: matching catalogue identity/name, exactly one fewer model, unchanged known device definitions and unchanged known source records. Add missing definitions/sources while keeping saved values, origin and optional metadata. Do not mutate storage merely by opening. Modified/scoped imports remain available through their existing flow and the explicit Built-in catalogue action. Multi-version-old inventories require the explicit built-in action.

This is a conservative content-based migration, not a versioned importer for all historical catalogue schemas. An imported file indistinguishable from an unchanged full built-in snapshot follows the same refresh; customized definitions remain authoritative. It does not update a remote production installation.

Version0.46.0-alpha.17. Unit tests cover addition, value/provenance preservation, no mutation and custom/scoped refusal. Browser acceptance injects the old22-model map at the actual storage boundary, expects23 models and103 A3000 parameters, and checks zero MIDI writes. Existing SXM import/export/persistence tests cover independent custom imports.

No hardware operation, native contract change, push or deployment. Final test results and local delivery SHA are recorded in the issue/checkpoint.
