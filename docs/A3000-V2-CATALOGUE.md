# Yamaha A3000 V2 catalogue integration

## Delivered scope

Version0.46.0-alpha.16 adds **103 scalar definitions:30 Program and73 Sample** to the existing shared SXM catalogue. This is a catalogue integration, not a new front-panel editor, sampler librarian or sample uploader. Select **Yamaha A3000 V2** in the catalogue, choose a parameter and configure its device number and optional zero-based address index.

The intended Program or Sample must already be selected on the instrument. The catalogue displays that context beside the definition. Selecting a catalogue entry does not select an A3000 object, read its current value, transmit MIDI or save anything. A preview is calculated, not observed hardware state. A supported definition can be loaded into the existing encoder rotation or push draft; existing hardware-transfer rules still apply.

## Wire format

Object edit, owner's manual printed356 / PDF358, section5.3.2:

```text
F0 43 (10 + device-number-zero-based) 58 01 P1 P2 P3 P4 P5 P6 data-nibbles F7
```

The UI device number is1–16; the corresponding wire byte is10–1F hexadecimal. The six address bytes are parameter numbers, not bulk offsets. Unused address positions are emitted as zero. The command carries no checksum. Each value byte becomes its high nibble followed by its low nibble; signed8-bit values use two's complement before splitting. The unsigned16-bit Sample Tempo uses four nibbles and its documented8000–15999 range.

Examples, calculated in software:

| Context / parameter | Value | Frame |
| --- | ---: | --- |
| Sample / Filter cutoff |64| `F0 43 10 58 01 02 16 00 00 00 00 04 00 F7` |
| Program / LFO tempo |250| `F0 43 10 58 01 01 0E 00 00 00 00 0F 0A F7` |
| Sample / Coarse tune |-1| `F0 43 10 58 01 02 09 00 00 00 00 0F 0F F7` |

The signed example is renderable/exportable as SXM. The existing native BCL adapter refuses signed logical ranges; this integration does not relax it. Supported unsigned definitions use existing BCL value slices. Neither a successful conversion nor read-back of BCL establishes execution on an A3000 or BCR32.

## Version2 changes and exclusions

Apply the V2 overlay to the original table. In particular Program P2=11/12/16 are now LFO cycle/sync/wave, replacing the earlier fine-tune/coarse-tune/portamento meanings. Added definitions include LFO tempo/initial phase, per-channel normal/toggle, effect output/width and filter distance. Updated limits include filter type0–16, key-range-high0–128, velocity sensitivity and control-matrix ranges. Indices such as effects, controller slots, envelope stages and L/R select explicit P3 fields instead of creating hundreds of duplicate definitions.

The following are deliberately unavailable as scalar assignments:

- Sample key-range-low V2 sentinel: the V2 parameter-change table prints P2=10 for both high and low, conflicting with V1's P2=11. The catalogue omits the low write rather than silently choosing an address.
- LFO reset channel/note: negative sentinels are marked UC in the change table despite signed declarations in the bulk table. Their exact parameter-change encoding remains unqualified.
- Effect type/algorithm values: V2 expands the inventory, while the selected replacement table does not supply a universal new effect-type bound or effect-parameter domain.
- Names, object selection/linking, Easy Edit member offsets, system/global settings, structural sample counts/links, wave addresses/lengths, switch remote, bulk data and durable storage.

The manual documents object selection (`...58 00`,16-byte name and object type), object parameter request (`F0 43 3n 58 01 P1…P6 F7`) and V2 object-link request/change. These are useful for a future A3000 module with an explicit object/session model. They are documented here, not automatically executed or represented as an implemented librarian.

## Sources and evidence

| Source | Pages | SHA-256 / bytes |
| --- | --- | --- |
| [Owner's Manual](https://usa.yamaha.com/files/download/other_assets/3/328693/A3000E.PDF) | printed356–360 / PDF358–362; scalar tables printed359–360 | `00153408e64428d22bac2702880449687723cf1450d1a484f6070b765a883f37` /2717606 |
| [Upgrade Guide for Version2](https://usa.yamaha.com/files/download/other_assets/9/328709/A3000V2E.pdf) | printed/PDF43–47; replacement parameter tables46–47 | `d43de4abf0e4de88007e8e18ecad1b21ca0e2491b254a7f28bd7f8becc949ff0` /410238 |

Retrieved2026-10-30. Original PDF bytes and extracted/cropped text are ignored research inputs; the normalized table, URLs and digests are versioned. The relevant object-edit and base table PDF pages were rendered and visually checked. The A3000 sampler is unrelated to PSR-A3000 and RX-A3000; those manuals were not used.

Implementation: `src/sysex-catalog/tables/a3000v2.json`, offline compiler `scripts/build-sysex-catalog.mjs`, existing SXM renderer/BCL adapter/catalogue UI. No new transport or sender. Generated catalogue remains below the existing2MiB budget.

Validation: `scripts/test-a3000v2-catalog.mjs` compares every definition at three values against an independent nibble algorithm, checks V2 overrides and omitted addresses, compares four cases with the Python reference renderer and exercises SXM roundtrip. The catalogue browser scenario checks103 entries, context visibility, cutoff preview and signed-native refusal. Hardware execution, automatic object retrieval and durable writes are **not validated**.

## Review provenance

Read/implementation started2026-10-30 10:44 CET. Baseline BCR32 Studio commit `1726b6217e958e8026bbe65a51e658c9a3e31b5f`, branch `work/sysex-bcl-inspector`, initially clean. Read scope: catalogue compiler/tables/UI, SXM types/renderer/BCL adapter, tests and the two external PDFs above. Delivery changes were initially uncommitted. Reader: Codex primary agent; exact model identifier and reasoning effort are not exposed, so that part of review provenance is incomplete. No physical MIDI operation was performed.
