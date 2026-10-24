# Zaquencer pattern layout (firmware 1.0.2)

This page restores the pattern layout table first written for the firmware 1.0.2 workbench (commit `83c9006`) and adds
the level of evidence behind each row. The codec is `src/editors/bcontrol/bcr32/zaquencer.ts`; its offline regression
is `scripts/test-zaquencer.mjs`. **No BCR32 sequencer export has been captured yet**: every test pattern is synthetic.

## Evidence levels

| Level | Meaning |
| --- | --- |
| static analysis | Read from the 1.0.2 application during the prior analysis (pattern nibble assembly, track serializer, gate setter and getter). See [FIRMWARE-1.0.2.md](FIRMWARE-1.0.2.md). |
| emulator | The firmware routine was executed in an isolated emulator during the prior analysis (eight-block assembly, four-track serialization, 512 gate setter comparisons). |
| unit-tested here | `scripts/test-zaquencer.mjs` checks that **the codec** follows the row. It proves the code matches the table, not that the table matches the device. |
| hardware-observed | Seen in a capture from a real BCR32 running 1.0.2. **None yet.** |

## Container: `04 0B` frames

| Bytes | Meaning | Evidence |
| --- | --- | --- |
| 0–11 | `F0 00 20 32 <device> 64 04 0B <kind 0–3> <bank> <page 0–15> <block>` | static analysis; unit-tested here |
| 12–267 | 256 nibbles, high nibble first = 128 data bytes | static analysis; emulator; unit-tested here |
| 268–271 | 16-bit sum of bytes 0–267, as four nibbles, most significant first | container documented for `04 0C` in [PROTOCOL.md](PROTOCOL.md); unit-tested here |
| 272 | `F7` | unit-tested here |
| — | Kinds 0–2: blocks 0–7, assembled in order into 1024 bytes. Kind 3: blocks 0–1, raw sequencer data, never a pattern | static analysis; emulator (assembly); unit-tested here |

The same 273-byte shape (`04 0C`) was observed on hardware for controller dumps on firmware 0.56.0 (see
[PROTOCOL.md](PROTOCOL.md)); that is not an observation of a `04 0B` pattern.

## Pattern layout (per track, hex offsets)

A pattern is four 256-byte track records (track *n* starts at *n* × 0x100): a 16-byte header and a 240-byte body
(static analysis; emulator for the four-track serialization). Offsets refer to the serialized pattern, **not** the runtime
object or the compressed internal flash format.

| Offset | Meaning | Evidence |
| --- | --- | --- |
| 00–0F | Track header, preserved verbatim (masks, mute, timing/range codes) | static analysis; unit-tested here (untouched by every non-mask edit) |
| 00–03 | Within the header: little-endian step mask, one bit per step (location taken from the code; the 83c9006 table only says "masks") | static analysis; unit-tested here |
| 10–2F | 32 notes | static analysis; unit-tested here |
| 30–4F | Velocity in low seven bits; high bits hold gates for steps 24–31 | static analysis; emulator (gate setter); unit-tested here |
| 50–6F | 32 signed timing offsets in ticks (two's complement) | static analysis; unit-tested here |
| 70–7B | Gate codes for steps 0–23; even step in low nibble | static analysis; emulator (gate setter/getter); unit-tested here |
| 7C–9B / 9C–BB | Alpha / Beta per-step raw bytes | static analysis; unit-tested here |
| BC–FB | 32 little-endian words: 16 drum voices or encoded melodic chord intervals | static analysis; unit-tested here |
| FC–FF | Little-endian rest mask (one bit per step) | static analysis; unit-tested here |

For step `s >= 24`, gate bits 0–3 occupy bit 7 of velocity bytes `4*(s-24)+0..3`. Editing one property must preserve
the other: the test patches every field of every step and checks that no other bit of the 1024 bytes changes, then runs
2048 gate edits that must keep all velocities.

## Public reference: the Zaquencer author's preset map

The author of the Zaquencer firmware published a preset map on the ZAQ Audio forum on 2026-05-22
(<https://zaqaudio.com/files/Zaquencer_Preset_Map.txt>, read 2026-10-24). It describes the **original Zaquencer** (BCR2000);
it does not name the BCR32. Its per-track layout matches the table above offset for offset and names the fields:

| Offset | Name in the preset map | Codec field | Reading used by the sequencer view |
| --- | --- | --- | --- |
| 00–03 | skipStep (32 flags) | `mask` | step skipped |
| 04 | trackMute (1 bit) | header | track muted |
| 05 | dir (2 bits) | header | direction code (values not documented) |
| 06 / 07 / 08 | sequenceStart / sequenceLength / sequenceOffset (5 bits) | header | shown read-only |
| 09 | selectedClockDivider (4 bits) | header | clock divider code |
| 0A / 0B | shuffleEvenTicks / shuffleOddTicks | header | shown read-only |
| 0C–0D | drumMutes (16 flags) | header | muted drum voices |
| 10–2F | noteVal | `note` | note |
| 30–4F | noteVelocity (bit 7 reused for note length of steps 24–31) | `velocity` | velocity |
| 50–6F | noteStartTimeOffset (signed, unit not stated) | `delay` | start offset |
| 70–7B + velocity bit 7 | noteLength (4 bits per step) | `gate` | note length 0–15 (unit not stated) |
| 7C–9B / 9C–BB | CCVal for the track's CC 1 / CC 2 (signed, −1 = off) | `alpha` / `beta` | CC values, −1 stored as `FF` |
| BC–FB | notePolyphony (16 bits per step) | `voices` | polyphony word (drums or chord) |
| FC–FF | noteMute (32 flags) | `rest` | step muted |

The map also lists per-track output (MIDI A/B), channel, CC numbers, drum/chord mode and drum note mapping, and the
global clock, scale, transpose, trigger and quantization fields of the preset's global area.

**Consequence for the editor:** bytes 00–03 are read as *skip* flags and FC–FF as *mute* flags. A step plays when it is
neither skipped nor muted and its velocity is above 0. Earlier versions of this page called 00–03 a "step mask"; which
reading is right on a BCR32 will be settled by the first real export (validation plan, step 1).

## What stays unknown

- **Gate**: the codes are raw 0–15 values. Their musical meaning (lengths, ties, special codes) is not established.
- **Chords**: how a melodic word in BC–FB encodes intervals, and how the firmware chooses between the drum-voice and
  chord readings of the same word.
- **Alpha / Beta**: the per-step bytes are raw. Their meaning depends on the track's Alpha/Beta selectors (commands
  `2C`/`2D`, signed and pack7-encoded), which are not characterized.
- **Scale list (`23`)**: range 0–127 in the editor; no option list in the official editor matches it, so values stay raw.
- **Track header 00–0F**: apart from the step mask in 00–03 (from the code), the positions of mute, timing and range
  codes are not located. The header is kept byte for byte.
- Also open: the meaning of kinds 0–2 and of the bank/page bytes, the content of kind 3, and whether the firmware ever
  writes delay `-128` (the codec reads it but only accepts −127…127 when editing).

## Validation plan

Nothing below is enabled yet. Each step must pass before the next one starts.

1. **Passive capture.** Start a front-panel pattern export on the BCR32 and record what arrives on the input port.
   Zero bytes are sent to the device: not even an export request (`07`).
2. **Repeat the export.** A second front-panel export of the same, unchanged pattern must be byte-identical to the
   first. Any difference means the format holds volatile data, and the plan stops until it is explained.
3. **Read-only view.** Show the captured pattern in the editor without any send path; compare displayed notes,
   velocities, rests and gates with what the device shows. Mark which table rows became hardware-observed.
4. **Writes, only later**, behind a dedicated, documented write path and only once 1–3 hold:
   1. back up every pattern by passive export first;
   2. use one sacrificial slot only;
   3. after each write, export again and compare with the expected file byte for byte;
   4. power-cycle the device and export again to check persistence;
   5. restore the original pattern from the backup and verify it the same way.

**Excluded from every step**: SysEx `72` (STORE, forbidden), `77` (bootloader / firmware update transition), `14`
(controller preset erase, destructive), `16` (forces the transport state to zero) and `0B` (switches to the Zaquencer
page). Every entry in [firmware-1.0.2-command-map.json](firmware-1.0.2-command-map.json) is `hardware_validated: false`.

## Notes on the code

- The code comment on kind 3 says it is "preserved as raw messages". The codec does round-trip a kind 3 frame, but
  neither the assembler nor the workbench stores it: a live kind 3 frame is ignored, and a file containing one is
  rejected as "Not a pattern export".
- The assembler accepts a second block 0 as a restart of the same destination. Rejecting duplicated or incomplete
  **file** imports is done by the workbench's import routine (block count check), which is not covered by this test.
