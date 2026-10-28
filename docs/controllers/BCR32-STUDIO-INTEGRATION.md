# BCR32 firmware 1.0.2 in MIDI Studio

> Version boundary: `0.45.0-alpha.12` adds a separately gated **1.0.3 sequencer step protocol**. See [the 1.0.3 integration reference](../BCR32-PROTOCOL-1.0.3.md). Existing 1.0.2 BCL/controller write/store permissions described below are not automatically extended to 1.0.3. The standalone editor now opens at `/editor/`; `/` is the product presentation.

The BCR32 catalog entry now opens the firmware workbench inside the current Studio host. BCR2000 and BCF2000 keep their existing implementations and independent distribution entry points.

## Use

Open BCR32 from the editor palette or select `?editor=bcr32-editor`. Use the CTRL port pair, with firmware 1.0.2. The initial controller read includes 82 targets and eight fields per target. T1–T4 recall preset assignments from the connection-local UI cache after their first successful read. An explicit read refreshes the current preset. A connection change invalidates the cache.

The Presets page separates controller memory from browser copies. Its action bar exposes Read, Save and Export. Hardware saving asks for a destination and name, backs up the controller, reads back the saved preset and restores the working preset. A browser draft is not implicitly written to hardware. The original transfer pacing and acknowledgement checks remain in place.

Shared Studio tools include themes, language, presentation settings, screen rendering, local history, typed library exchange, MIDI monitor and local parameter endpoints. Documentation opens the local BCR32 guide. Presets, preferences and monitor state belong to the editor instance. Rearranging assignments remains a local action. Track shortcuts cannot be rearranged as programmable buttons.

## Transport boundary

The view borrows a Studio MIDI lease. It never opens physical ports directly or installs a raw physical input handler. CTRL matching excludes ZAQ. Indexed reads and configuration writes require a fresh 1.0.2 identity on the current connection. Writes require the addressed device, the appropriate operation grant and an unlocked editor. Complete BCL jobs are checked before their first packet; their exact frames are then consumed in order, once, on the same connection generation. Closing, locking or rebinding revokes the job.

This integration carries the existing verified encoder CC/NRPN assignment writer and explicit preset STORE workflow. Explicit Type OFF changes are also sent immediately for indexed controller buttons, pushes and encoder rotations, with independent readback; no other field is changed. It adds no MMC decoding, generic button assignment writer, firmware updater, reset or full global restore. Unsupported controller assignments remain visibly unsupported and retain their raw replies.

## Evidence and migration limits

Offline unit tests replay 128 push assignments captured across four presets, including PC Bank Off and Toggle Off. Browser tests use simulated Web MIDI only: auto-read and live encoder settings, shortcut/cache behavior, preset backup and save/readback/restoration, and two BCR32 instances alongside FireworX. The subsequent OFF correction was physically tested on encoder rotation 1 (target 50), button 16 (target 15) and encoder push 1 (target 16), firmware 1.0.2/device 00. Each Type OFF read back as zero in 163–165 ms; the original type was restored and all eight fields matched their originals. No STORE was sent. This is not a power-cycle persistence test.

The module reuses the existing B-Control workbench through a model-specific compatibility adapter and the existing host checkpoint bridge. This is not completion of the larger migration to a single headless state authority. The copied codecs are a compatibility boundary; replacing them with a shared implementation needs a separate compatibility audit. Existing structured PC metadata is retained in state, but this integration does not add a dual-bank PC editing/sending implementation.

## Reproducible checks

- `npm test` (includes `scripts/test-studio-bcr32.mjs` and TypeScript)
- `npm run build`
- This public edition builds BCR32 only with `npm run build`; other-module distribution checks run in the development integration checkout.
- Browser scripts: `scripts/e2e-studio-bcr32-{autoread,presets,pushes,tracks}.cjs`, with Playwright available through `PLAYWRIGHT_CORE`.

The integration was read and tested by the primary Codex agent on 2026-10-20, against base commit `b579ce9bc213756745494d332a5549be3d59f4d8` plus inherited uncommitted Studio changes and the uncommitted BCR32 integration. No sub-agent reviewed it. The runtime does not expose an exact model identifier or reasoning setting, so agent-version traceability is incomplete. The local delivery report records the file hashes and test time. GitHub publication, merge and deployment are separate gates.
