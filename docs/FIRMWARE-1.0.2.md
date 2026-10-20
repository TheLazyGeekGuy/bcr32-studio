# BCR32 firmware 1.0.2 support

This release uses the controller/CTRL endpoint. ZAQ/Zaquencer ports are excluded from controller operations. The observed unit exposes one CoreMIDI pair. A live product reply supplies firmware and addressed device ID; imported metadata is only a last-known observation.

## Assignment synchronization

The initial controller read requests eight indexed fields for each of 82 targets, sequentially with pacing. Targets 0–15 are buttons 1–16, 16–47 are encoder pushes 1–32, 48–49 are footswitch assignments and 50–81 are encoder rotations 1–32. The editor keeps its internal logical IDs separate from those physical labels. T1–T4 are preset shortcuts, read from the global `.tracks` state rather than indexed assignments.

The eight fields use commands 0x31–0x38: type, channel, parameter, first value, second value, mode, option/LED and display. Read framing and setter framing differ. Raw unknown/sentinel fields are retained; they are not evidence for invented assignments. PC Bank Off is distinct from a disabled assignment. Unsupported MMC/custom assignments remain raw with a warning.

The connection-local cache preserves UI edits when revisiting T1–T4. An explicit read refreshes hardware data; reconnection clears the cache. Unobserved manual changes on the device are deliberately ignored by a warm UI cache.

## Immediate writes and explicit saving

Immediate assignment sending is enabled by default unless disabled in Config. The accepted paths are CC/NRPN rotation settings, plus an explicit Type OFF (0) for indexed controller targets. OFF changes no dormant fields, cancels older pending edits for that target and takes the next available queue slot. A setter echo is ignored: an independent GET after the settling interval must match. Failure, timeout, locking, rebind or closure stops pending work. No automatic retry is used.

Other button/push configuration setters remain local. Rotation reactivation from OFF supports the existing CC/NRPN path, configuring dormant fields before the type. This is separate from performance value sending.

Preset saving stays manual. The Save action asks for a destination 1–64 and name, backs up controller data, writes a complete validated BCL job, reads back the saved contents and restores the working preset. It stores fresh device contents; unsent local assignments are not implicitly uploaded. Raw STORE/reset, full global restore and firmware upload are not enabled by this release.

Do not use the historical legacy-brightness command as a generic write on firmware 1.0.2: the same command number participates in preset requests. The module classifies whole packets and operation grants, not just a command byte.

## Evidence boundary

The command-map and parameter JSON files are retained static-analysis inventories, not a manufacturer protocol specification or hardware certification. Local readback tests separately confirmed CC/NRPN rotation settings, an explicit preset 63 save/readback/restoration, and OFF on rotation 1, button 16 and push 1. The OFF tests read zero in 163–165 ms and restored all eight original fields without STORE. A footswitch was not physically tested. No power-cycle persistence claim is made.

The reproducible software scenarios and remaining migration limits are listed in [BCR32 Studio integration](controllers/BCR32-STUDIO-INTEGRATION.md). Public release sources are a BCR32-only extraction of the tested MIDI Studio integration; other development modules and private research inputs are excluded.
