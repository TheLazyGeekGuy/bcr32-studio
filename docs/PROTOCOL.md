# BCR32 SysEx protocol: what is known

This page collects what has been **observed on the wire** between a BCR32 (firmware 0.56.0) and its official editor,
and in the device's own replies. It is written for interoperability. Each item carries a confidence level; please
improve it with captures (see [CONTRIBUTING.md](../CONTRIBUTING.md#protocol-findings)).

| Level | Meaning |
| --- | --- |
| **verified** | read and/or written on hardware, round trip confirmed |
| **observed** | seen in captured traffic, meaning inferred from context |
| **hypothesis** | consistent with the data, not yet tested |

## Envelope

```text
F0 00 20 32 7F 64 <command> <data...> F7
```

- `00 20 32`: Behringer manufacturer ID.
- `7F`: device ID, most likely "any device" as on the BCR2000 (**hypothesis**: the device has a configurable device
  ID 1–255 that has not been tested in the envelope yet).
- `64`: BCR32 product ID (**observed**).

## Commands

| Command | Name | Status | Notes |
| --- | --- | --- | --- |
| `00` | Product / firmware request | **verified** | Request `F0 00 20 32 7F 64 00 F7`. Reply `… 00 01 00 00 00 38 00 F7` is read as firmware 0.56.0 (bytes 4 and 5 of the payload); one sample only. |
| `40` | LED brightness | **verified** | Read and write; used by the app's brightness setting. |
| `74` | Bootloader status | observed | Sent at every sync by the official editor; the device answers `74 00`. Read-only. |
| `0C` | Controller mode / page | observed | Precedes the reads of the controller fields. |
| `07` | Export request | observed | No reply seen from firmware 0.56.0 when sent alone. |
| `04` | Dump | observed | Sub-family byte after `04`: `0C` = controller, `0B` = Zaquencer sequencer. Format below. |
| `17`–`30` | Global settings | **verified (read, write `18`)** | Names: `17` StartOn, `18` ClockRateOut, `1B`/`1C` FootSwitch1/2, `1D` MidiThruDest, `1E` MidiThruSource, `1F` OperatingMode, `20` SyncMode, `21` ClockOutPort, `23` Scale, `24` ScaleBase, `25` TransposeMode, `26` TriggerMode, `27` QuantizationMode, `28` QuantizationMixer, `30` ControllerOutPort. Reads without padding return a value. |
| `29`–`2D` | Track parameters | observed | Track Mode, Port, Channel, Ctrl α, Ctrl β, indexed by track 0–3. |
| `31`–`38` | Controller fields | observed | Eight indexed fields per control (type, channel, parameter, minimum, maximum, mode, option, display: **hypothesis** for the order). |
| `72` | STORE | **forbidden** | Never send. |
| `77` | Bootloader / firmware update | **forbidden** | Never send. |

### Global settings are real reads

Short reads (`F0 00 20 32 7F 64 <cmd> F7`, no padding) return `… <cmd> <value> F7`. On 2026-10-12 the 18 reads the
official editor sends at connection were repeated on the same unit: OperatingMode (`1F`) 2 → 0, LED brightness (`40`)
15 → 7 and ControllerOutPort (`30`) 5 → 4 had changed since 2026-10-09, in line with changes made on the device; the
other values were unchanged. These are reads, not echoes. **Writing** uses `F0 00 20 32 7F 64 <cmd> <value> F7`: the official editor builds every global (the 17 settings `17`–`30`
and `40`) through one code path with this layout. Verified on hardware on 2026-10-13 with Clock rate out (`18`): 3 → 4 → 3,
each write answered by `… 18 <value> F7` and confirmed by an independent read. BCR32 Studio always reads back after a
write. Persistence across a power cycle has not been checked yet.

Meaning of the values: the official editor carries the BCR32 option lists in a fixed order; matched to each setting by
value range, they give for example `1B`/`1C`/`17` = CTRL, ZAQ; `1E` = Off, MIDI in, USB in; `1D` = Off, filtered A, filtered
B, filtered A+B, A, B, A+B; `1F` = USB, standalone, mixed; `30` = Off, A, B, A+B, USB, USB+A, USB+B, USB+A+B; `18` = 1, 2, 4,
24, 48 PPQ; `20` = internal, sync in, MIDI in, USB in. `21` (range 0–8), `23` (0–127) and `28` (0–1) have no list that
matches their range and are shown raw. See `src/device-globals.ts`.

### Indexed reads are echoed, not answered

Indexed reads sent with an extra padding byte (`29 00 00` … `2D 03 00`, `31 30 00` … `38 31 00`) come back
**byte-for-byte identical** from firmware 0.56.0. They are echoes, not values: a grid of "all controls OFF" built
from them is an artefact. Non-indexed global reads (`1F`, `30`, `40`, `74`) do return values. Reading the controller
assignments therefore remains an **open problem**.

### Not BCL

BCR2000-style BCL text lines (`7F 15 20 …` or `7F 64 20 …`) get no BCL acknowledgement: the `20 00` reply seen with
the BCR32 header is simply the SyncMode global (`20`). The BCR32 does **not** speak BCL.

## Dump container (`04 0C`)

The controller dump has the same shape as the Zaquencer dump format documented for the BCR2000: 273 bytes.

```text
offset  0–11   header: F0 00 20 32 7F 64 | 04 | 0C <type?> <page?> <preset?> <block 0–7>
offset 12–267  256 nibbles = 128 data bytes (high nibble first)
offset 268–271 checksum: 16-bit sum of bytes 0–267, as 4 nibbles
offset 272     F7
```

- A full preset would be 8 blocks × 128 bytes = 1024 bytes. Front-panel exports of the "current preset" have only
  produced **block 0** so far.
- The 128 data bytes split into **11-byte records** (**hypothesis**, consistent with captures):
  `[type u8][channel u8][parameter u16 LE][minimum u16 LE][maximum u16 LE][mode u8][option u8][display u8]`.
  Type `02` = CC is observed; the rest of the enumeration (`0` OFF, `1` PC, `2` CC, `3` NRPN, `4` PB, `5` Note,
  `6` AT, `7` GS) is a hypothesis.
- `A5` / `F5 A5` patterns are uninitialised memory.

## Open questions

1. How to read a control's assignment (a read that is not echoed).
2. The order and encoding of the eight controller fields `31`–`38`.
3. Whether the other dump blocks can be requested, and how.
4. Whether `7F` can be replaced by the configured device ID.

Captures from the device's own traffic while editing on the front panel are the most useful contribution.
