# BCR32 Studio · MIDI Studio edition

Browser editor for the **Behringer BCR32**, with controller firmware **1.0.2** support, **1.0.3 sequencer step editing**, and the shared MIDI Studio editor tools.

Current version: **0.45.0-alpha.12** · [Changelog](CHANGELOG.md)

The product presentation is at `/`; choose **Open editor** to enter `/editor/`. Existing local presets remain on the same origin. The presentation page never requests MIDI access.

Firmware **1.0.3** adds automatic reading of 4 × 32 sequencer steps when entering Sequencer. Enable **Live step editing** after the read to send individual changes to the current edit buffer. No STORE is sent. Global/track settings, transport and slot transfers are not enabled by this integration. See [protocol and hardware evidence](docs/BCR32-PROTOCOL-1.0.3.md).

**[Open the editor](https://thelazygeekguy.github.io/bcr32-studio/)** · [Integration and limits](docs/controllers/BCR32-STUDIO-INTEGRATION.md)

## Controller editing

- Firmware identity and automatic CTRL assignment read on connection: 82 controls, eight fields each.
- Correct Program Change Bank Off and Toggle Off decoding, including encoder pushes.
- T1–T4 preset shortcuts and per-connection UI cache. The first visit reads the preset; subsequent visits use the cached edits. Use the explicit read action to refresh from hardware.
- Immediate CC/NRPN rotation assignment edits and Type OFF on buttons, pushes and rotations, each confirmed by an independent read. Disable immediate sending in Config to keep edits local.
- Preset action bar: **Read**, **Save**, **Export**. Choose the hardware destination and name when saving. Backup, save readback and working-preset restoration are included. Saving remains explicit.
- BCL import/export/capture and offline Zaquencer 4 × 32 step editing with SysEx export.

The common Studio host provides themes, language, screen/zoom settings, local history, monitor, preset library and instance-scoped storage. Documentation opens the BCR32 guide inside the editor. This repository distributes the BCR32 module only; the other MIDI Studio modules remain in their own development or release repositories.

Use a current Chromium browser with Web MIDI and SysEx permission, over HTTPS or localhost. Select the controller/CTRL port, not ZAQ. Controller operations require a fresh firmware 1.0.2 identity. No account or server-side preset storage is used.

## Local development

```sh
npm ci
npm test
npm run dev
npm run build
npm run preview
```

The production build includes the BCR32 module and preset library and verifies its source inventory. The optional native MIDI dependency is used only by local tools. On Linux, install the ALSA development headers before `npm ci`.

Browser regression scripts in `scripts/e2e-studio-bcr32-*.cjs` use simulated Web MIDI and never access physical devices. Provide Playwright through `PLAYWRIGHT_CORE`, start the local preview, and pass its URL as the script argument. They cover automatic reads/live edits, the four captured preset push fixtures, T1–T4/cache and preset backup/save/readback/restoration.

## Evidence and limits

Type OFF was physically tested on rotation 1, button 16 and encoder push 1 on firmware 1.0.2/device 00: independent confirmation in 163–165 ms, all original fields restored, no STORE. The explicit preset-store workflow was previously tested on the authorized preset 63. These are limited device observations, not certification of every combination or power-cycle persistence.

Other button/push assignment setters, MMC decoding, full global restore, factory reset and firmware upload are not enabled by this release. Unsupported assignments remain raw with a visible warning. A complete migration from the legacy checkpoint bridge to one headless state authority is still pending.

The legacy public address https://bcr32-studio.github.io/ forwards to the editor above. Existing presets stay on their browser origin; use export/import when moving between origins.

## Deployment

GitHub Actions runs the tests, type check, production build and generic publication-data scan. The Pages workflow deploys the resulting static files. No Cloudflare change is required for this release.

[MIT license](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md)
