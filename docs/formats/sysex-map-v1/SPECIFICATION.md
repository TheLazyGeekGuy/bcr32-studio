# SysEx Map (SXM) 1.0 — interchange format

Status: **open draft / reference implementation**, 2026-10-29. This project proposes a portable file contract; it is not an adopted MIDI Association standard. MIDI's existing [Universal System Exclusive messages](https://midi.org/midi-1-0-universal-system-exclusive-messages) are a different wire-level concept.

## 1. Scope

An SXM file is a matrix of named device parameters, bounded values and declarative MIDI 1.0 SysEx messages. It can be exchanged between editors independently of BCL, a controller assignment, a UI panel, a MIDI port or an operating system. A consumer can list parameters, preview messages, preserve values, and optionally adapt supported definitions to its own editor. Importing or rendering a file never authorizes transmission.

Extension: **`.sxm.json`**. Encoding: UTF-8 JSON, media type `application/json`. No compression, executable expressions, scripts, external file references or automatic URL fetching are part of version 1.0. The JSON Schema uses [Draft 2020-12](https://json-schema.org/draft/2020-12).

## 2. Document

Required root fields:

| Field | Meaning |
| --- | --- |
| `format` | Literal `SysEx Map` |
| `version` | Literal `1.0`; an unsupported version must be rejected before activation |
| `id`, `name` | Stable file ID and human-readable title |
| `devices` | Array of device definitions |
| `sources` | Map of source IDs to provenance records; it may be empty for unverified definitions |

Optional fields: `description`, `values`, `extensions`, `requiredExtensions`.

Identifiers use ASCII letters, digits, dots, underscores and hyphens, 1–128 characters. IDs are unique in their scope; display names need not be unique. A device ID plus parameter ID is the stable parameter key. Array order is display order and message order, never implicit MIDI routing.

`extensions` is a JSON object reserved for optional, preferably namespaced metadata. Readers preserve it on round trips. Unknown keys elsewhere are rejected to avoid silent semantic loss. `requiredExtensions` lists mandatory extension names; this reference implementation supports none and rejects a nonempty list. No consumer may silently discard a required extension. Version negotiation must be explicit; no implicit 1.x migration is promised.

## 3. Device and parameter matrix

A device contains `id`, `manufacturer`, `name`, `notes`, `documentation` (`sources` IDs and `section`) and `parameters`.

A parameter contains:

| Field | Meaning |
| --- | --- |
| `id`, `name` | Stable key and display label |
| `value` | `minimum`, `maximum`, optional `default`, `unit` and numeric-string `labels` |
| `fields` | Named destination fields with `name`, `minimum`, `maximum`, `default` |
| `messages` | Ordered array of `{bytes: [...]}` templates |
| `effect` | `edit-buffer`, `request`, `global-change`, `persistent-write`, `reset` or `firmware` |
| `evidence` | `manufacturer-documented`, `local-observation` or `unverified` |

Parameter values are integers from −16384 to 16383. A default is a preset suggestion, **not** an observed hardware value. Destination fields are integers from −16384 to 16383, independently bounded by each field definition. Their semantic labels distinguish a MIDI channel, a device number, a part or a scene; software must not assume they are interchangeable.

An effect describes a possible operation, not a permission or a trust certificate. Definitions can describe persistent or destructive operations for interchange, but the BCL catalogue adapter refuses to load those effects. A generic renderer can produce a local preview for any known effect; a host must separately decide which operations it implements and authorizes. Evidence is an author's declaration supported by source references, not proof obtained by importing a file.

## 4. Message tokens

Each element produces exactly one byte. Constants are JSON integers: the first is 240 (`F0`), the last 247 (`F7`), all interior constants are 0–127. No embedded status bytes or concatenated frames are allowed. Use separate `messages` for multiple frames.

| Token | Result |
| --- | --- |
| Integer | Literal byte |
| `{ "field": "channel", "add": 15 }` | Field value plus signed offset; result must be 0–127 |
| `{ "value": { "shift": 0, "bits": 7, "add": 0 } }` | Value slice using the formula below |
| `{ "checksum": { "algorithm": "sum7", "from": 5, "to": 8 } }` | Checksum over the specified preceding bytes |

For a value token, let `x = parameterValue + add`. Output is `floor(x / 2^shift) modulo 2^bits`, using a **nonnegative** modulo. `shift` is 0–20, `bits` is 1–7, `add` is −16384..16383. Defaults are not implicit: all three members must be written. This explicitly represents 7-bit slices, 14-bit little/big endian, nibble order, offset-binary and signed two's-complement slicing without a programming language. Field `add` is also explicit.

Checksum indexes are zero-based, inclusive, and count **rendered bytes**, including `F0` at index 0. Both ends must refer to earlier bytes in the same message: `0 <= from <= to < checksumIndex`. Forward references, circular ranges and implicitly included checksum/EOX bytes are invalid. Earlier checksums can be included when the range explicitly covers them.

Algorithms:

- `sum7`: sum of covered bytes modulo 128.
- `complement7`: negative sum modulo 128 (Roland/Yamaha-style complement where specified by that device).
- `xor7`: XOR of covered bytes, masked to 7 bits.

No manufacturer checksum is chosen automatically. Device documents define the range and algorithm. Other checksum families, packed blocks, arbitrary lookup functions and MIDI 2.0 UMP require a future extension/version; preserve the original file and reject unsupported definitions.

## 5. Optional values

`values` is an array of `{device, parameter, value, fields, origin}`. `origin` is `user`, `preset` or `observed`. Every referenced device/parameter/field must exist and each number must satisfy its definition. Duplicate device/parameter entries are invalid. An observed value is supplied by the producer, not revalidated by an importing consumer. Missing values remain unknown; defaults are never substituted into the values array on import. Ports, controller IDs and BCR32 encoder/push assignments do not belong here.

## 6. Source records

Each `sources` entry has `title`, `url`, `sha256`, `retrieved`; optional `bytes`, `retrieval`. `sha256` is a lower-case 64-digit hex string or null when original bytes were unavailable. URLs are documentation metadata, not imports. `documentation.sources` references existing source keys. A manufacturer-documented parameter needs at least one device source; local observations and unverified drafts can declare no sources. Consumer validation does not certify the source's accuracy.

## 7. Conformance and limits

A reader must validate structure **and** semantic references before replacing a live document. The schema covers structural rules; the reference decoder also checks unique IDs, ranges/defaults/labels, referenced fields/sources/values, complete SysEx framing, checksum positions and destination extrema.

Reference limits: 2 MiB UTF-8 input, JSON nesting depth 32, 256 devices, 8192 parameters total, 32 fields per parameter, 16 messages per parameter, 1024 bytes/tokens per message, 4096 sources, 8192 saved values. Known-field strings are bounded by the schema; the total byte/depth budget also bounds optional extension data. More devices are supported by multiple files; limits are not MIDI transport timing guarantees. Inputs exceeding limits fail before activation. Object prototype-control keys are rejected at every level.

The reference serializer emits canonical JSON: object keys sorted lexically by UTF-16 code units (without Unicode normalization), arrays in original order, two-space indentation and one trailing newline. Canonical JSON is defined here for deterministic exchange, not cryptographic signing or equivalence to RFC 8785. UTF-8 input accepts a leading BOM; invalid UTF-8 bytes must be refused rather than replaced by replacement characters. A byte-identical round trip is not promised; data and optional extensions are retained. Invalid JSON, duplicate object keys, nonfinite numbers and unsupported required features must be rejected.

## 8. Minimal example

```json
{
  "format": "SysEx Map",
  "version": "1.0",
  "id": "example-tx81z",
  "name": "TX81Z algorithm",
  "sources": {},
  "devices": [{
    "id": "tx81z",
    "manufacturer": "Yamaha",
    "name": "TX81Z",
    "notes": "Enable exclusive reception; match Basic Receive Channel.",
    "documentation": {"sources": [], "section": "Example; attach manufacturer provenance before distributing as documented"},
    "parameters": [{
      "id": "algorithm",
      "name": "Algorithm",
      "value": {"minimum": 0, "maximum": 7},
      "fields": {"channel": {"name": "MIDI channel", "minimum": 1, "maximum": 16, "default": 1}},
      "effect": "edit-buffer",
      "evidence": "unverified",
      "messages": [{"bytes": [240,67,{"field":"channel","add":15},18,52,{"value":{"shift":0,"bits":7,"add":0}},247]}]
    }]
  }]
}
```

Value 3, channel 8 renders `F0 43 17 12 34 03 F7`. This example is included as a syntax demonstration; the bundled catalogue carries the actual primary-source ledger.

## 9. Implementer acceptance

1. Validate a document without any MIDI/UI/OS service.
2. Render the golden vectors using an independent implementation.
3. Reject malformed framing, byte/field bounds, unknown tokens/versions, forward checksums, duplicate IDs/keys and missing references.
4. Round-trip optional extensions and saved values; preserve unknown hardware state as absent.
5. Import with no sends, assignments, STORE or external fetches.
6. A device-specific adapter must report unsupported operations/tokens; it must not rewrite them as OFF or pretend they executed on hardware.

The [schema](../../../src/sysex-map/schema.json), [golden vectors](vectors.json), Python reference and [integration guide](INTEGRATION.md) accompany this specification. Adoption by another product remains an external integration test, not a claim established by these reference tests.
