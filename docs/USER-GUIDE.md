# BCR32 Studio — user guide

BCR32 Studio is a browser editor for the Behringer BCR32 MIDI controller. It shows the controller as a live front
panel, lets you describe what every control sends, reads the controller's own settings, reads its preset exports, and
produces documents (PDF overlays, Cubase surface script). Everything runs in your browser.

> **What it does not do (yet):** write control assignments into the controller's memory. The protocol for that is not
> fully understood and a wrong write can damage a preset. Writing the controller's global settings is also disabled
> since a write froze a unit. See [PROTOCOL.md](PROTOCOL.md).

## Contents

1. [Getting started](#getting-started)
2. [The front panel](#the-front-panel)
3. [Control tab: assignments](#control-tab-assignments)
4. [MIDI Learn](#midi-learn)
5. [Screens: OLED, label screen, activity strip](#screens-oled-label-screen-activity-strip)
6. [Presets tab](#presets-tab)
7. [Files tab](#files-tab)
8. [Config tab](#config-tab)
9. [Log tab](#log-tab)
10. [Languages, themes, preferences](#languages-themes-preferences)
11. [Safety and privacy](#safety-and-privacy)
12. [Troubleshooting](#troubleshooting)

## Getting started

| Need | Detail |
| --- | --- |
| Browser | Chrome, Edge, Brave or Opera (Chromium). Firefox and Safari have no Web MIDI with SysEx. |
| Address | https://bcr32-studio.github.io/ — or `npm ci && npm run dev` for a local copy |
| Controller | BCR32 on USB, firmware 0.56.0 observed. The editor also opens without a controller. |

1. Plug the BCR32 in, open the page and accept the MIDI request (with SysEx).
2. The header shows **MIDI ready**, the Studio version and, once read, the controller firmware.
3. If the browser refused SysEx, press **Retry MIDI + SysEx** and allow it.

At connection BCR32 Studio, without writing anything:

- asks the product and firmware version (read-only query);
- reads the LED brightness;
- reads the controller's global settings (option, on by default — see [Config](#config-tab));
- enables **CC sending**: moving a control in the editor sends its MIDI value to the controller. Turn it off with
  the "CC sending" button at the top of the side panel.

## The front panel

The left part of the window is the BCR32: 32 rotary encoders (each with a push), 16 programmable keys, T1–T4, the
right-hand keys, the OLED and the SELECT knob.

- **Click** a control to select it; its settings open in the Control tab.
- **Cmd/Ctrl + click** adds or removes a control from the selection; **Shift + click** selects a range;
  **Multi-select** lets the mouse add controls one by one; dragging on the panel background draws a selection
  rectangle (in multi-select).
- **Double-click** (or F2) a label to rename it. Your labels are printed on the PDF overlay and shown on the label
  screen.
- LED rings show the current value with the ring mode of each encoder. A key is dimmed when it is unassigned; the
  selected key is shown at full brightness.
- The numbers above encoders and keys can be hidden (Config > Show control numbers).
- Search a control by name, number or type with the search field of the Control tab.

## Control tab: assignments

The Control tab edits the selected control(s). An encoder has two parts: **Rotation** and **Push**.

| Setting | Values |
| --- | --- |
| Type | Off, CC, NRPN, Pitch bend, Aftertouch, Program change, GS/XG, Note (keys and pushes), MMC (keys) |
| Channel | 1–16 |
| Parameter | 0–127 (CC, note, PC), 0–16383 (NRPN); Parameter Off for a CC key that sends nothing |
| Minimum / maximum | range of the values sent; Minimum Off for a PC key |
| Rotation modes | Absolute, ABS 14-bit, REL1, REL2, REL3, R1-14, R2-14, R3-14, INC/DEC |
| Key / push modes | Tog Off (momentary), Tog On (toggle), Inc (step per press −127…+127) |
| LED ring | Off, 1dot_in, 1dot_ex, 2dot_in, 2dot_ex, Bar, Bar−, SPRD, Pan, Qual, Cut, Damp |
| Display | On/Off: whether the controller's screen shows this control |
| Aftertouch | All (channel pressure) or one note (keys) |
| MMC | device ID, command (Play, Pause, Stop, Forward, Rewind, Locate, In, Out), locate time, frame rate |

- **Several selected controls**: a field changed is applied to all of them; fields that differ show as mixed.
- **Value**: the slider or the OLED (arrows, double-click to type) sets the local value; with CC sending on, the
  value is sent to the controller. The controller does **not** take received CCs into account for its own encoder
  values (observed on firmware 0.56.0), so its next turn continues from its own value.
- **Test press / release** sends a key's press and release.
- **Parameter names**: the parameter picker uses a table of names (CC 1 = Modulation, CC 74 = Cutoff…) that you can
  edit, import and export in the Files tab.

## MIDI Learn

1. Select a control, press **Learn**.
2. Move or press a control on any MIDI device (the BCR32 or another).
3. The first matching message fills type, channel, parameter and mode. 14-bit pairs and NRPN sequences are recognised.

Press Learn again or Escape to cancel. A value out of range for the control is refused rather than clamped.

## Screens: OLED, label screen, activity strip

- **OLED**: shows the control being moved — type, number, value, channel, and where the value comes from (MIDI
  received, local, estimated for relative modes).
- **Several encoders at once**: like the hardware, the screen is shared between the controls being turned, in
  proportion to their messages, in readable slots of 300 ms. A knob you stop turning gives the screen up after 100 ms
  of silence, so the screen follows the next knob at once. The inspector only follows once the movement settles.
- **Activity strip** (Control tab): up to four controls currently moving, with value and share of messages; click one
  to select it.
- **Label screen** (Config, off by default): a half-height screen above the OLED with the label of the control shown
  (your label, else the name printed on the panel).
- **Zoom while adjusting** (Config): the OLED, the label screen and the encoder grow while a value changes.
- **Display style** (Config): Ice OLED, Amber VFD, Green LCD, Red LED, White OLED, each with a live preview.

### Floating display

**Floating display** (top of the side panel, Chrome/Edge 116+) opens a small window that stays above every other
application — a DAW for instance. Move it anywhere, resize it: the label screen and the OLED scale with it and follow
the controls you turn, as in the editor. Close it with the same button or its close box. Its display timers run in the
floating window itself, so it keeps up when the editor's tab is in the background. It needs the editor page to stay
open (any tab, any window).

### Sharing the MIDI port with a DAW

| System | Can the DAW and BCR32 Studio use the BCR32 at the same time? |
| --- | --- |
| macOS | Yes: CoreMIDI lets several applications open the same port. |
| Linux | Yes: the ALSA sequencer is shared by design. |
| Windows | With the MIDI service of recent Windows 11 versions, yes for class-compliant devices such as the BCR32. With older drivers a port is used by one application only: open the BCR32 in the DAW or in BCR32 Studio, not both. |

The floating display shows what the controller sends (control, value, MIDI command, your label). It does not know the
function a DAW assigned to that control.

## Presets tab

- The current state (assignments, labels, values, ring mode) is kept as a **draft** in the browser and survives a
  reload; a `*` after "Presets" means unsaved changes.
- Choose a preset in the list to load it; **Create preset** / **Save / rename** and **Save as new** manage the local
  preset library (name field above).
- The A4 PDF overlay with your labels and assignments is downloaded from the Files tab.

## Files tab

| Section | What it does |
| --- | --- |
| Parameter names | edit, import and export the parameter-name table |
| Export draft JSON / Import preset or bank / Export library | exchange presets as JSON files |
| A4 PDF sheet | the printable overlay |
| **Front-panel export** | listens while you export from the controller and decodes it (see below) |
| **Cubase · MIDI Remote** | downloads `Behringer_BCR32.js`, a surface script for Cubase 12 and later |
| Legacy profile format | old v1/v2 profile files |

### Front-panel export

The controller can send its presets as SysEx. Do the export on the controller while this tab is open:

- **Current preset**: STORE, hold SELECT, press encoder 1, then encoder 8.
- **All 64 presets**: STORE, hold SELECT, press encoder 1, then encoder 7.

BCR32 Studio then shows each received block (block number, checksum, the 11 records of the block), groups an
all-presets export by preset and rebuilds a preset once its 8 blocks have arrived. **Apply** copies a record into the
editor when its control is identified on hardware — today only record 0 of block 0 (encoder 1): type, channel,
parameter and range. **Save the export (.syx)** / **Save all exports** keep the raw data. Nothing is sent to the
controller.

### Cubase export

Copy `Behringer_BCR32.js` into `Documents/Steinberg/Cubase/MIDI Remote/Driver Scripts/Local/Behringer/BCR32/`, reload
the scripts in Cubase, then assign functions with Cubase's Mapping Assistant. The script describes the surface and the
exact MIDI of every assigned control; types without a Cubase equivalent (program change, GS, MMC, polyphonic
aftertouch, relative NRPN…) are listed as not bound. Not yet checked in Cubase.

## Config tab

| Section | What it does |
| --- | --- |
| Theme | six themes for the panel and the interface |
| Zoom while adjusting, Show control numbers, Label screen | display options, remembered per browser |
| Display style | the five screen styles |
| **Device settings** | the controller's global settings (below) |
| Controls & footswitches | the right-hand keys and the footswitch functions (CTRL programmable, ZAQ start/stop or next pattern) |
| LED brightness · hardware | reads and writes the controller's LED brightness (0–15), verified on hardware |
| Output routing, MIDI Through, General settings | the controller settings as the editor knows them |
| Connection and probe | MIDI input and output ports, SysEx permission |

### Device settings

- **Load the settings from the BCR32 at connection** (on by default) reads the 18 global settings with the same
  short requests the official editor sends, and puts them into the Config fields. Off: **Reset to editor defaults**
  appears. **Read from the BCR32** reads again at any time.
- The table shows every setting as a choice list (official labels when known) next to a **BCR32** column with the
  value read. A choice that differs from the controller is marked "≠".
- Footswitches, startup mode, operating mode, output and MIDI thru are the same values as the fields lower down.
- **Writing is disabled**: it froze a controller on 2026-10-13. Values chosen here stay in the editor.
- Clock output port, scale and quantization mixer are shown as raw numbers (no reliable list); MIDI thru labels above
  3 are uncertain (the manual lists 15 destinations).

## Log tab

The last MIDI messages received, with a readable description ("Recent messages"). Clock and active-sensing messages
are not logged. The activity LEDs on the panel (MIDI in, A, B, footswitches, USB) flash with the traffic. Ports and
the SysEx permission are in Config > Connection and probe.

## Languages, themes, preferences

- Eight languages: English, French, Italian, German, Japanese, Spanish, Russian, Chinese. By default the interface
  follows the browser; the language menu (文A, top right) overrides it and is remembered.
- Preferences (theme, language, display options, automatic settings load, display style) and your presets stay in
  the browser's local storage. Clearing site data resets them.

## Safety and privacy

- BCR32 Studio never sends STORE (`0x72`) or bootloader/firmware (`0x77`) SysEx; a test fails the build otherwise.
- The SysEx it sends: the product query, the brightness read/write, the 18 global-setting reads. Everything else is
  MIDI values (CC, NRPN, notes) from your gestures.
- No account, no server, no analytics. The page is static; nothing you do leaves your browser.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| "Permission to use Web MIDI API was not granted" | allow MIDI with SysEx for the site in the browser, then Retry MIDI + SysEx |
| No BCR32 found | check the USB cable (data socket), close other software holding the port, unplug and replug |
| Several BCR32 | choose the input and output in Config > Connection and probe: the editor never picks one arbitrarily |
| A value jumps when you turn the hardware encoder | expected: the controller ignores received CCs for its own values |
| Controller frozen | switch it off and on; global writes are disabled in the app |
| No export received | check that the Files tab is open and the controller is in CTRL mode, then repeat the procedure |


## Firmware tools: BCL and Zaquencer

Open **Files → Firmware tools · BCL and Zaquencer**. Open an eight-block pattern `.syx`, edit a track's steps and
save the edited `.syx`. Notes, velocities, delays, gate codes, Alpha/Beta, voice/chord words and masks are available;
raw fields have no assumed musical label. Gate and velocity bits are preserved independently. Save before closing
or reloading the browser. A newly opened pattern file replaces the current pattern workspace.

For controller presets, open/edit `.bcl` or BCL `.syx`, and save text or a SysEx file. Capture can listen to device
BCL exports. Explicit controller/track parameter and BCL reads become available after a live firmware 1.x product
response. These operations do not change assignments. There is no new device-write button; saved files need the
hardware validation described in [the integration notes](FIRMWARE-1.0.2.md) before live import is added.
