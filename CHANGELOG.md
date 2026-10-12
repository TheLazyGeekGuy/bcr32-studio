# Changelog

Versions of the **application**, independent of the controller firmware (0.56.0 observed). `MAJOR.MINOR.PATCH`:
incompatible change, new feature, fix. `0.x` versions are experimental.

## [0.7.0] — 2026-10-12

- The controller's global settings are **loaded automatically at connection** (Config option "Load the settings from
  the BCR32 at connection", on by default; when off, "Reset to editor defaults" is offered) and put into the Config
  fields: footswitches, startup mode, operating mode, controller output routing (now with Off), MIDI thru source,
  destination and filter. Fields stay editable; a "≠ BCR32" marker shows a field changed after the read, since
  nothing is written to the device yet. Read time shown.
- Device settings table: every value with a known meaning is labelled from the official editor's BCR32 option lists
  (CTRL/ZAQ, USB/STDL/MIXED, output and thru ports, 1–48 PPQ, sync source, scale base, transpose, trigger,
  quantization). Clock output port, scale and quantization mixer stay raw (list and range do not match).
- Verified against a real BCR32 in Chromium with MIDI permission: 18 settings read and applied at connection.

## [0.6.0] — 2026-10-12

- Config "Device settings": reads the 18 global settings of the BCR32 (operating mode, controller output port, LED
  brightness, MIDI thru, clock, scale…) with the same short read-only requests the official editor sends at each
  connection; raw value shown, with its label when the option list is known; echoes and silences are reported as
  such. Nothing is written. Verified on hardware on 2026-10-12 (three values differ from the 2026-10-09 capture,
  matching the changes made on the device: real reads, not echoes).
- Numbers above the encoders are centred on the knobs.
- Config option "Show control numbers" hides or shows the numbers above encoders and keys (remembered per browser).
- Optional label screen (Config, off by default): a half-height dot-matrix display above the OLED shows the label of
  the control on screen (your label, else the name printed on the panel, α and β included); it zooms with the OLED.
- Config "Display style": five screen styles for the OLED and the label screen (Ice OLED, Amber VFD, Green LCD, Red LED,
  White OLED), each shown as a live preview; remembered per browser.
- A selected key is drawn at full brightness while it is selected, even when unassigned, then returns to its dimmed state.

## [0.5.0] — 2026-10-11

First public release.

- Interactive BCR32 front panel driven by incoming MIDI: encoders, push encoders, programmable keys, LED rings
  (the eleven ring modes: dots, bar, spread, pan, qual, cut, damp…) and a dot-matrix OLED with direct value entry.
- Per-control assignments: CC, NRPN, note, pitch bend, aftertouch, program change, GS/XG, MMC; channel, parameter,
  range; absolute, 14-bit and relative modes (REL1/2/3, R1/2/3-14), INC/DEC; button toggle/momentary; LED ring mode;
  display on/off; multi-selection editing.
- MIDI Learn: arm on a control, the next incoming message fills type, channel, parameter and mode.
- OLED display arbiter: several encoders turned together share the screen in proportion to their pulses, in 300 ms
  slots; the inspector follows only once the stream settles; activity strip with up to four active controls.
- Presets: JSON draft and bank import/export, local library, A4 PDF overlay sheet, parameter-name tables.
- Cubase MIDI Remote export (Cubase 12+): surface script with the exact MIDI of every assigned control.
- LED brightness read/write over SysEx (verified on hardware); read-only product/firmware query.
- Eight UI languages, six themes, compact workspace, strict Content-Security-Policy.
- Safety: no STORE (`0x72`) or bootloader (`0x77`) SysEx in the bundle, enforced by a test.
