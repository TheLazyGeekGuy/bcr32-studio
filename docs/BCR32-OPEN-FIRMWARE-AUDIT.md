# Open BCR32 demo firmware: editor integration audit

## Source identity and scope

Read2026-10-30 10:44–10:50 CET by Codex primary agent. Exact model identifier/effort are unavailable; provenance is incomplete on that point.

- Reference: [BCR32-Firwmare](https://forge.prozium.net/TheLazyGeekGuy/BCR32-Firwmare), exact commit **`47765b302150d87ecad5dcd89dd0de28bdb66260`**, clean ignored research clone.
- `UPSTREAM.md` identifies MusicTribeOpenSource/0715-AAW commit `1af9f0aa9d8d9b00cc979b7c8a0807a81dc25e8b` as the import source. That upstream commit was not independently checked out in this review.
- Editor baseline **`1726b6217e958e8026bbe65a51e658c9a3e31b5f`**, initially clean, work branch `work/sysex-bcl-inspector`.
- Read: root README/UPSTREAM/license declarations; `docs/ANALYSE-BCR32-FR.md`; `demo/App/{main,input,sysex,midi_thru,version}.{c,h}` as present; `demo/Board/bsp_led.h`. File/path observations below refer to this snapshot. This is a focused source review, not a compiler, electrical or exhaustive firmware audit.

## Main conclusion

This is **bare-metal demonstration firmware0.0.1**, not the commercial CTRL/ZAQ firmware1.0.3 source. It exercises the hardware but does not contain the commercial preset editor, BCL interpreter or sequencer implementation in the inspected application/board scope. No `BCL`, `cks-` or `.tx` implementation was found there. It therefore does **not** resolve native checksum ticket41 or validate copying BCR2000 commands into BCR32.

| Finding | Source evidence | What the editor can use |
| --- | --- | --- |
| Separate USB CTRL/ZAQ cables | `sysex.c`, cable count2 and same-cable reply | Preserve per-endpoint ownership, source and request correlation; names alone do not prove firmware identity |
| OLED128×32, SSD1306 | `main.c`, local fill/write/update routines | Faithful screen dimensions; a future custom firmware could receive text or pixels, but no such host command is supplied |
| LED hardware brightness0–15 | `bsp_led.h`, HT16K33 setup; `main.c` uses0F | Hardware capability evidence; not a new commercial SysEx setter or proof of arbitrary RGB/intensity control |
| Encoder/buttons | `input.c/.h`:32 knob encoders plus SELECT,64 scanned button IDs;1ms scan,20ms event window,16-event queue | Understand quadrature and bounded event aggregation; these wiring IDs are not commercial BCL selectors or MIDI addresses |
| Local CV/Gate demonstration | `main.c`:knobs1–4 drive CV,button groups drive gates | Confirms local demo behavior in source; no host CV/Gate API or safe commercial voltage-command mapping |
| USB echo and DIN thru | `main.c:UsbMidiLoopback`, `midi_thru.c` | Echo is not ACK/read-back; a host must not mistake mirrored TX for a hardware parameter response |

## Actual exposed SysEx

The demo reassembles USB-MIDI SysEx per cable into a16-byte buffer; its command handler accepts exactly8 bytes. It recognizes the Behringer header, device00 or7F and model64 or7F.

| Command | Demonstrated source behavior | Integration rule |
| --- | --- | --- |
| `F0 00 20 32 7F 64 74 F7` | Reply `F0 00 20 32 00 64 74 00 F7` on the originating cable | Application/bootloader distinction; **not CTRL versus ZAQ**. Do not add to background mode-following logic on this basis |
| Opcode77 under that header | Sets a boot request flag; main subsequently enters bootloader | Keep excluded from editor operation; not sent or tested here |

The same main loop echoes received USB packets. Its source-level74 reply and echo must be classified separately. A matching model64, cable name or74 application response does not uniquely identify this demo versus commercial firmware. Any future demo adapter needs explicit selection plus a distinct, versioned capability identity before enabling writes.

There is no demonstrated host command for OLED text/bitmap, raw rings, custom button colors, hardware input-event export, preset read/write, BCL STORE, transport or sequencer state. These require an explicitly separate custom-firmware protocol or independently captured commercial commands. Do not extend the production command allowlist from local GPIO/C routines.

## Proposed integration path

1. Retain the commercial BCR32 adapter and its qualified1.0.3 grants unchanged.
2. Define a separate opt-in custom-firmware leaf. Require protocol identity/version/capabilities, input-event IDs and timestamp/sequence semantics. Keep wiring addresses inside that firmware, never inside the generic host.
3. Add bounded commands only after their handlers exist: logical control feedback, screen text/value, input events and status/overflow counters. Use request IDs, generation, explicit ACK/refusal and readable state; coalesce value/display updates separately from reliable edits.
4. Prefer semantic text/value deltas over full pixel frames. A128×32 monochrome frame is512 raw bytes, about586 seven-bit payload bytes; at31,250-bit/s DIN with10 serial bits/byte that payload alone takes roughly188ms. This calculated bound is not USB performance measurement.
5. Keep broker leases, operation validators, echo suppression, disconnect/disposal and browser/desktop transport parity in the host. Never echo an RX update back into TX by default.
6. Qualify in a separate firmware/hardware project; preserve the stock instrument and original persistent state. The demo performs internal/external flash self-tests at startup per `main.c`; it was not built, run or installed during this audit.

The reference declares AGPL-3.0-or-later for Music Tribe demo/docs and separate third-party licenses. No vendor implementation was copied into this MIT editor. Any future code reuse must preserve applicable source/license obligations; this audit only records protocol/hardware observations and links.

## Delivered versus deferred

Delivered: this source-based capability matrix and its boundaries, linked from the architecture/site documentation. Deferred: custom firmware, commercial OLED protocol discovery, new host permissions, native checksum qualification and hardware tests. See [desktop architecture](DESKTOP-APPLICATION-STUDY.md) for how a native host can transport already-supported feedback without granting new device capabilities.
