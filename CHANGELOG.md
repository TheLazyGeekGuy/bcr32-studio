# Changelog

## [0.46.0-alpha.7] — 2026-10-29

- Publish the SXM format reference at `/docs/sysex-map/`: specification, architecture, integration guide and 20-synth catalogue, rendered from the tracked Markdown sources.
- Add site navigation/footer links and downloadable schema, examples, Python renderer and standalone ES module. Documentation pages and downloads are included in the offline build inventory.

## [0.46.0-alpha.6] — 2026-10-29

- Specify the open SysEx Map (SXM) 1.0 draft: portable parameter definitions, destination fields, value slices, checksums, optional saved values/origins, source evidence and extension metadata in `.sxm.json`.
- Ship a JSON Schema, independent TypeScript/Python renderers and conformance vectors. No transport or executable code is embedded in the format.
- Migrate the 20-model/46-parameter catalogue to a single SXM definition source. Preserve existing BCL/SysEx behavior through a capability adapter.
- Import/export full catalogues, synths or individual parameters with preview values from the existing UI; export the schema. Validate before replacement and retain imported catalogues through the editor's injected storage. No hardware sends on import/export.

## [0.46.0-alpha.5] — 2026-10-29

- Add an offline, searchable SysEx catalogue for 20 synth models and 46 parameter/request templates, including Microwave I/II, Blofeld, TX81Z, DX7, AN200, FS1R, Juno and DW models.
- Configure destination channel, Device ID, scene and part where documented; preview bytes and load the selected template into the current rotation or push draft with a separate Undo step. Loading sends no MIDI.
- Keep original Microwave checksum BCL file-only; preview its additive checksum locally without expanding native transfer permissions. Every model carries manufacturer sources and operating prerequisites.
- Load the catalogue in a separate chunk only when opened. Standard CC/BCL editing remains independent of its data.

## [0.46.0-alpha.4] — 2026-10-29

- Put SysEx and BCL in the Control tab's MIDI message Type selector for encoder rotations and pushes. Show the corresponding editor on selection and hide standard fields while editing a custom draft.
- Preserve unapplied source when switching representations or returning to a standard type; reject representation changes with invalid hex. Remember the selected representation for applied custom programs.
- Type selection and local editing do not send hardware commands; explicit transfer and STORE actions remain separate.

## [0.46.0-alpha.3] — 2026-10-29

- Validate real firmware1.0.3 STORE → alternate preset → recall/read-back for custom encoder rotation and push assignments; restore all64 slots, globals and the working preset exactly.
- Enable the existing backed-up preset STORE and shortcut-selection paths on exact firmware1.0.3, including native `.minmax` preset lines.
- Fix push/button custom programs: omit encoder-only `.default` in the UI example, refuse it before sending, and preserve the observed native `.mode down`.
- Keep STORE explicit. Actual emitted custom MIDI and power-cycle persistence remain separate acceptance gates.

## [0.46.0-alpha.2] — 2026-10-29

- Add explicit selected-control BCL reads and custom SysEx uploads from the Control inspector on firmware1.0.2/1.0.3.
- Back up the current hardware preset before the announced Type OFF transition; independently verify the resulting BCL and other controls.
- Add explicit original-control restoration and backup download. Unknown/advanced programs remain file-only; no automatic upload or STORE is added.
- Preserve existing1.0.2 preset-store gates;1.0.3 permits only qualified single-control fragments, not complete preset/global jobs.
- A temporary encoder32 upload/read-back/restoration passed on real firmware1.0.3 with the full original preset restored; emitted custom MIDI and persistent storage remain unverified.
- Recognize the known ring modes returned by native custom exports while retaining alpha1 opaque draft compatibility.

## [0.46.0-alpha.1] — 2026-10-29

- Local BCL/SysEx programming in Control: structured templates, hex↔BCL, bounded value/slice simulation, min/max/default, original imported bytes, targeted BCL/SYX files, text history and existing preset/history integration. Unknown/advanced constructs stay opaque; no custom hardware sender is enabled.
- Reuse the existing BCL document parser through a neutral shared module and its old exports. Add explicit BCR32 model64/revision/selector bounds without silently remapping historical BCR2000/BCF2000 files.
- Preserve comments/source and custom/opaque JSON definitions. Custom programs are not OFF: standard assignment/OFF writes, CC emission and false Cubase bindings are refused; indexed hardware reads do not replace the local program.
- ControlTribe1.12.4 static analysis confirms the app's BCL validator/framing and the native Type OFF prerequisite for tx. This is not physical execution proof; no firmware whitelist, grant, STORE, sequencer or global-writing capability is expanded.

## [0.45.0-alpha.17] — 2026-10-28

- Correct high-tempo clock estimation: a rolling clock-index/time regression replaces the median of individual gaps. At 300 BPM, 9/9/7ms arrival intervals no longer misleadingly report 277.8; a slightly-above-300 measurement no longer freezes an old estimate.
- Preserve optional Web MIDI source timestamps through the shared broker, legacy access wrapper and BCR32 receive path, with arrival-time fallback for older synthetic providers. Clock and transport bytes bypass unrelated assignment/Learn decoders.
- Playback markers paint the latest received step once per animation frame; isolated tempo/status subscribers replace full sequencer reconciliation on every step. No synthesized clocks, extrapolated steps, MIDI writes or device-setting changes are introduced.
- Input-only physical capture confirms 960 ticks in eight seconds, approximately 300.04 BPM. Source-hashed replay and quantized/batched 300-BPM regressions are included; physical Firefox alignment remains an acceptance gate.

## [0.45.0-alpha.16] — 2026-10-28

- Passive playback cursors use the physical BCR32's Start/Clock/Stop stream and its independently read track timing. Separate markers in grid, lanes, piano roll and table never move the edit cursor or send MIDI. Clock alone after attaching mid-playback does not invent a start phase; stale clock, Stop, rebind, local draft or new snapshot clears the phase.
- Cursor qualification currently covers forward, unshuffled tracks with no skipped step in the active sequence. Unsupported tracks remain visibly unavailable. Unknown timing values are preserved rather than granted an invented cursor.
- Narrow read-only `46 01 track field` queries obtain start/length/offset/divider/shuffle/direction (28 replies). Missing optional timing does not disable successful step reads/live edits. BPM shows observed MIDI clock tempo, read-only on hardware sessions, not the unrelated local preview tempo.
- Physical proof: one Start, 71 clocks and one Stop captured persistently; replayed in offline tests. Browser tests cover four independent heads, all views, selection preservation, Stop/stale clearing and no writes. Visual alignment against the physical BCR32 still needs user acceptance. UI Play/Stop and Space remain gated: the previous remote-CC test did not establish a working command.

## [0.45.0-alpha.15] — 2026-10-28

- Follow an actual hardware pattern/context change with an automatic atomic reread while live editing is armed. Do not reselect the hardware page during playback, send step writes or replace an explicitly paused local draft. Serialize the refresh with any pending state poll/edit.
- Show note names directly in the Pitch lane, separately from Chord codes; add actual value text/tooltips to lanes.
- User acceptance confirms the physical Controller/Sequencer switch and hardware-to-UI running-state feedback. This does **not** confirm UI transport commands or an in-pattern playhead.
- Authorized targeted `48 00 + boolean` transport experiment was refused with status `07`; no transport writer is enabled. Physical PAT'N CH is Off; Clock Out read as 0. No step position or clock was received during the bounded passive capture. Play/Space and exact playhead remain open, pending the separate explicitly requested MIDI-routing test.

## [0.45.0-alpha.14] — 2026-10-28

- Seven editable numeric sequencer lanes: Pitch, Velocity, Length, Delay, Ctrl A, Ctrl B and Chord. Mute and Skip remain per-step flags. Native Chord codes are bounded to 0–55; unknown legacy words remain lossless on reads but cannot be written as arbitrary chords.
- Selective MIDI import: only the current destination is selected initially; explicitly select one or several T1–T4 destinations. Unchecked destinations are left unchanged. Timeline previews show only selected imports.
- Poll the hardware transport state once per second while idle, using the existing single-flight connection. Physical PLAY and track selection no longer invalidate a four-track pattern snapshot. Failed polls disarm live edits; no parallel port, clock stream or persistent write is added.
- Re-clicking the active Controller/Sequencer button reasserts its page command without discarding a local draft; returning to Sequencer still rereads the current pattern automatically.
- Playback control is **not fixed**: the standard MIDI clock test produced no note output. An explicitly approved host-state selector `01` experiment disproved the transport hypothesis: it selects the track. Initial state was restored; all 36 lanes remained identical. No guessed transport command is exposed. Play/Space remain disabled pending a verified control route.

## [0.45.0-alpha.13] — 2026-10-28

- Switching to Sequencer now sends the native hardware page command `0B` before reading; returning to Controller sends `0C`. These are narrowly authorized page changes, never STORE or arbitrary SysEx.
- Successful automatic pattern reads enable live editing immediately, as requested. Explicitly pausing live edits, lock and failed reads still prevent step writes.
- Install the sequencer RX relay in a layout effect before any read effect; stop the parallel Controller assignment scan while using Sequencer. Timeout diagnostics now include command, expected device and received packet header/count.
- Real Chromium Web MIDI read of all 36 lanes succeeded against the connected 1.0.3 device. The reported Firefox failure remains a separate acceptance gate until retested in the user's session; no claim of a reproduced/fixed Firefox root cause.

## [0.45.0-alpha.12] — 2026-10-28

- Firmware 1.0.3 sequencer host protocol, recovered from ControlTribe 1.12.4 and checked against a physical BCR32: read all nine lanes of four tracks; opt-in live edits of note, velocity, mute, delay, length, CC A/B, chord word and skip. Reuses the instance MIDI lease; serializes edits and coalesces pending changes. Disconnect, lock, changed device state, missing replies or unconfirmed edits stop sending. No STORE, firmware update or legacy command 07.
- Hardware evidence: 36 lanes read; one temporary note change (60 → 61), independent read-back and restoration to 60, all confirmed. Other write fields have offline tests, not individual physical validation. Persistent sequencer storage, track/global editing and transport remain gated.
- Reused the existing BCR32 product presentation at `/`; moved the editor to `/editor/`, keeping legacy explicit editor/workspace query links. Assets, documentation and offline navigation resolve under both a domain root and a project subpath. The presentation does not initialize MIDI or load the editor bundle.
- Firmware/API provenance, capture fixtures, bounded hardware test tool and regression tests are documented. Existing firmware 1.0.2 write/store gates are not broadened to 1.0.3.

## [0.45.0-alpha.11] — 2026-10-24

BCR32 sequencer view (preview), preset store fixes and display options. Pattern transfer to and from the BCR32 is not
available yet: firmware 1.0.2 gives no verified way to read or send a pattern over USB.

- **Sequencer view** (Controller | Sequencer switch in the toolbar, full height): grid, piano roll and table for the
  four tracks × 32 steps; lanes for velocity, note length and start offset (drag to draw); step and track panels;
  bar accents on steps 1, 5, 9 … 29. Notes are named like the BCR32 display (C3 = MIDI 60), lengths use the manual's
  names (96 … 4b), the offset is limited to ±5 clock ticks as on the panel, and a new pattern starts with the BCR32's
  own defaults (C3, velocity 100, length 32).
- Step entry from the computer keyboard (A W S E D … K, Z/X octave, C/V velocity, M rest) or a MIDI keyboard chosen
  in the MIDI connection window.
- **MIDI files**: import with a preview window (choose a source track and a start bar for each of T1–T4, grid
  detection, timeline), export to a standard MIDI file. **.syx** import and export of `04 0B` pattern blocks.
- **Templates**: built-in grooves (303-style acid line, four on the floor, breakbeat, techno), your own templates
  saved in the browser, and a random pattern generator (scale, root, octaves, density).
- The Play button and Space start/stop stay disabled: the BCR32 1.0.2 ignores a MIDI clock received over USB (tested).
- **Toolbar**: the current preset name, double-click to rename, Enter or Store… to store it; option to switch to the
  sequencer view with the ZQR/CTRL key (Device tab, off by default).
- **Presets**: storing an initialized (empty) preset now works and uses a saved snapshot of preset 1 as its template;
  the read-back after STORE is retried. Press EXIT on the BCR32 if the stored preset does not show at once.
- Display menu: **Test mode** option (the Test block of the inspector is hidden without it); the floating display is
  again a borderless picture-in-picture window. Panel logo 30 % larger.
- Fix: the magnifier no longer covers the text of the control search.
- Documentation: one protocol reference for firmware 1.0.2 and the Zaquencer pattern layout with the level of evidence
  of each field; regression fixtures (MIDI and .syx) anyone can add to.

## [0.45.0-alpha.10] — 2026-10-24

- An open tab now finds a new deployment without being reloaded: it checks every 5 minutes while visible and when it comes back into view (at most once a minute), then shows "New version available" with "Update and reload". It never reloads by itself, so a MIDI session is never cut.

## [0.45.0-alpha.9] — 2026-10-24

- Presets › On this computer: the browser library is now a list instead of a drop-down. Drag a row, or use ↑ ↓, to reorder; the order is saved and kept by Export. Import sits next to Export: an imported file is appended as copies with new identifiers, never over an existing preset. Choosing a row only loads it into the editor; nothing is sent to the BCR32.

## [0.45.0-alpha.8] — 2026-10-24

BCR32 editor brought in line with the approved mockup (the owner found alpha.7 too far from it).

- Host header: the MIDI settings icon is a DIN connector.
- Toolbar: ↶ ↷, switches "CC → BCR32" and "Assignments → BCR32", ▣ Floating display, Display ▾, and the panel toggle at the right end.
- Display menu: round theme swatches, display style as a list, three options, "Use global presentation" as a checkbox; screen and floating window under one disclosure.
- Panel: text tabs with no connection line above them (the status lives in the header); a warning appears only when SysEx is missing. The status bar sums up assignments, read progress and CC sending, with the latest action below.
- Control tab in the mockup order: search, control kind and name, Rotation/Push, selection links, MIDI message, Display, Test, Advanced.
- Presets as cards (Synchronize assignments, BCR32 presets, T1–T4 shortcuts); Device with a sticky Read bar, warning box, link anchors and right-aligned BCR32 values; Files as cards; compact MIDI window.

## [0.45.0-alpha.7] — 2026-10-24

BCR32 sidebar reorganisation, steps 3 to 10 (study of 2026-10-24, approved by the owner).

- **Editor toolbar** above the front panel: Undo/Redo, Send CC to BCR32, Assignments → BCR32, the floating display and a **Display** menu (theme of this editor, display style, one "Zoom while adjusting" instead of two, control numbers, label screen, screen and scale). The host floating window is offered only where the BCR32 one is unavailable.
- **Device** tab replaces Config: every BCR32 global setting once, in open groups (footswitches, MIDI routing, mode, clock, sequencer, LED), with the editor value, the value read on the BCR32 and a ≠ marker, a filter and a "≠ BCR32" view; Device ID and bootloader status under Advanced. Global writes stay disabled. The tab is about half as long as Config was.
- **Presets › BCR32** gains "Synchronize assignments" (read now, status, Read options). Reading assignments and loading the device settings at connection are chosen in the MIDI connection window.
- **Files**: Export, Import and front-panel export blocks, then one Advanced disclosure holding the firmware tools, parameter names and the legacy profile format.
- **Help** is no longer a tab: Documentation opens it over the current tab, with Back.
- Narrow screens: the toolbar scrolls, the Display menu and the MIDI window open as bottom sheets, and the panel can no longer stay hidden by a collapsed state saved on a wide screen.
- Fixes: "On this computer" presets were squeezed into a narrow column; the help texts are translated; the connection line says when the BCR32 is not detected; the T1–T4 shortcuts are marked as writing the BCR32.

## [0.45.0-alpha.6] — 2026-10-24

- BCR32 sidebar, first steps of the reorganisation: the area above the tabs is now one line, the MIDI status (and the firmware once read) that opens the MIDI connection window, so the scrolling content gains 53 px at 1440×900 (590 → 643 px) even with the new status bar. Firmware read, controller output routing and the Studio version left that area: the first two are in the MIDI window, the version under the help.
- Action feedback is a status bar fixed at the bottom of the sidebar on every tab, instead of moving between the top, middle and bottom of the content.
- Narrow screens: the tabs and the status bar stay visible while scrolling a long tab.

## [0.45.0-alpha.5] — 2026-10-24

- MIDI settings icon beside the connection status (standalone and workspace hosts), as in the FireworX and M3000 editors. For the BCR32 it opens a MIDI connection window: MIDI/SysEx permission and retry, firmware read, input and output ports, CC sending and controller output routing. Opening it sends nothing; the Config tab links to it instead of holding the port selectors.

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
