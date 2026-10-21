# Changelog

## [0.45.0-alpha.4] — 2026-10-21

- Fix "Editor unavailable" after a new deployment: the offline service worker now precaches every JS/CSS file of the build it pins, so lazy modules (instrument library, PDF export, editor chunks) keep working after GitHub Pages removes the previous build's files.
- Show the offline status in standalone editors, with an explicit "Update and reload" action when a new version is waiting; a new build still never takes over on its own during a MIDI session.
- The last-resort error screen logs the error, shows its message and offers the update when one is waiting.

## [0.45.0-alpha.3] — 2026-10-20

- Update the cached destination preset name as soon as the controller acknowledges the complete save transfer, without rereading the 64 preset names. Keep read/save/shortcut lists in sync, and invalidate an uncertain label if the save later fails.

## [0.45.0-alpha.2] — 2026-10-20

- Move the BCR32 editor into the shared MIDI Studio host, preserving the common appearance, screen, monitor, library and history tools.
- Add firmware 1.0.2 controller auto-read, correct encoder-push PC Bank Off/Toggle Off, T1–T4 shortcuts and warm preset cache.
- Replace the long preset form with Read/Save/Export actions and explicit hardware destination/name.
- Carry the backup, explicit preset STORE, readback and working-preset restoration workflow.
- Send Type OFF immediately for controller buttons, pushes and rotations with independent readback. Keep preset saving manual.
- Distribute only BCR32 and its shared dependencies; leave parallel editor work outside this release.

Versions of the **application**, independent of the controller firmware (0.56.0 observed). `MAJOR.MINOR.PATCH`:
incompatible change, new feature, fix. `0.x` versions are experimental.

## [0.12.1] — 2026-10-13

Fixes:
- **Floating display without styles** in the published app: the floating window inherits the page's
  Content-Security-Policy (`style-src 'self'`), which blocked the copied inline styles. The stylesheet is now linked by
  its URL; theme and screen style are kept.
- **Screen slow to follow a new knob** (floating window and panel OLED): a knob that stopped kept the screen until its
  counting window and slot ran out (about 390 ms measured). A control silent for 100 ms no longer competes, and a shown
  control that idle gives the screen up at the next tick: about 120 ms measured. Sharing between knobs turned together
  is unchanged (end-to-end check 1:1 and 3:1).

## [0.12.0] — 2026-10-13

- **Floating display**: a button opens the label screen and the OLED in a small always-on-top window (Document
  Picture-in-Picture, Chrome/Edge 116+), movable and resizable, e.g. over a DAW; it follows the controls you turn, in
  the chosen theme and screen style. The display arbiter's timers run in the floating window while it is open, so a
  background editor tab does not slow it down. Disabled with the reason in other browsers.
- User guide: floating display, sharing the MIDI port with a DAW on macOS, Linux and Windows.
- `scripts/e2e-floating-display.cjs` (manual, headed Chromium): opens the window and measures it with a simulated
  BCR32. Note: Chromium under automation never reports a page as hidden, so the background case is to be confirmed
  in a normal Chrome.

## [0.11.1] — 2026-10-13

Documentation:
- `docs/USER-GUIDE.md`: every tab, option and procedure (assignments, MIDI Learn, screens, presets, files, front-panel
  export, Cubase export, device settings, languages), safety and privacy, troubleshooting.
- `docs/ARCHITECTURE.md`: source map, data flow, device protocol in the code, i18n, storage keys, tests, build.
- README documentation table; CONTRIBUTING links and the rule on disabled global writes.

## [0.11.0] — 2026-10-13

From the review of the official user manual (Rev. 1):
- Files > Front-panel export handles the **all 64 presets** export (STORE, SELECT, encoder 1, encoder 7) as well as the
  current preset: every received block can be shown, exports are grouped by preset, a preset whose 8 blocks arrived
  is rebuilt (93 records), "Save all exports (.syx)" keeps the whole set. Both procedures are shown.
- Footswitch choices say what ZAQ does (start/stop on footswitch 1, next pattern on footswitch 2), in Config and in
  the device settings table; device-table labels are translated.
- docs/PROTOCOL.md: what the manual adds (export variants, import mode, 15 MIDI thru destinations, sequencer settings).
- Not implemented on purpose: preset **import** to the controller (needs the 8 blocks of a preset and the record map;
  writes are paused since a global write froze a BCR32), sequencer (Zaquencer) settings without known commands.

## [0.10.1] — 2026-10-13

- **Writing the controller's global settings is disabled**: it froze the owner's BCR32 (firmware 0.56.0). The
  Write buttons are gone and the reader refuses any write; values can still be read and chosen in the editor. The
  LED brightness slider, verified separately, is unchanged. If a BCR32 is frozen, switch it off and on.

## [0.10.0] — 2026-10-13

- Files > **Front-panel export**: BCR32 Studio listens while you export a preset from the controller (STORE, hold
  SELECT, encoder 1, then encoder 8) and shows it decoded: block, checksum, the 11 records of the block (type, CC,
  channel, range; uninitialised memory shown as raw bytes). Records whose control is identified on hardware can be
  applied to the profile (today record 0 = encoder 1: type, channel, parameter and range only); a corrupt export is
  never applied. "Save the export (.syx)" keeps the raw dump for analysis. Nothing is sent to the controller.
- Decoding checked against a real capture of 2026-10-12 (checksum OK, encoder 1 on CC 10); reception inside the app
  not yet observed on the hardware.

## [0.9.0] — 2026-10-13

- **Write the controller's global settings** from Config > Device settings: a "Write" button on every row whose choice
  differs from the BCR32, "Write all changes" for the safe ones; each write is acknowledged by the device and **read
  back**, and the row shows "Written and read back", "Read-back differs" or "No reply". Operating mode and controller
  output need a second click (a wrong value can cut the USB link; restorable from the front panel).
- Write format verified on hardware on 2026-10-13: `F0 00 20 32 7F 64 <cmd> <value> F7`, the single layout the
  official editor builds for all 17 globals; Clock rate out 24 → 48 → 24 PPQ, by script and through the app.

## [0.8.0] — 2026-10-12

- Config "Device settings" reworked: stacked layout (option, buttons, then a full-width table) instead of a row.
- Every setting is now a choice list with all its values (official labels where known), next to a "BCR32" column with
  the value read; a row whose choice differs from the controller is marked. Footswitches, startup mode, operating
  mode, output port and MIDI thru are the same values as the Config fields (changing one changes the other); the
  other settings (clock, sync, scale, transpose, trigger, quantization) are kept in the profile (`deviceValues`).
- Still nothing written to the controller apart from the LED brightness.

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
