# Expand the manufacturer-backed SysEx catalogue

Tracking: [GitHub #37](https://github.com/TheLazyGeekGuy/bcr32-studio/issues/37). Status: substantial local implementation; whole-instrument exhaustive coverage remains open.

## Review provenance

Read and implemented by Codex primary agent, 2026-10-29, 20:26–21:09 CET. Exact model identifier and reasoning effort are unavailable, so that provenance field is incomplete. Repository `bcr-studio-firmware-103`, branch `work/sxm-full-catalog`, baseline full commit `e9c85468f8f3c6f275c7d870f88d8f809e1e62dd`. Changes described here are uncommitted. Read scope: catalogue, BCL adapter, standalone SXM codec/validator, Python reference renderer, fixtures/tests, manufacturer tables and source ledger in `docs/SYNTH-SYSEX-CATALOG.md`. Manufacturer downloads/renderings and raw measurements under ignored `output/research/sysex-catalog/` are outside Git.

## Implemented scope

The catalogue grows from46 examples for20 models to3,122 definitions for22 model entries: separate MicrowaveII and XT variants and new JV-2080 Patch/Tone coverage. Normalized source tables compile offline and deterministically; prebuild detects stale generated data. Search includes sections and parameter names. Imported metadata is read defensively. Preview, export and browsing remain inert and use no hardware sender.

Corrections include MicrowaveI RTBP offsets/checksum, model-specific Yamaha operator ordering, CS nibble encoding, M1 wire positions, JV-2080 address/nibble/checksum construction and explicit discrete raw domains. The required SXM value-domain extension is implemented in TypeScript and the independent Python renderer; old consumers must refuse it. Unsupported BCL domains/encodings/effects remain unavailable rather than producing a different assignment. Large-map serialization remains inside the existing2MiB import budget.

## Evidence and limits

- All57 existing unit-script suites and TypeScript passed at21:05; the production build and distribution checks passed.
- Catalogue renderer tests cover263,264 valid raw values plus invalid-domain/range refusals.
- The fake-MIDI browser catalogue scenario passed22-model search, selection, isolated rotation/push loading, local apply/reload/Undo and zero output. No physical synth validation is implied.
- At21:09, the standalone SXM test passed13 independent Python/TypeScript golden vectors, including stepped and enumerated domains, with invalid intermediate values refused by both implementations.
- Generated SXM:1,790,623 bytes. Lazy catalogue JS chunk:1,630.04kB raw /75.75kB gzip. An owned-browser first-open action measured964.8ms, including automation overhead. There is no baseline memory comparison and no claimed memory saving. All model data is still loaded together on catalogue opening.
- Source scopes and exclusions are itemized in the canonical catalogue document. JV System/Performance/Rhythm, M1 packed/effect-algorithm/Combination/Global contexts and other unlisted bulk/global formats are not implemented. AN200 source-selection exclusions need a further exact mapping against the manual footnote; no exhaustive value-domain claim is made for that table. Some DW semantic bounds need additional manual reconciliation. These gaps keep the exhaustive-coverage ticket open.

## Publication state

Local only at this checkpoint. No commit, remote push or deployment of this expansion has occurred. Production and staging have not been changed by this work. Physical CTRL/ZQR following is a separate open defect, tracked in #36.

## Additional verification — 22:53–22:55 CET

Same baseline/reviewer provenance as above; all changes remain local/uncommitted at this reading. The expanded browser test passed all585 JV-2080 entries, section narrowing, empty parameter-search recovery, Blofeld stepped-value refusal, full expanded-catalogue download/reimport below2MiB, isolated rotation/push loading and zero writes. First-open action measured944.9ms in this run; no memory-gain claim is made. The existing SXM import/export browser scenario also passes after adding the two discrete-domain examples. All57 suites, TypeScript and build pass again with version0.46.0-alpha.12.
