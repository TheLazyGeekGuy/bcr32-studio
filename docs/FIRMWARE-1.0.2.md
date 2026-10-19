# Firmware 1.0.2 integration

The **Files → Firmware tools · BCL and Zaquencer** workbench integrates the offline codecs and firmware findings.
It edits files, receives front-panel exports and offers explicit parameter/BCL **reads**. It does not send new
assignment, pattern, global, store or firmware writes. This preserves the hardware rules in CONTRIBUTING.md.

## What is available

- Controller: 82 targets (16 buttons, 32 pushes, 2 footswitches, 32 rotations), eight fields. Select one field and
  press **Read parameter**. A query echo cannot settle a read. Unknown types (including 8) and special/sentinel
  values are displayed raw; they do not overwrite the existing local profile's assignment.
- Sequencer: reads of mode, output port, channel and Alpha/Beta selectors for each of four tracks. Alpha/Beta are
  signed bytes encoded with pack7, not two independent registers. Config's global reads use the 1.x wire IDs.
- BCL: open `.bcl` text or command-20 `.syx`, edit text, save text or a SysEx **file**. Read a preset, global block or
  name, or capture BCL lines emitted by the device. Lines must be ASCII, at most 600 bytes, consecutive from index 0.
  A terminal text-file newline does not create a phantom BCL line. Status and name responses have different shapes.
- Zaquencer: open a complete eight-block `.syx` pattern or receive an export over the selected MIDI input. Four
  tracks × 32 steps; edit notes, velocities, signed tick delays, raw gate codes, Alpha/Beta bytes, voice/chord words,
  rest and step-mask flags. Save an edited `.syx` with updated checksums. Unknown bytes are retained.
- Remote CC: `zaquencer-remote.ts` records all 27 default table entries and exports offline tempo/step-flag preview
  builders. It is **not connected to a live sender**: remote channel/configuration and feedback remain unverified.

The live reads require a **product response from the current MIDI connection** identifying firmware 1.x. A version
imported in a profile does not enable them. Port changes clear pending reads, the live firmware gate and partial
pattern/BCL capture state, and trigger a new product probe. Only a fixed whitelist of read shapes can reach the
workbench's MIDI sender. There is no command scan, retry scan or generic "send hex" action.

Pattern drafts stay in component memory while switching tabs; save a file before reloading or closing the page.
Receiving another export for an already open destination preserves local edits. Deliberately opening a new pattern
file replaces the pattern workspace; export edited files first. Raw sequencer global dumps (kind 3) are not accepted
as patterns. Incomplete, corrupt, duplicated or mixed-destination imports are rejected atomically.

## Changes required for 1.x compatibility

The 1.0.2 dispatcher writes product version bytes at positions **10, 11, 12**, so a reply for 1.0.2 must not display
0.0.2. This still decodes the old 0.56.0 capture. Brightness is **0x52**, sync mode **0x50**, clock output **0x51**.
Legacy profile/UI setting IDs remain unchanged; the reader translates at the wire boundary. Old 0.56 behaviour is
preserved. On 1.x brightness is read-only, including its slider; the new brightness write has no hardware capture.
Command **0x40** now requests a BCL preset (with a slot); **0x41** requests globals and **0x42** a name. This is why
reusing old command numbers or trusting a saved firmware version would be unsafe.

## Evidence and limits

Analysis inputs: ControlTribe 1.11.3 and decrypted BCR32 application 1.0.2. Application SHA-256:
`118219386423549ed497877accc1e18a7f285e9838abe1a3c15f9a344bdfb158`.
No vendor firmware, vendor executable or decompiled vendor source is committed to this repository.

| Evidence | Address | Result |
| --- | --- | --- |
| Main SysEx dispatch | 0x080255AC | Commands, value/reply shapes, BCL requests, product response |
| pack7 / unpack7 | 0x08026814 / 0x0802686C | Mask followed by up to seven low-7-bit bytes |
| BCL parser / receiver | 0x0802783C / 0x08029C20 | Directives, line numbering, 600-byte limit and status |
| Custom-message exporter | 0x0801D1B0 / 0x0801982C | `.minmax`, `.tx`, variable/checksum tokens |
| CC defaults / dispatch | 0x0803277C / 0x0803186C | 27 bindings and their actions/conditions |
| Pattern nibble assembly | 0x080353E0 | Eight ordered 128-byte blocks → 1024 bytes |
| Track serializer | 0x08033C38 / 0x08015892 | Four 256-byte records, 16-byte header + 240-byte body |
| Gate setter / getter | 0x080343AC / 0x08031540 | Packed gate nibbles and bits shared with velocities |

The prior analysis executed these machine routines in an isolated emulator: CC initialization, nine pack/unpack
vectors, eight-block assembly, four-track serialization and 512 gate setter comparisons. The project's port adds
round-trip, corruption, cancellation, echo, signed-selector and preservation tests. **No real BCR32 was connected
for this implementation.** The previous hardware observations still apply to their recorded firmware versions.

### Pattern layout (per track, hex offsets)

| Offset | Meaning |
| --- | --- |
| 00–0F | Track header, preserved verbatim (masks, mute, timing/range codes) |
| 10–2F | 32 notes |
| 30–4F | Velocity in low seven bits; high bits hold gates for steps 24–31 |
| 50–6F | 32 signed timing offsets in ticks |
| 70–7B | Gate codes for steps 0–23; even step in low nibble |
| 7C–9B / 9C–BB | Alpha / Beta per-step raw bytes |
| BC–FB | 32 little-endian words: 16 drum voices or encoded melodic chord intervals |
| FC–FF | Little-endian rest mask (one bit per step) |

For step `s >= 24`, gate bits 0–3 occupy bit 7 of velocity bytes `4*(s-24)+0..3`. Editing one property must preserve
the other. Offsets refer to the serialized pattern, **not** the runtime object or compressed internal flash format.
The UI leaves gate labels, chord intervals and special Alpha/Beta semantics raw where musical meanings are not yet
established. A field's presence does not mean its full enumeration or constraints are validated on hardware.

BCL's type-8 path is evidence for custom-message configuration; the workbench does not pretend the existing
profile type enum represents these messages. The `.tx` vocabulary includes value-bit selectors, relative forms,
`cks-1/2/3`, conditionals and repeat markers. Complete checksum semantics, accumulated message-size limits and
all advanced syntax combinations still need characterization. Stored BCL lines/directives are kept unchanged.

## Machine-readable inventory

- [firmware-1.0.2-command-map.json](firmware-1.0.2-command-map.json): 128 command positions, with attributed,
  partial, response-only and not-found distinctions; CC defaults and `.tx` tokens. "Not found" only refers to this
  application dispatcher, never to the absent bootloader.
- [firmware-1.0.2-parameters.json](firmware-1.0.2-parameters.json): 701 ControlTribe metadata records. `columns`
  defines each positional row; `choice_tables` de-duplicates the original conditional choices. Metadata is evidence,
  not permission to write every field or proof of hardware validation. Firmware replies take precedence over editor
  UI bounds, notably for type 8 and packed selectors.

## Validation before enabling writes

Export backups; verify an unchanged file round trip; change one note, velocity and gate separately and re-export;
verify all shared bits and the on-device result. Repeat for drum, melodic and Alpha/Beta modes. Import an unchanged
BCL preset and then a single custom-message control with captured request/reply data. Validate source/USB port,
channel, pacing, acknowledgement and persistence. Only then add a dedicated, documented device write path.
Bootloader validation, flash/RAM capacity and alternative-firmware flashing are outside this feature.

Run `npm test`, `npm run build`, and `node scripts/leak-gate.mjs --ci`.
The optional browser regression uses a simulated Web MIDI device only:
`PLAYWRIGHT_CORE=/path/to/playwright node scripts/e2e-firmware-workbench.cjs http://127.0.0.1:5173/`.
UI source strings and French are supplied; the six other language columns use English fallback for new strings
until native-speaker review (existing translations are untouched).
