# SysEx Map architecture and integration

## Ownership

```text
.sxm.json + JSON Schema
        |
pure SXM validator / canonical serializer / byte renderer
        |
catalogue adapter + BCL capability adapter
        |
search / preview / import / export UI
        |
existing selected-control local draft
        |
existing explicit host-controlled hardware operations
```

`src/sysex-map/` owns a public, device-neutral TypeScript file contract. It imports no React, browser, storage, BCL, device session or MIDI broker. Another editor can use it in a Node process, worker or browser without initializing this application. Rendering returns byte arrays and performs no transmission.

The human-readable catalogue becomes an SXM document containing all 20 devices and 46 parameters. Its existing `catalog.ts` API remains a compatibility adapter for current consumers/tests; byte generation delegates to SXM. There is one shipped definition source, not separately maintained old/new catalogues.

The UI accepts an imported document per mounted catalogue instance. Validation completes before replacing the displayed catalogue; failed imports preserve the previously active document. Export supports the entire displayed catalogue and the selected device/parameter with only its referenced saved values/sources. Local values and destination fields can travel in the file; no MIDI port or hardware permission does.

The BCL adapter resolves destination fields and translates supported slices/checksum tokens explicitly. Unsupported arithmetic/slices, incompatible effects or constructs produce a visible refusal while the original SXM file remains exportable. Checksum preview support never expands native BCR32 transfer gates. No custom-program/preset schema is changed.

## Compatibility delta

| Surface | Change | Existing consumer behavior |
| --- | --- | --- |
| Public file format | New SXM 1.0 draft and schema | Existing BCL/SYX/JSON controls remain unchanged |
| Catalogue authoring | One SXM starter file | Legacy catalogue API is derived by adapter |
| Local import | Validated, inert per-picker replacement | Absent import keeps shipped 20-model catalogue |
| Saved values | Optional explicit values with origin | Absence remains unknown; no live-state claim |
| Hardware | No change | Host grants, explicit Apply/transfer/STORE retained |

Version 1.0 exact-match decoding is deliberate. Future migrations need fixtures preserving source data; consumers do not silently negotiate semantics. Optional metadata lives in `extensions`; required extensions fail closed when unsupported.

## Delivery proof

The tracked work item records source revision, review trace, tests, bundle evidence and remaining gates. Reference examples and an independent Python renderer establish implementation agreement on the included vectors; real synth reception and third-party editor adoption remain separate validation.

The picker optionally consumes injected storage. A valid import is retained in that editor storage namespace; absent storage keeps the catalogue in view memory. File reads carry a generation and are invalidated on reset, a newer import or disposal, preventing a late read from replacing another selection. This is data persistence, not dynamic code loading.

See [integration instructions](INTEGRATION.md) for independent SDK use and local artifact generation.
