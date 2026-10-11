# Changelog

Versions of the **application**, independent of the controller firmware (0.56.0 observed). `MAJOR.MINOR.PATCH`:
incompatible change, new feature, fix. `0.x` versions are experimental.

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
