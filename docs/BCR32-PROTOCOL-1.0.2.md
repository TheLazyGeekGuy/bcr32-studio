# BCR32 SysEx protocol, firmware 1.0.2

One reference for everything BCR32 Studio uses or knows about the BCR32 device protocol on firmware 1.0.2. Older
firmware (0.56.0) is mentioned only where it differs. Historical notes remain in [PROTOCOL.md](PROTOCOL.md) and
[FIRMWARE-1.0.2.md](FIRMWARE-1.0.2.md); value ranges per parameter are listed in
[firmware-1.0.2-parameters.json](firmware-1.0.2-parameters.json) and all 128 command positions in
[firmware-1.0.2-command-map.json](firmware-1.0.2-command-map.json).

| Status | Meaning |
| --- | --- |
| **Hardware-verified** | A comment, test or document in this repository records a check on a real BCR32; the Source column names it. |
| **Implemented, not yet verified on hardware** | The editor implements or catalogues it; no check on a real BCR32 is recorded. |

Source paths are relative to the repository root; `bcr32/` stands for `src/editors/bcontrol/bcr32/`.

## 1. Framing

| Item | Fact | Status | Source |
| --- | --- | --- | --- |
| Envelope | `F0 00 20 32 <dev> 64 <cmd> <data…> F7`; `00 20 32` manufacturer ID, `64` BCR32 product ID; every data byte is 7-bit. | Implemented, not yet verified on hardware | `bcr32/firmware-codec.ts` `midiFrame`, `isFrame` |
| Device byte in requests | Reads are sent with `7F` (any device). | Implemented, not yet verified on hardware | `bcr32/firmware-codec.ts` `isFirmwareRead`; `bcr32/host-policy.ts` `validateQuery` |
| Device byte in replies | The BCR32 answers with its configured device ID, not `7F`; `00` on the tested unit. | Hardware-verified | `bcr32/web-midi.ts` `parseFirmwareReply` (comment "00 observed on 1.0.2"); `README.md` "Evidence and limits" (firmware 1.0.2/device 00) |
| Device byte in writes | Assignment writes and BCL lines carry the addressed device ID (0–126), never `7F`. | Implemented, not yet verified on hardware | `bcr32/controller-write-plan.ts`; `bcr32/preset-store.ts` `isBclWrite` |
| pack7 | 8-bit data travels in groups of up to 7 bytes: one mask byte (bit *i* = bit 7 of byte *i*), then each byte's low 7 bits. A 16-bit value is sent as two bytes (MSB, LSB), so 3 wire bytes. | Implemented, not yet verified on hardware | `bcr32/firmware-codec.ts` `pack7`, `unpack7` |
| Empty reply | For some unused fields the BCR32 returns the request unchanged except for its own device byte: an addressed, payload-free reply. It carries no value. | Hardware-verified | `bcr32/firmware-codec.ts` `createParameterReader` (comment "Physical 1.0.2 sends addressed, payload-free replies"); 9-byte replies in `scripts/fixtures/controller-pushes-102.json` |
| Realtime bytes | MIDI realtime bytes (`F8`–`FF`) may appear inside a SysEx stream and are ignored when splitting `.syx` files. | Implemented, not yet verified on hardware | `bcr32/firmware-codec.ts` `splitSysex` |

## 2. Identification and ports

| Item | Fact | Status | Source |
| --- | --- | --- | --- |
| Product query (`00`) | `F0 00 20 32 7F 64 00 F7`. | Implemented, not yet verified on hardware | `bcr32/web-midi.ts` `productQuery` |
| Product reply | 14 bytes: `F0 00 20 32 <dev> 64 00 01 xx xx <major> <minor> <patch> F7`. Byte 7 is `01`; the version is in bytes 10–12; bytes 8–9 are not the major version. | Implemented, not yet verified on hardware | `bcr32/web-midi.ts` `parseFirmwareReply` |
| Same layout, firmware 0.56.0 | `… 64 00 01 00 00 00 38 00 F7` decodes as 0.56.0. | Hardware-verified | `docs/PROTOCOL.md` command `00` (verified, firmware 0.56.0); `scripts/test-firmware-reply.mjs` |
| Firmware gate | Indexed reads, BCL reads and every write need a product reply from the current connection identifying firmware 1.x. A version stored in a profile does not count. | Implemented, not yet verified on hardware | `bcr32/firmware-codec.ts` `firmwareOne`; `bcr32/FirmwareTools.tsx`; `docs/controllers/BCR32-STUDIO-INTEGRATION.md` |
| USB MIDI ports | Port names contain `BCR32` / `BCR-32`. Firmware 1.0.2 exposes a CTRL and a ZAQ endpoint; controller operations use CTRL only. | Implemented, not yet verified on hardware | `bcr32/auto-midi.ts` `isControllerPort` |
| Port pair on macOS | The tested unit exposes one CoreMIDI port pair. | Hardware-verified | `docs/FIRMWARE-1.0.2.md` (opening paragraph) |
| SysEx path | SysEx travels over USB only; the USB endpoint reports nothing about DIN traffic. | Implemented, not yet verified on hardware | `bcr32/controller-indicators.ts` `activityPorts` |

## 3. Command summary (firmware 1.0.2)

Commands the editor sends or decodes. Request and reply lengths include `F0` and `F7`.

| Cmd | Function | Request | Reply | Status | Source |
| --- | --- | --- | --- | --- | --- |
| `00` | Product / version | 8 bytes | 14 bytes, see §2 | Implemented, not yet verified on hardware | `bcr32/web-midi.ts` |
| `04 0B` | Sequencer (Zaquencer) block | — (file and receive only) | 273-byte block, see §9 | Implemented, not yet verified on hardware | `bcr32/zaquencer.ts` |
| `0C` | Switch to the controller page | 8 bytes, no immediate reply | — | Implemented, not yet verified on hardware | `bcr32/controller-presets.ts` `createPresetReader` |
| `17`–`30` | Global settings (read) | 8 bytes | 9 bytes, see §4 | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` |
| `20` | BCL line (both directions) | `20 <hi> <lo> <ASCII…>` | `21` status | Hardware-verified | `bcr32/controller-tracks.ts` (comment "four ACK=0"); `bcr32/preset-store.ts` (comment dated 2026-10-19) |
| `21` | BCL line status (reply only) | — | 11 bytes, see §7 | Hardware-verified | as `20` above |
| `21` | Preset name (reply only) | — | 34 bytes, see §7 | Implemented, not yet verified on hardware | `bcr32/bcl.ts` `bclResponse` |
| `29`–`2D` | Sequencer track parameters | 9 bytes | 10 or 11 bytes, see §9 | Implemented, not yet verified on hardware | `bcr32/firmware-codec.ts` `trackQuery`, `trackReply` |
| `31`–`38` | Controller assignment fields | 9 bytes (read) | 10 or 12 bytes, see §6 | Hardware-verified | `scripts/fixtures/controller-pushes-102.json` ("Physical read-only captures, 2026-10-19") |
| `40` | Request a preset as BCL | `40 <slot 0–3F>` or `40 7F` (working) | `20` lines to `$end` | Hardware-verified | `bcr32/preset-store.ts` (comment dated 2026-10-19) |
| `40 7E` | Request all presets as BCL | 9 bytes | `20` lines | Implemented, not yet verified on hardware | `bcr32/controller-presets.ts` `presetReadQuery` |
| `41` | Request the global block as BCL | 8 bytes | `20` lines to `$end` | Hardware-verified | `bcr32/controller-tracks.ts` (comment "independent global read-back") |
| `42` | Request preset names | `42 <slot 0–3F / 7E all>` | `21` name replies | Implemented, not yet verified on hardware | `bcr32/controller-presets.ts` `presetReadQuery` |
| `50` | Sync mode (was `20`) | 8 bytes | 9 bytes | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `wireGlobalCommand` |
| `51` | Clock output port (was `21`) | 8 bytes | 9 bytes | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `wireGlobalCommand` |
| `52` | LED brightness (was `40`) | 8 bytes | 9 bytes | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `wireGlobalCommand`; `bcr32/led-brightness.ts` |
| `74` | Bootloader status | 8 bytes | 9 bytes, value `00` | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` |

The full whitelist of reads the editor may send: `31`–`38` with index < 82; `29`–`2D` with track < 4; `40` with slot
< 64, `7E` or `7F`; `42` with slot < 64 or `7E`; `41`; and the 8-byte reads `00`, `0C`, `50`, `51`, `52` and the
global commands of §4 (`bcr32/firmware-codec.ts` `isFirmwareRead`, `bcr32/host-policy.ts` `validateQuery`).

## 4. Global settings

Read: `F0 00 20 32 7F 64 <cmd> F7`. The BCR32 answers `F0 00 20 32 <dev> 64 <cmd> <value> F7` (9 bytes). An 8-byte
answer with the same command is an echo and carries no value. One request at a time, 400 ms timeout. The 18 reads run
in the order below.

On firmware 1.x three settings use other command numbers on the wire: `20` → `50`, `21` → `51`, `40` → `52`. On 1.x the
old numbers mean something else (`20` BCL line, `21` BCL reply, `40` preset request) and must never be sent as globals.

| # | Cmd (1.x wire) | Setting | Range | Values | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `74` | Bootloader status | — | read-only, answers `00` | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `deviceGlobals` |
| 2 | `1B` | Footswitch 1 | 0–1 | CTRL (programmable), ZAQ (start/stop) | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `deviceGlobals` |
| 3 | `1C` | Footswitch 2 | 0–1 | CTRL (programmable), ZAQ (next pattern) | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `deviceGlobals` |
| 4 | `1E` | MIDI thru source | 0–2 | Off, MIDI in, USB in | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `deviceGlobals` |
| 5 | `1D` | MIDI thru destination | 0–15 | 1.x: 0 Off; 1–3 MIDI A / B / A & B filtered; 9–11 MIDI A / B / A & B unfiltered; other values raw. 0.56.0: unfiltered at 4–6. | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `globalChoices`, `settingsFromDevice` |
| 6 | `1F` | Operating mode | 0–2 | USB, Standalone, Mixed | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `deviceGlobals` |
| 7 | `40` (`52`) | LED brightness | 0–15 | raw | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `deviceGlobals`, `wireGlobalCommand` |
| 8 | `30` | Controller output port | 0–7 | Off, MIDI A, MIDI B, MIDI A & B, USB, USB & MIDI A, USB & MIDI B, USB & MIDI A & B | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `deviceGlobals` |
| 9 | `17` | Start on | 0–1 | CTRL, ZAQ | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `deviceGlobals` |
| 10 | `18` | Clock rate out | 0–4 | 1, 2, 4, 24, 48 PPQ | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `deviceGlobals` |
| 11 | `20` (`50`) | Sync mode | 0–3 | Internal, Sync in, MIDI in, USB in | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `deviceGlobals`, `wireGlobalCommand` |
| 12 | `21` (`51`) | Clock output port | 0–8 | raw (no matching list) | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `deviceGlobals`, `wireGlobalCommand` |
| 13 | `23` | Scale | 0–127 | raw (no matching list) | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `deviceGlobals` |
| 14 | `24` | Scale base | 0–11 | C, Db, D, Eb, E, F, Gb, G, Ab, A, Bb, B | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `deviceGlobals` |
| 15 | `25` | Transpose mode | 0–30 | Off, CH 1–16, Track, CH 1-4 … CH 13-16 | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `deviceGlobals` |
| 16 | `26` | Trigger mode | 0–16 | Off, CH 1–16 | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `deviceGlobals` |
| 17 | `27` | Quantization mode | 0–15 | 96, t32, 32, t16, 16, t8, 8, t4, 4, t2, 2, t1bar, 1bar, t2bar, 2bar, 4bar | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `deviceGlobals` |
| 18 | `28` | Quantization mixer | 0–1 | raw | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `deviceGlobals` |

| Item | Fact | Status | Source |
| --- | --- | --- | --- |
| Read layout, firmware 0.56.0 | The 18 short reads return live values (not echoes) on a unit running 0.56.0, 2026-10-12. | Hardware-verified | `docs/PROTOCOL.md` "Global settings are real reads"; `scripts/test-device-globals.mjs` (2026-10-12 hardware values) |
| Write layout | `F0 00 20 32 7F 64 <cmd> <value> F7`, one layout for all 17 settings (`74` excluded); the BCR32 answers `… <cmd> <value> F7`; the editor reads back after every write. Checked on firmware 0.56.0 only. | Hardware-verified | `bcr32/device-globals.ts` header comment ("verified on hardware on 2026-10-13", Clock rate out 3 → 4 → 3); `scripts/test-device-globals.mjs` |
| Write layout on 1.x | Same layout with the 1.x wire numbers. | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `globalWrite`, `wireGlobalCommand` |
| Sync mode write on 1.0.2 | 2026-10-24 22:30, firmware 1.0.2, with the owner's go: read `50` = 0 (Internal); one write `F0 00 20 32 7F 64 50 03 F7` answered `F0 00 20 32 00 64 50 03 F7`; read-back 3 (USB in); the device still answered the product query (no freeze). Writes of 2 and 0 behaved the same (back to 0 at 22:36). With 3 or 2 stored, Start + 24 ppq clock + Stop sent over USB in ZAQ mode produced no output at all (no notes, no All Notes Off): with the source then set to USB on the panel itself (read back as 3, so 3 = USB), Start/Continue and clock still started nothing, and PLAY on the panel played at about 128 BPM (one note per 0.467 s) while 120 BPM clock arrived over USB: the 1.0.2 sequencer does not follow a clock received on its USB device port. Whether "USB" means another socket (the unit has two USB-C sockets) is not established. The editor's writes stay disabled. | Hardware-verified | `scripts/hw/bcr32-sync-mode.mjs`, log in `output/hw/` |
| Writes disabled | `globalWritesEnabled = false` since 2026-10-13: see §11. | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` |
| Global block as BCL | The `41` global block reports `.ctrlout off\|a\|b\|ab\|u\|ua\|ub\|uab` (controller output, same order as `30`), `.opmode usb\|stdl\|mixed`, `.footsw1` / `.footsw2 ctrl\|zaq` and `.tracks` (§8). The editor prefers `.ctrlout` over the `30` read. | Implemented, not yet verified on hardware | `bcr32/controller-indicators.ts` `routingFromBcl`; `bcr32/Workbench.tsx` `loadDeviceSettings` |

## 5. LED brightness

| Item | Fact | Status | Source |
| --- | --- | --- | --- |
| Firmware 0.56.0 | Read `… 64 40 F7` → `… 40 <0–15> F7`; write `… 64 40 <0–15> F7`, immediate effect, no STORE. | Hardware-verified | `bcr32/led-brightness.ts`; `docs/PROTOCOL.md` command `40` (verified); `docs/USER-GUIDE.md` "LED brightness · hardware" |
| Firmware 1.x | Read with `52`; the editor treats brightness as read-only on 1.x. `40` is the BCL preset request on 1.x and is never sent as a brightness write. | Implemented, not yet verified on hardware | `bcr32/led-brightness.ts` `createBrightnessTransport`; `bcr32/Workbench.tsx` |

## 6. Controller assignments (`31`–`38`)

### Targets

| Index | Control | Status | Source |
| --- | --- | --- | --- |
| 0–14 | Buttons 1–15 | Implemented, not yet verified on hardware | `bcr32/controller-read.ts` `controllerTargets` |
| 15 | Button 16 | Hardware-verified | `docs/controllers/BCR32-STUDIO-INTEGRATION.md` "Evidence" |
| 16–47 | Encoder pushes 1–32 | Hardware-verified | `scripts/fixtures/controller-pushes-102.json` (source line) |
| 48–49 | Footswitches 1–2 | Implemented, not yet verified on hardware | `bcr32/controller-read.ts` `controllerTargets`; `docs/FIRMWARE-1.0.2.md` ("A footswitch was not physically tested") |
| 50 | Encoder rotation 1 | Hardware-verified | `docs/controllers/BCR32-STUDIO-INTEGRATION.md` "Evidence" |
| 51–81 | Encoder rotations 2–32 | Implemented, not yet verified on hardware | `bcr32/controller-read.ts` `controllerTargets` |

T1–T4 are not indexed targets: they are preset shortcuts in the global block (§8).

### Fields and framing

Read: `F0 00 20 32 7F 64 <31+f> <index> F7`. Reply: `F0 00 20 32 <dev> 64 <cmd> <index> <value> F7` (10 bytes) or,
for wide fields, `… <cmd> <index> <mask> <hi> <lo> F7` (12 bytes, pack7 of a 16-bit value).

| Cmd | Field | Width | Status | Source |
| --- | --- | --- | --- | --- |
| `31` | Type | 1 byte | Hardware-verified | `bcr32/firmware-codec.ts` `targetFields`, `targetReply`; `scripts/fixtures/controller-pushes-102.json`; `docs/controllers/BCR32-STUDIO-INTEGRATION.md` (all eight fields read back on rotation 1, button 16, push 1) |
| `32` | Channel (0–15; higher = ALL, kept raw) | 1 byte | Hardware-verified | as above |
| `33` | Parameter | 16-bit | Hardware-verified | as above |
| `34` | Value 1 (minimum / button value 1) | 16-bit | Hardware-verified | as above |
| `35` | Value 2 (maximum / button value 2) | 16-bit | Hardware-verified | as above |
| `36` | Mode | 1 byte | Hardware-verified | as above |
| `37` | Option: LED mode on rotations (1 byte); signed increment on buttons, pushes and footswitches (16-bit) | 1 byte / 16-bit | Hardware-verified | as above |
| `38` | Display (0/1) | 1 byte | Hardware-verified | as above |

### Values

| Item | Fact | Status | Source |
| --- | --- | --- | --- |
| Type, rotations | 0 Off, 1 PC, 2 CC, 3 NRPN, 4 PB, 5 AT, 6 GS | Implemented, not yet verified on hardware | `bcr32/controller-read.ts` `assignmentFromRead` |
| Type, buttons and pushes | 0 Off, 1 PC, 2 CC, 3 NRPN, 4 Note, 5 AT, 6 GS, 7 MMC; 8 = custom SysEx message (kept raw) | Implemented, not yet verified on hardware | `bcr32/controller-read.ts` `assignmentFromRead`; `bcr32/FirmwareTools.tsx` |
| Mode, rotations | 0 Absolute, 1 Absolute 14-bit, 2 Rel1, 3 Rel2, 4 Rel3, 5 Rel1 14-bit, 6 Rel2 14-bit, 7 Rel3 14-bit, 8 Inc/Dec | Implemented, not yet verified on hardware | `bcr32/profile.ts` `rotationModes` |
| Mode, buttons | 0 Toggle, 1 Momentary, 2 Inc/Dec | Implemented, not yet verified on hardware | `bcr32/controller-read.ts` `assignmentFromRead` |
| Option, rotations (LED) | 0 Off, 1 1dot, 2 1dot-ex, 3 2dot, 4 2dot-ex, 5 Bar, 6 Bar-ex, 7 Spread, 8 Pan, 9 Qual, 10 Cut, 11 Damp | Implemented, not yet verified on hardware | `bcr32/led-modes.ts` `ledModes` |
| Sentinels | `F5A5` and `FA5A` in any 16-bit field, `FFFF` in Parameter: no value; kept raw. | Implemented, not yet verified on hardware | `bcr32/firmware-codec.ts` `targetReply` |
| PC bank Off | A PC assignment with bank Off returns `F5A5` in Parameter; this is not a disabled assignment. | Hardware-verified | `bcr32/controller-read.ts` (comment "The controller returns F5A5 for bank Off"); `docs/controllers/BCR32-STUDIO-INTEGRATION.md` (captured PC Bank Off) |
| Ranges | Parameter 0–127 (NRPN 0–16383); values 0–127, or 0–16383 in 14-bit modes. | Implemented, not yet verified on hardware | `bcr32/controller-read.ts` `assignmentFromRead` |

### Reads and writes

| Item | Fact | Status | Source |
| --- | --- | --- | --- |
| Full read | 82 targets × 8 fields, one at a time, 15 ms apart, 1200 ms timeout; stop after three missing replies. | Implemented, not yet verified on hardware | `bcr32/controller-read.ts` `createControllerReader` |
| Setter frame | `F0 00 20 32 <dev> 64 <31+f> <index> <value or mask hi lo> F7`, addressed device ID. The BCR32 answers the setter; that answer is not taken as confirmation. | Implemented, not yet verified on hardware | `bcr32/controller-write-plan.ts` `planControllerFieldWrite`; `bcr32/controller-write.ts` |
| Confirmation | After a 160 ms settle, an independent `31`–`38` read must return the written value. | Hardware-verified | `docs/controllers/BCR32-STUDIO-INTEGRATION.md` "Evidence" (Type OFF read back in 163–165 ms) |
| Type Off (`31` value 0), targets 50, 15, 16 | Accepted on rotation 1, button 16 and push 1; reads back as 0; only Type changes, the seven other fields stay as they were. | Hardware-verified | `README.md` "Evidence and limits"; `docs/FIRMWARE-1.0.2.md` "Evidence boundary"; `docs/controllers/BCR32-STUDIO-INTEGRATION.md` |
| CC / NRPN on rotations | Targets 50–81 only: Type 2 or 3, Channel ≤ 15, Parameter / Value 1 / Value 2 ≤ 16383, Mode ≤ 8, Option ≤ 11, Display ≤ 1. Reactivating from Off writes the other fields first, Type last. | Implemented, not yet verified on hardware | `bcr32/controller-write.ts` `isEncoderAssignmentWrite`, `changedEncoderFields` |
| Type Off, other targets | The editor sends Type Off to any target 0–81, footswitches included. | Implemented, not yet verified on hardware | `bcr32/controller-write.ts` `isEncoderAssignmentWrite` |
| Other setters | Other button, push and footswitch setters are not sent. | Implemented, not yet verified on hardware | `bcr32/controller-write.ts` `changedControllerFields` |

## 7. BCL transfer (`20`, `21`, `40`–`42`)

| Item | Fact | Status | Source |
| --- | --- | --- | --- |
| Line frame | `F0 00 20 32 <dev> 64 20 <hi> <lo> <ASCII…> F7`; line index = hi × 128 + lo, from 0, consecutive; printable ASCII. | Hardware-verified | `bcr32/bcl.ts` `bclLine`, `bclText`; `bcr32/preset-store.ts` (comment dated 2026-10-19) |
| Preset read | Optional `0C`, then `40 <slot>` or `40 7F` (working preset). The BCR32 streams `20` lines; the transfer ends at the line `$end`. | Hardware-verified | `bcr32/controller-presets.ts` `createPresetReader`; `bcr32/preset-store.ts` (comment dated 2026-10-19) |
| All presets | `40 7E` streams all presets the same way. | Implemented, not yet verified on hardware | `bcr32/controller-presets.ts` `presetReadQuery` |
| Global read | `41` (8 bytes) streams the global block (`$rev BCR32`, `$global`, …, `$end`). | Hardware-verified | `bcr32/controller-tracks.ts` (comment "independent global read-back") |
| Names | `42 7E` returns one `21` reply per preset: `F0 00 20 32 <dev> 64 21 00 <preset 0–63> <24 ASCII bytes, space-padded> F7` (34 bytes); complete after 64. `42 <slot>` returns one name. | Implemented, not yet verified on hardware | `bcr32/bcl.ts` `bclResponse`; `bcr32/controller-presets.ts` |
| Line acknowledgement | Each line sent to the BCR32 is answered `F0 00 20 32 <dev> 64 21 <hi> <lo> <status> F7` (11 bytes); status `0` = accepted. | Hardware-verified | `bcr32/controller-tracks.ts` (comment "four ACK=0") |
| Limits | At most 600 ASCII bytes per line (frame 10–610 bytes) and 16384 lines. The editor gives up a read after 3 s without a line or 45 s overall, and caps it at 4 MiB. | Implemented, not yet verified on hardware | `bcr32/bcl.ts` `bclLine`; `bcr32/controller-presets.ts` `createPresetReader` |
| Sender pacing | One line at a time, wait for its acknowledgement (1500 ms), 15 ms gap; any non-zero status or timeout stops the transfer. | Implemented, not yet verified on hardware | `bcr32/preset-store.ts` `createBclSender` |
| Read conditions | A preset read needs the controller in CTRL mode with the sequencer stopped; otherwise no complete reply arrives. | Implemented, not yet verified on hardware | `bcr32/ControllerPresets.tsx` (timeout notice) |
| Directives | `$rev BCR32`, `$preset`, `$encoder 1–32`, `$button 1–50`, `$global`, `$store 1–64`, `$end`. | Implemented, not yet verified on hardware | `bcr32/host-policy.ts` `validateBclPacket` |
| `$store` | `$store <1–64>` appears in the BCR32's own complete bank export on 1.0.2. | Hardware-verified | `bcr32/preset-store.ts` (comment "captured in the BCR32's own complete bank export on firmware 1.0.2") |
| Properties | `.name`, `.snapshot`, `.request`, `.init`, `.easypar`, `.showvalue`, `.mode`, `.default`, `.tx`; `.tracks` in the global block. | Implemented, not yet verified on hardware | `bcr32/host-policy.ts` `validateBclPacket` |
| `.tx` tokens | `val`, `val0.6`, `val0`, `val0.3`, `val4.7`, `val8.11`, `val12.13`, `val7.13`, `val1.7`, `reloffs`, `relsign`, `rel2s`, `cks-1`, `cks-2`, `cks-3`, `ifp`, `ifn`, `ntimes`. | Implemented, not yet verified on hardware | `bcr32/bcl.ts` `bclTokens`; `docs/firmware-1.0.2-command-map.json` `bcl_tx_tokens` |
| Preset name | 1–24 printable ASCII characters, no quote. | Implemented, not yet verified on hardware | `bcr32/preset-store.ts` `presetStorePlan` |

### Preset save sequence

| Step | Action | Status | Source |
| --- | --- | --- | --- |
| 1 | Read the working preset (`40 7F`) completely; validate it as a restorable single preset. | Hardware-verified | `bcr32/preset-store.ts` `storeHardwarePreset` (comment "Physical 1.0.2: slot63 store … 2026-10-19") |
| 2 | Read the source (working preset or `40 <slot>`) and build the job: name line replaced, `$store <slot+1>` inserted just before `$end`. | Hardware-verified | as step 1 |
| 3 | Read the destination slot completely. | Hardware-verified | as step 1 |
| 4 | Persist a backup (time, slot, working, destination, proposed) and check it before the first line. | Hardware-verified | as step 1 |
| 5 | Send the job line by line; every line must be acknowledged with status 0. | Hardware-verified | as step 1 |
| 6 | Read the slot back; it must equal the expected text. | Hardware-verified | as step 1 |
| 7 | Send the original working preset back (no `$store`) and read it back; it must be identical. | Hardware-verified | as step 1 |
| 8 | Read the slot once more; it must still equal the expected text. | Hardware-verified | as step 1 |

Persistence across a power cycle has not been tested (`bcr32/preset-store.ts`).

## 8. T1–T4 track shortcuts (`.tracks`)

| Item | Fact | Status | Source |
| --- | --- | --- | --- |
| Line | In the global block: `.tracks <p1> <p2> <p3> <p4> <selected>`; presets 1–64, selected track 1–4. | Hardware-verified | `bcr32/controller-tracks.ts` `controllerTracksFromBcl` (comment "Physically checked on 1.0.2") |
| Write | A four-line job `$rev BCR32` / `$global` / `  .tracks …` / `$end`, each line acknowledged with status 0; no `$store`, no other global line. | Hardware-verified | `bcr32/controller-tracks.ts` `tracksLines`, `applyControllerTracks` (comment "four ACK=0") |
| Side effect | Writing `.tracks` reloads the selected preset into working memory, even when only an inactive binding changed. | Hardware-verified | `bcr32/controller-tracks.ts` (same comment) |
| Store from the default template | 2026-10-24 20:21, firmware 1.0.2: slot 13 was empty and the working preset initialized (`.init`, no name). The editor stored its default template (snapshot of preset 1) as "test Fred" with `$store 13`; every line was acknowledged, and slot 13 then read back identical to the plan and named "test Fred". The first slot read right after `$store` got no complete reply, so the editor now retries it. The owner had to press EXIT on the BCR32 before the stored preset took effect on the device. | Hardware-verified | `scripts/hw/bcr32-store-test.mjs` (run 2026-10-24 20:21 CEST); `bcr32/preset-store.ts` `storeHardwarePreset` |
| Change and restore | 2026-10-24, firmware 1.0.2, selected T1: T4 set from slot 4 to an empty slot (60), read back `1 2 3 60 1`, then restored to `1 2 3 4 1`. Globals and the working preset read afterwards were byte-identical to those read before. Applied through `applyControllerTracks`, which re-sends the backed-up working preset after each change. | Hardware-verified | `scripts/hw/bcr32-tracks-test.mjs` (run 2026-10-24 16:36 CEST) |
| Selecting a track | Selecting T*n* from the editor writes `.tracks` with a new `selected` value. | Implemented, not yet verified on hardware | `bcr32/ControllerPresets.tsx` `changeTracks` |
| Monitoring | The editor polls `41` every 2 s (without `0C`) to follow the selected track; it stops after three missing replies. | Implemented, not yet verified on hardware | `bcr32/ControllerPresets.tsx` |
| Track LED colours | T1 green, T2 orange, T3 blue, T4 green in CTRL mode on 1.0.2. | Hardware-verified | `bcr32/controller-tracks.ts` `controllerTrackColors` (comment "Operator observation on CTRL/1.0.2") |

## 9. Sequencer

### Track parameters (`29`–`2D`)

Read `F0 00 20 32 7F 64 <cmd> <track 0–3> F7`. Reply `… <cmd> <track> <value> F7` (10 bytes), or for `2C`/`2D`
`… <cmd> <track> <mask> <byte> F7` (11 bytes, pack7 of one signed byte).

| Cmd | Field | Value | Status | Source |
| --- | --- | --- | --- | --- |
| `29` | Track mode | 1 byte, raw | Implemented, not yet verified on hardware | `bcr32/firmware-codec.ts` `trackFields`, `trackReply` |
| `2A` | Track port | 1 byte, raw | Implemented, not yet verified on hardware | as above |
| `2B` | Track channel | 1 byte, raw | Implemented, not yet verified on hardware | as above |
| `2C` | Ctrl Alpha selector | signed byte, pack7 | Implemented, not yet verified on hardware | as above |
| `2D` | Ctrl Beta selector | signed byte, pack7 | Implemented, not yet verified on hardware | as above |
| Read on hardware | 2026-10-24 20:30, firmware 1.0.2: all 20 reads (4 tracks × mode, port, channel, alpha, beta) answered, identical on a second read: mode 0, port 4, channels 0–3, alpha −4, beta −4. Meanings not established. | Hardware-verified | `scripts/hw/bcr32-track-read.mjs` |

### Pattern blocks (`04 0B`)

| Offset | Content | Status | Source |
| --- | --- | --- | --- |
| 0–7 | `F0 00 20 32 <dev> 64 04 0B` | Implemented, not yet verified on hardware | `bcr32/zaquencer.ts` `decodeZaqBlock` |
| 8 | Kind 0–3; kind 3 is a sequencer global dump (blocks 0–1), not a pattern | Implemented, not yet verified on hardware | as above |
| 9 | Bank | Implemented, not yet verified on hardware | as above |
| 10 | Page 0–15 | Implemented, not yet verified on hardware | as above |
| 11 | Block 0–7 | Implemented, not yet verified on hardware | as above |
| 12–267 | 256 nibbles = 128 data bytes, high nibble first | Implemented, not yet verified on hardware | as above |
| 268–271 | 16-bit sum of bytes 0–267, four nibbles, high first | Implemented, not yet verified on hardware | as above |
| 272 | `F7` | Implemented, not yet verified on hardware | as above |

Eight ordered blocks (0–7) with the same device/kind/bank/page form one 1024-byte pattern: four tracks × 256 bytes.

### Pattern layout (per 256-byte track, hex offsets)

| Offset | Meaning | Status | Source |
| --- | --- | --- | --- |
| 00–0F | Track header; bytes 00–03 hold the step mask (32-bit little-endian, one bit per step); the rest is kept verbatim | Implemented, not yet verified on hardware | `bcr32/zaquencer.ts` `readStep`, `patchStep` |
| 10–2F | 32 notes | Implemented, not yet verified on hardware | as above |
| 30–4F | Velocity in bits 0–6; bit 7 carries gate bits for steps 24–31 | Implemented, not yet verified on hardware | as above |
| 50–6F | 32 signed timing offsets in ticks | Implemented, not yet verified on hardware | as above |
| 70–7B | Gate codes for steps 0–23, two per byte, even step in the low nibble | Implemented, not yet verified on hardware | as above |
| 7C–9B | Alpha per-step bytes | Implemented, not yet verified on hardware | as above |
| 9C–BB | Beta per-step bytes | Implemented, not yet verified on hardware | as above |
| BC–FB | 32 little-endian words: drum voice mask or chord code | Implemented, not yet verified on hardware | as above |
| FC–FF | Rest mask (32-bit little-endian, one bit per step) | Implemented, not yet verified on hardware | as above |

For step *s* ≥ 24, gate bits 0–3 are bit 7 of velocity bytes `30 + 4·(s−24) + 0…3`.

### Remote control CCs (default table)

On the configured remote channel (0 disables, 1–16). *v* = CC value.

| CC | Values | Action | Status | Source |
| --- | --- | --- | --- | --- |
| 0 / 1 | 0–127 / 0–63 | Recall pattern *v* / *v* + 128 | Implemented, not yet verified on hardware | `docs/firmware-1.0.2-command-map.json` `zaquencer_cc_defaults` |
| 2 / 3 | 0–127 / 0–63 | Same, quantized | Implemented, not yet verified on hardware | as above |
| 4 | 0–1, 2, 3, 4 | Transport state; other values unqualified actions | Implemented, not yet verified on hardware | as above |
| 5 | 0–7 | Track mute: track = *v* >> 1, on = *v* & 1 | Implemented, not yet verified on hardware | as above |
| 6 | 0–127 | Voice mute: track = *v* >> 5, voice = (*v* & 31) >> 1, on = *v* & 1 | Implemented, not yet verified on hardware | as above |
| 7 | 0–7 / 8–16 / 17–52 / 53 | Track roll / global roll quantization / per-track roll quantization / all rolls off | Implemented, not yet verified on hardware | as above |
| 8 | 0–127 | Voice roll (same packing as CC 6) | Implemented, not yet verified on hardware | as above |
| 9 / 10 | 0–127 | Track setting 1–32: track = *v* >> 5, setting = (*v* & 31) + 1 | Implemented, not yet verified on hardware | as above |
| 11 | 0–127 | Track offset: track = *v* >> 5, offset = *v* & 31 | Implemented, not yet verified on hardware | as above |
| 12 | 0–19 | Direction code: track = *v* div 5, code = *v* mod 5 | Implemented, not yet verified on hardware | as above |
| 13 | 0–39 / 40–79 | Division code 0–9: track = *v* div 10 (second range reordered) | Implemented, not yet verified on hardware | as above |
| 14–15 | 0–127 | Step rest: track = (cc−14)·2 + (*v* >> 6), step = (*v* & 63) >> 1, rest = *v* & 1 | Implemented, not yet verified on hardware | as above |
| 16–17 | 0–127 | Step mask, same packing as CC 14–15 | Implemented, not yet verified on hardware | as above |
| 18–20 | 0–127 | Tempo = clamp(*v* + (cc−18)·128 − 76, 30, 300) BPM | Implemented, not yet verified on hardware | as above |
| 21 | 0–16 | Scale 0–15; 16 = none (`FF`) | Implemented, not yet verified on hardware | as above |
| 22 | 0–11 | Scale base | Implemented, not yet verified on hardware | as above |
| 23 | 0–31 | Track operation: track = *v* >> 3, operation = *v* & 7 | Implemented, not yet verified on hardware | as above |

## 10. Other device facts

### Controller export from the front panel (`04 0C`)

| Item | Fact | Status | Source |
| --- | --- | --- | --- |
| Block | 273 bytes: `F0 00 20 32 7F 64 04 0C <b8> <b9> <b10> <block 0–7>`, 256 nibbles (128 bytes), 4-nibble checksum (16-bit sum of bytes 0–267), `F7`. Same container as `04 0B`. | Implemented, not yet verified on hardware | `bcr32/controller-dump.ts` |
| Records | 11-byte records `[type][channel][parameter LE16][min LE16][max LE16][mode][option][display]`, crossing block boundaries; `A5`/`F5` bytes mark unused memory. | Implemented, not yet verified on hardware | `bcr32/controller-dump.ts` `parseRecords` |
| Record 0 | Record 0 of block 0 is encoder 1. | Hardware-verified | `bcr32/controller-dump.ts` `knownRecords` (comment "established on hardware") |

### MIDI sent by controls

| Item | Fact | Status | Source |
| --- | --- | --- | --- |
| Rel1 | Value 1 (minimum) = −1, Value 2 (maximum) = +1. | Implemented, not yet verified on hardware | `bcr32/controller-midi.ts` `relativeDelta` |
| Rel2 | 64 + delta (65 = +1, 63 = −1). | Implemented, not yet verified on hardware | as above |
| Rel3 | ≥ 64 → +(v − 64); < 64 → −v (65 = +1, 1 = −1). | Implemented, not yet verified on hardware | as above |
| Rel1 14-bit | < 8192 → −v; otherwise 16384 − v (1 = −1, 16383 = +1). | Implemented, not yet verified on hardware | as above |
| Rel2 14-bit | v − 8192 (8193 = +1, 8191 = −1). | Implemented, not yet verified on hardware | as above |
| Rel3 14-bit | ≥ 8192 → −(v − 8192); < 8192 → +v (1 = +1, 8193 = −1). | Implemented, not yet verified on hardware | as above |
| 14-bit CC | Base parameter 0–31: MSB on CC *n*, LSB on CC *n* + 32. | Implemented, not yet verified on hardware | `bcr32/controller-midi.ts` `matchesCC`, `transportIssue` |
| NRPN | Selector CC 99 (MSB) + CC 98 (LSB), data CC 6 (and CC 38 for 14-bit); Inc/Dec rotation sends CC 96 (+1) / CC 97 (−1); NRPN 16383 is the null selector; CC 100, 101 and 121 clear the selection. | Implemented, not yet verified on hardware | `bcr32/controller-midi.ts` `createMidiDecoder` |

### Command positions not used by the editor

| Cmd | Function on 1.0.2 | Status | Source |
| --- | --- | --- | --- |
| `01` / `02` | Text identification request / reply | Implemented, not yet verified on hardware | `docs/firmware-1.0.2-command-map.json` |
| `04` | Block import; 10-byte acknowledgement (mode in byte 7, result in byte 8) | Implemented, not yet verified on hardware | as above |
| `05` | Load an internal 32-bit value (meaning unknown) | Implemented, not yet verified on hardware | as above |
| `06` / `07` / `08` / `09` | Export globals / current preset / current page / all presets | Implemented, not yet verified on hardware | as above |
| `0B` | Switch to the sequencer page | Implemented, not yet verified on hardware | as above |
| `10`–`13` | Internal transfer/storage transitions (meaning unknown) | Implemented, not yet verified on hardware | as above |
| `14` | Erase a controller preset (destructive) | Implemented, not yet verified on hardware | as above |
| `15` / `16` | Controller operation (meaning unknown) / force transport state to 0 | Implemented, not yet verified on hardware | as above |
| `19` | Additional global setting, read 8 / reply 9 (name unknown) | Implemented, not yet verified on hardware | as above |
| `22` | Recall a controller preset | Implemented, not yet verified on hardware | as above |
| `43` | Snapshot (controller active) | Implemented, not yet verified on hardware | as above |
| `72` | No function on 1.0.2; still never sent (§11) | Implemented, not yet verified on hardware | as above; `bcr32/device-globals.ts` |
| `77` | Bootloader / restart transition | Implemented, not yet verified on hardware | as above |
| `7A` | Service sequence starting `0B 0C 32` (meaning unknown) | Implemented, not yet verified on hardware | as above |

## 11. Safety rules

| Rule | Status | Source |
| --- | --- | --- |
| Never send STORE (`72`) or bootloader/firmware (`77`). Neither may appear among the global reads; the module refuses to load if one does. | Implemented, not yet verified on hardware | `bcr32/device-globals.ts`; `CONTRIBUTING.md` |
| Global writes are disabled since 2026-10-13: writing global settings froze the owner's BCR32 (then on firmware 0.56.0). An earlier test on Clock rate out did not freeze it; the cause is not understood. Re-enable only after a reproduced, explained test. | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `globalWritesEnabled`; `bcr32/DeviceSettings.tsx` |
| Operating mode (`1F`) and Controller output port (`30`) can cut the USB link (standalone, output Off or MIDI only). Writing them takes two clicks (Write, then Confirm) and they are left out of "Write all changes". They can be restored from the front panel. | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `riskyGlobals`; `bcr32/DeviceSettings.tsx` |
| On 1.x never send `20`, `21` or `40` as globals or brightness: they are BCL commands. | Implemented, not yet verified on hardware | `bcr32/device-globals.ts` `wireGlobalCommand`; `docs/FIRMWARE-1.0.2.md` |
| Reads go through a fixed whitelist (§3); no command scan, automatic retry or generic "send hex". | Implemented, not yet verified on hardware | `bcr32/firmware-codec.ts` `isFirmwareRead`; `bcr32/host-policy.ts` |
| Writes need the addressed device ID, a fresh 1.x product reply on the current connection, an operation grant and an unlocked editor. Closing, locking or rebinding revokes a pending job. | Implemented, not yet verified on hardware | `bcr32/host-policy.ts`; `docs/controllers/BCR32-STUDIO-INTEGRATION.md` |
| Preset save: only a complete single preset read from the device; slot 1–64; name 1–24 ASCII without quote; `$store` once, just before `$end`; no `$global`, recall or erase directive; backup persisted and verified before the first line; stop on any missing or non-zero acknowledgement; read back, restore the working preset, read back again. Unsent local edits are not uploaded. | Hardware-verified | `bcr32/preset-store.ts` (comment dated 2026-10-19); `bcr32/host-policy.ts` `plannedOperation` |
| T1–T4: only the four-line `.tracks` job; no `$store`; back up globals and the working preset first; read the global block back and require every other line unchanged; if the selected binding is unchanged, send the working preset back and verify it. | Hardware-verified | `bcr32/controller-tracks.ts` `applyControllerTracks` (comment "Physically checked on 1.0.2") |
| Assignment writes: one field at a time, debounced, independent read-back; failure, timeout, lock, rebind or closure clears the queue; no retry. | Implemented, not yet verified on hardware | `bcr32/controller-write.ts` `createAssignmentWriter` |

## 12. Open questions

1. Persistence across a power cycle: not tested for preset save, T1–T4 or global writes.
2. Cause of the 2026-10-13 freeze after global writes (which setting, value or sequence).
3. Global reads and the `50`/`51`/`52` renumbering on 1.x have no recorded hardware check.
4. Settings without an option list, shown raw: Clock output port (`21`/`51`, 0–8), Scale (`23`, 0–127), Quantization mixer (`28`), LED brightness. MIDI thru destination values other than 0–3 and 9–11. Global `19`: name and values unknown.
5. CC/NRPN rotation setters: `docs/FIRMWARE-1.0.2.md` reports them confirmed by read-back, while `bcr32/controller-write-plan.ts` still marks setter validation as pending.
6. Footswitch targets 48–49: Type Off not tested; other button, push and footswitch setters not enabled.
7. Kept raw: type 8 (custom SysEx), MMC, channel > 15 (ALL), sentinel values, product reply bytes 8–9.
8. Meaning of preset slots `7E`/`7F` beyond "all" and "working", and whether `0C` is required before a preset read.
9. `.tx` syntax: checksum tokens, accumulated message size and advanced combinations.
10. Sequencer: track header bytes, gate codes, chord codes and special Alpha/Beta values are raw; kind 3 dumps are not interpreted; enumerations of `29`–`2D` are unknown.
11. Remote CCs: the remote channel setting and CC 4 values 2–4 are not qualified.
12. `04 0C` export: meaning of header bytes 8–10; only record 0 is identified.
13. Sequencer settings such as gate output voltage and sync clock rates have no known command.
