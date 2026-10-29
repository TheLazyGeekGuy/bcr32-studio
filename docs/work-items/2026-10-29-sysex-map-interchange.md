# Define and implement portable SysEx Map interchange

Status: specification drafted first, then implemented locally in **0.46.0-alpha.6**. No publication or physical MIDI validation claimed.

User request: an interchangeable parameter-name/value/SysEx/checksum matrix reusable by other editors. Deliver SXM 1.0 as an open draft with schema, pure reference SDK, samples, independent byte vectors and integrated catalogue import/export. Do not claim official standard adoption, hardware certification or implicit MIDI authorization.

Baseline: repository `bcr-studio-firmware-103`, branch `work/bcr32-bcl-sysex`, clean full commit `33be0c3edc87f9e9085fdb4eefd5a5e2451e860b`. Codex primary agent, exact model/effort not exposed, review beginning 2026-10-29 10:26 CET. Read `src/sysex-catalog/{catalog.ts,CatalogPicker.tsx,catalog.json}`, existing BCL/SysEx editor, `src/instrument-sdk/contracts.ts` and `src/editor-host/preset-exchange.ts`. This standalone checkout lacks the SDK architecture documents named by the installed platform skill; existing actual exports govern integration. New specification files are uncommitted at drafting time. No hardware access is needed or authorized by this file task.

Acceptance:

- Written specification and architecture precede codec/UI implementation.
- JSON Schema and runtime semantic validation agree on valid fixtures; malformed/unsupported files cannot replace the current catalogue.
- One canonical definition source for the shipped 20 models / 46 commands; existing bytes and UI behavior preserved.
- Independent Python/TypeScript encoders agree on values, slices, fields and checksum fixtures.
- Import/export retains optional extensions and saved values; selected subsets have valid references.
- Browser import/search/preview/local-load and offline flows pass without physical MIDI or external requests.
- Tests, typecheck, build, source review and documentation complete; report local versus published status explicitly.

## Implementation and review completion — 2026-10-29 10:47 CET

- Normative draft: `docs/formats/sysex-map-v1/SPECIFICATION.md`, architectural ownership/migration: `ARCHITECTURE.md`, contributor/standalone instructions: `INTEGRATION.md`.
- Public pure SDK: `src/sysex-map/{types.ts,index.ts,schema.json}`. JSON Schema 2020-12 structure plus runtime semantic validation; strict UTF-8, duplicate-key/depth/byte limits, immutable detached data, explicit values/origins, source references, extension preservation, signed/sliced values, multiple frames and three checksum algorithms. No React, browser storage, BCL, MIDI port, timer or network imports.
- One shipped definition source: `src/sysex-catalog/starter.sxm.json`. The old private catalogue JSON is moved to `scripts/fixtures/sysex-catalog-alpha5.json` only for regression comparison. Existing `catalog.ts` API is a projection; encoding delegates to SXM.
- Explicit `bcl-adapter.ts` refuses effects beyond current edit-buffer/request support and arithmetic/slices it cannot faithfully represent. Checksum programs stay opaque/file-only under the unchanged hardware gate. An SXM preview is not proof of native execution.
- Existing catalogue UI imports/exports a full file, a synth, a parameter and the schema. Validation completes before replacement. Saved values/fields are reflected as file data, never inferred hardware state. Unsupported imports retain the active catalogue. Preview/address edits export as user-origin data. Optional injected storage retains imported definitions; asynchronous reads are invalidated on replacement/disposal.
- Reference package: `npm run build:sysex-map-sdk` produces `output/sysex-map-sdk/` with an ES module, NodeNext-compatible declarations, schema and specification. A separate consumer type-check and Node execution smoke pass. The package is private/local and was not published. CI adds this build check without changing deployment policy.
- Four portable examples plus 11 manually expected byte vectors; stdlib-only Python reference encoder is independent of TypeScript. It is explicitly not a complete validator.

Traceability: Codex primary agent, no sub-agents. Exact model identifier and effort are not exposed. Read/reviewed on 2026-10-29 10:26–10:49 CET from full baseline `33be0c3edc87f9e9085fdb4eefd5a5e2451e860b` plus the above then-uncommitted SDK, catalogue migration/adapters, UI, tests, workflow, documentation and version metadata. Outside-Git outputs are `output/sysex-map-sdk/` and `output/sysex-map-consumer/`; no vendor executable or device capture was executed. Existing instrument/preset envelope contracts were inspected and remain unchanged.

## Acceptance evidence

- `npm test`: **53/53** scripts plus TypeScript passed. Includes all 4,115 catalogue range values, old/new factory byte parity, malformed definitions/UTF-8/duplicate keys and reference/range/checksum refusals, extension/value retention and immutable document isolation.
- Independent Python renderer: **11/11** byte vectors equal both manually expected bytes and TypeScript output. Covers TX81Z, Microwave, FS1R, signed/offset/14-bit/nibble encodings, all checksums and multiple messages.
- Independent `jsonschema.Draft202012Validator`: schema itself and **5 documents** (starter plus four examples) passed. Invoked in a temporary `uv run --with jsonschema` environment; no new application runtime dependency.
- `META_CSP=1 npm run build`: passed, distribution verified. Main editor bundle remains 578.96 kB; catalogue chunk grows from 27.62/6.89 kB raw/gzip to **47.66/12.15 kB**, including schema, generic decoder and import/export UI. The catalogue remains lazy. No heap reduction is claimed.
- Existing catalogue local preview workload: 10,000 checksum previews **4.64 ms** in one Node sample versus 2.97 ms previously; a small absolute increase, not a speedup or a hardware timing measurement.
- Browser fixtures on production preview, fake MIDI only: SXM import/export, saved values/fields/origin/extensions, invalid import retention, scoped persistence/reload, unsupported BCL/effect refusal; existing catalogue rotation/push, BCL editing and simulated transfer/STORE/restore regressions.
- Real service-worker offline browser: catalogue first open plus SXM import/export, root/editor subpath navigation and restoration of the built-in catalogue. No physical MIDI API or external network used.
- Documentation relative links checked. Generic leak gate passed (416 files / 330 reachable commits before this commit); whitespace check passed. All five browser fixtures passed on the final local production build, including strict UTF-8 import refusal and offline SXM exchange.

## Limits and delivery boundary

This is a proposed open SXM 1.0 contract with a tested reference implementation, not an official MIDI Association standard or demonstrated third-party adoption. It supports bounded MIDI 1.0 SysEx parameter definitions, not every manufacturer dump packing/CRC, receive decoder or transport scheduler. Unsupported required extensions/versions fail before activation. Hardware modes, identity, pacing, routing, grants, ACK/readback and persistent storage remain host/device concerns. No synth or BCR32 message was sent, and no GitHub push/deployment occurred for this work item.
