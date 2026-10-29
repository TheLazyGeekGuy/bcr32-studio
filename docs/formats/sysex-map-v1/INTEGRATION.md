# Implement SXM in another editor

This is a message-definition format, not a replacement for an editor's preset/state envelope. MIDI Studio's `PatchEnvelope` still describes patch/raw data; editor preset exchange still carries a module-specific state. SXM can be imported independently or embedded under that module's own explicit contract. Neither SDK nor file format owns ports, leases, permissions, timing, UI state or physical controller selectors.

## TypeScript / browser / Node

Sources: `src/sysex-map/index.ts`, `types.ts`, `schema.json`. They have no runtime dependencies beyond standard JavaScript APIs. Copy/build this directory or use the local reference artifact:

```sh
npm ci
npm run build:sysex-map-sdk
```

The output is `output/sysex-map-sdk/`: a standalone ES module, TypeScript declarations, JSON Schema and specification. It is a private local package, not an npm publication. Another local application may install that folder or import `index.mjs` directly. Building it uses this repository's esbuild/TypeScript dev tools; using the resulting artifact does not require React, MIDI Studio or any device module.

```typescript
import {parseMap, resolveParameter, renderParameter, serializeMap, subsetMap} from 'sysex-map-reference'

const map = parseMap(fileText) // Fully validated before activation; immutable detached document.
const {parameter} = resolveParameter(map, 'tx81z', 'algorithm')
const frames = renderParameter(parameter, 3, {channel: 8})
// frames === [[0xF0, 0x43, 0x17, 0x12, 0x34, 0x03, 0xF7]]
const portableText = serializeMap(subsetMap(map, 'tx81z', 'algorithm'))
// Rendering and exporting do not send anything.
// Your existing transport must separately authorize and schedule any real transmission.
```

`decodeMap(bytes)` performs strict UTF-8 decoding (invalid bytes are refused rather than replaced). Use it with a file array buffer. `validateMap(unknown)` accepts a plain in-memory JSON object. `parseMap(text)` additionally checks byte budget, duplicate JSON keys and nesting before activation. `serializeMap` retains extensions and explicit values. `withMapValue` returns a new immutable document; it does not update the old one. Treat documents as validated before calling `renderParameter` directly.

Import atomically: validate a candidate completely, then replace the active document. If validation fails, keep the previous catalogue and the original file. Unsupported BCL conversion is a separate capability failure, not an invalid SXM file. Preserve it for export and present the reason rather than inventing a mapping.

## Python / other languages

The stdlib-only [reference renderer](reference-renderer.py) is independent of the TypeScript encoder:

```sh
python3 docs/formats/sysex-map-v1/reference-renderer.py \
  docs/formats/sysex-map-v1/tx81z.sxm.json \
  --device tx81z --parameter algorithm --value 3 --field channel=8

python3 docs/formats/sysex-map-v1/reference-renderer.py \
  --vectors docs/formats/sysex-map-v1/vectors.json
```

It proves encoding behavior on the examples and vectors; it is not a full schema/semantic validator. A production port must implement the entire validation contract or combine JSON Schema validation with the documented cross-field checks. Important: Python negative modulo is already nonnegative; JavaScript needs explicit modulo normalization for signed slices.

## Host responsibilities

- Keep the file definition separate from current observed hardware state. Do not populate missing values from defaults and call them observed.
- Resolve the destination device, correct mode/firmware and actual MIDI ports outside the file.
- Present effect/evidence metadata; import does not establish truth or authorize persistent writes.
- Keep session state, imported files, query correlation and pending messages per instance. Dispose asynchronous imports when a view/session closes.
- Preserve existing device-specific pacing, ACK/readback, backup, cancellation and STORE policies.
- An SXM import is not a BCR32 encoder assignment. The BCL adapter explicitly resolves supported definitions for the selected rotation/push and leaves Apply/transfer separate.

## Files to exchange

- [TX81Z example with a preset value](tx81z.sxm.json)
- [Microwave example with additive checksum](microwave.sxm.json)
- [FS1R example with two value bytes](fs1r.sxm.json)
- [Synthetic signed/14-bit/nibble/checksum/multi-message examples](encoding-demo.sxm.json)
- [Expected-byte vectors](vectors.json)
- [JSON Schema](../../../src/sysex-map/schema.json)

SXM 1.0 is an open proposal implemented here. The reference tests do not establish adoption by third-party software or official MIDI standardization.
