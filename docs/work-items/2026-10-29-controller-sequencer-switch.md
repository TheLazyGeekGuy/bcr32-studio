# Unify controller/sequencer page switching

Status: export-based follow remains withdrawn. A replacement48/00 observer is implemented locally in0.46.0-alpha.12 and software-tested; paired physical mode replies are recorded. Physical return-to-CTRL and sustained key acceptance are still pending.

## Traceability

Codex primary agent, exact model identifier/effort unavailable, 2026-10-29 19:14–19:20 CET. Repository `bcr-studio-firmware-103`, branch `work/bcr32-bcl-sysex`, baseline full commit `886b8ac04ecc7f240c15d9e96d93f27f2467754b`. Read Workbench, FrontPanel, SequencerView, useSequencerHost, zaq-host, controller-presets and the sidebar/browser tests. Implementation changes to Workbench and those tests were uncommitted during verification. Outside Git: installed ControlTribe1.12.4 binary and bounded local disassemblies under `/tmp`; they do not establish an observed physical mode event.

## Confirmed correction

The on-screen ZQR/CTRL key previously used an opt-in, default-off preference and only set local editor state. It now calls the same `chooseEditorMode('sequencer')` action as the top toolbar. The obsolete preference and misleading view-only settings UI are removed. Existing lock/busy guards, qualified hardware page commands, sequencer automatic reads and nonpersistent operation boundaries remain unchanged. Native commands are `F0 00 20 32 7F 64 0B F7` for sequencer and `…0C F7` for controller. No STORE or new opcode is introduced.

The production build/typecheck, sidebar checks and full sequencer browser scenario with simulated MIDI passed. The extended browser scenario clicks the actual panel key, checks the selected view and outgoing0B, returns through the top Controller button and checks outgoing0C, then runs existing automatic read/edit/follow/cursor/import/no-STORE coverage. These tests do not prove the physical screen state.

## Physical direction still pending

The owner requested that a physical ZQR/CTRL press also switch the editor. An input-only recorder was opened at19:14 CET, and controller/global polling was suspended by selecting Files. The owner was asked to press once and identify the resulting physical mode. No confirmed physical-button event or resulting mode has yet been received at this checkpoint. A development hot reload briefly restarted ordinary assignment reads; Files was reselected afterward. Do not classify those query responses as a physical mode change.

Do not infer current page from `.startup`, the USB operating mode, the sequencer running flag or an outgoing page command. Receipt-driven navigation must not echo page commands or reassert the previous page through automatic readers. Complete the physical capture and strict parser/context tests before claiming bidirectional page synchronization.

## Physical CTRL confirmation — 19:49–19:56 CET

Codex primary, exact model/effort unavailable; full source commit `f244b7596cfdd2997174d7ad6926271592bb824e` plus the uncommitted passive-listener helper change. The previous600-second recorder had expired before the delayed owner reply, so no claim is made about that gesture. `scripts/hw/bcr32-listen-all.mjs` now supports0 seconds (until interrupted), SIGINT/SIGTERM cleanup and no automatic expiry. It opens only a native input; no output port exists in that recorder. The separate bounded diagnostic below opens an output solely for identified read requests.

A fresh indefinite listener was active before the owner confirmed physical ZQR→CTRL. No unsolicited MIDI was captured. A single product query then produced the expected1.0.3 response in that same listener, establishing that the input was functioning. No page selection or STORE was sent.

ControlTribe1.12.4 binary SHA256 `8715b0703ad62a923822deb8b4f3c8eb5943d865f30f70b71940b3c3a44e5d6e`, function `BCR32::ExportCurrentPage` at0x1005b8e70, constructs exactly `F0 00 20 32 7F 64 08 F7`. A bounded read in owner-confirmed CTRL returned a273-byte04/0C kind2 packet; a separate full capture passed the16-bit nibble checksum (2368), block1. Consecutive requests returned blocks0 then1, so this may be a stateful export continuation rather than an independent current-mode query. **Do not yet wire this request to periodic automatic mode detection.** Need the same comparison after owner-confirmed ZQR, with no forced page selection, before claiming its mode meaning.

Raw local evidence: ignored `output/hw/2026-10-29T18-50-07-198Z-all.log` and `mode-ctrl-08.syx`. A physical ZQR step is pending. Existing UI→hardware unification remains software-tested; hardware→UI synchronization remains incomplete.

## Qualified mode read and local follow implementation — 19:59–20:06 CET

Codex primary, exact model/effort unavailable, baseline `aca7584f7669e889b5426f0de53fe2efa9cc278a`, plus uncommitted page-follow, Workbench, ControllerPresets, SequencerView/useSequencerHost, host-policy, fixture and test changes. The owner confirmed ZQR without an app page command. The same08 read produced a273-byte04/0B kind2 packet, compared to04/0C in owner-confirmed CTRL. Both full packets pass checksum validation. Ten further native reads at1Hz returned ten valid ZQR responses across block7→next page/block0. Thus the export cursor advances, but the compared header follows the actual hardware mode. The raw payload is not imported or published; the filtered fixture records headers/checksums/hashes only in `scripts/fixtures/page-follow-103.json`.

Implementation: a per-view, single-flight follower on the existing selected MIDI pair sends only the exact8-byte read08, at most once per second while the editor is idle. It validates full273-byte kind2 framing, checksum and the known CTRL/ZAQ codecs before changing view. A received mode invokes navigation only; explicit panel/toolbar clicks invoke the hardware command. Automatic pattern reads opt out of selecting the sequencer page; automatic BCL reads opt out of forcing CTRL. Recent UI requests invalidate old pending observations. The follower pauses for preset/device/assignment writes, consumes its own response without filling the manual-export/value paths and closes all timers with the connection. Standard queued assignments are confined to the Controller view. Background-browser throttling can extend the observation delay.

Validation: strict parser/query/pending/timeout/pause/disposal tests pass; all57 unit scripts and TypeScript pass; production build passes. The real-browser simulated-MIDI scenario now changes the hardware mode variable without emitting an event, waits for read08 detection in both directions, and verifies zero additional0B/0C commands from received changes or automatic reads. It also retains panel/toolbar, automatic pattern reads, edits, playback/follow and selective-import coverage.

A real local Firefox session began sequencer pattern reads after observing the owner's ZQR state. Explicit visual acceptance of the final physical CTRL transition was requested and remains pending at this checkpoint. This is not a blanket firmware qualification or a claim of preserving another application's simultaneous legacy export cursor. Mode reads advance that cursor; exclusive port ownership and pauses during Studio transfers remain relevant.

At20:08 CET, an additional bounded native probe sent130 known read08 requests at100ms intervals while the Studio follower remained active. It observed134 sequencer responses including concurrent Studio reads, and a complete export-cursor wrap. No page, assignment or STORE command was sent by this probe. This establishes continued replies across the cursor boundary for the captured1.0.3 case, not an isolated latency benchmark. The application remains limited to at most1Hz idle polling. Final57/57 tests/typecheck and the alpha.10 build pass; the extended browser follow scenario passes in both directions without page-command echo. User confirmation of the visible physical CTRL transition is still pending.

## Physical acceptance failure and immediate withdrawal — 20:10–20:13 CET

Codex primary, exact model/effort unavailable; read full commit `7c6790ca02db8df115e5f58f862252143c359231` plus the uncommitted withdrawal patch. The owner clarified that explicit UI mode selection works, while the physical mode key is blocked. Export08 polling was stopped immediately in the local runtime; the pending alpha.10 Pages publication40937690745 was cancelled. The owner then confirmed: the physical key becomes usable again, while physical changes no longer drive the UI. This is a failed hardware-acceptance gate for the export-based follower, irrespective of the passing fake-MIDI and checksum tests.

The automatic follower implementation is removed, not merely hidden behind an option. Exact read08 is removed from the Studio query validator. The captured-export parser remains inert research evidence. The panel/toolbar explicit UI actions and read-only BCL/pattern behavior remain. No further hardware probing, new opcode, STORE or firmware action is used for this withdrawal. Physical-key-to-UI following is deliberately unavailable pending a genuinely nonblocking status mechanism. Previous claims that the repeated export was a qualified background status request are superseded by this observed side effect.

Lesson: an operation that leaves presets unchanged can still monopolize a transfer/UI state or advance a cursor. A background read requires physical acceptance with the device mode key and ordinary controls exercised during sustained monitoring, as well as data integrity, bounded traffic and disposal checks. Repeat this gate across transfer boundaries and with the app idle/backgrounded. Never substitute valid replies or a software-only test for front-panel availability.

Withdrawal completion at20:15 CET: all57 unit suites and TypeScript, production build, browser Controller/Sequencer/manual-panel/step/follow/import regression scenario, explicit zero automatic08 assertion, generic leak scan and whitespace checks pass. The alpha.10 Pages run is confirmed completed/cancelled, not just requested. The passive native recorder was closed after acceptance evidence was retained; no diagnostic output writer remains active. The owner confirmed recovery of the physical key after stopping exports. Physical-key-to-UI follow is not delivered by this correction.

## Reopened physical-to-UI defect — 20:24–20:26 CET

Owner report: the physical ZQR/CTRL key no longer changes the Controller/Sequencer view. Status remains **open**, not fixed by alpha.11. The withdrawal recovered the physical key's availability but deliberately removed automatic UI following; these are separate acceptance gates.

Read by Codex primary agent on 2026-10-29, 20:24–20:26 CET, repository `bcr-studio-firmware-103`, full commit `e9c85468f8f3c6f275c7d870f88d8f809e1e62dd`, branch `work/sxm-full-catalog`, initially clean tracked worktree. Exact model identifier and effort are unavailable in the runtime, so that part of provenance is incomplete. Read scope: Workbench page-selection action, inert page-follow parser, ZAQ host state codec, this work item and protocol ledgers. Outside Git: installed ControlTribe1.12.4 binary, SHA256 `8715b0703ad62a923822deb8b4f3c8eb5943d865f30f70b71940b3c3a44e5d6e`; focused static extracts under ignored `output/research/mode-follow/`.

The native receive dispatcher `BCR32DeviceImpl::processIncomingMidi` at `0x1005d54d0` was inspected, including its command jump table at `0x100d29443`. Commands0B/0C branch to the generic device-status path at `0x1005d5648`, rather than a dedicated current-page notification handler. Command04 routes native exports to controller/ZAQ consumers. `BCR32ParamSync::tickDeviceStatusCheck` at `0x1005e8db4` checks bootloader transfer status74; it is not evidence of a safe current-page request. This bounded static review does **not** prove absence of every possible firmware event or query. No alternative mode packet is qualified by it.

The passive recorder currently selects the last matching BCR-32 input. A read-only port inventory found exactly one matching native input in this session, so the previous silence cannot presently be explained by an unmonitored second BCR input. No input listener, output writer, hardware query, STORE or firmware action was started during this re-review. No application code was changed or deployed.

Remaining proof gate: identify and capture a nonblocking current-page event/status exchange, then add receive-only navigation with zero echoed page commands and physical-key acceptance during sustained monitoring. Do not infer the page from running state, a refused sequencer request, startup preferences or successful controller/ZAQ parameter reads. Do not reintroduce export08 polling to make the UI appear synchronized.

## Narrow state-read comparison — 20:47–21:09 CET

Tracking: [GitHub #36](https://github.com/TheLazyGeekGuy/bcr32-studio/issues/36). Read by Codex primary agent, exact model identifier/effort unavailable, repository `bcr-studio-firmware-103`, baseline full commit `e9c85468f8f3c6f275c7d870f88d8f809e1e62dd`, with uncommitted catalogue/documentation changes. Outside Git: the guarded local helper and captures under ignored `output/research/mode-follow/`.

The owner confirmed physical CTRL. A fresh product identity confirmed firmware1.0.3 before a single existing ZAQ state request48/00. That request returned refusal status02. Repeated bounded reads in the unchanged session gave the same status; these repetitions are not independent physical transitions. The helper permits only product identification and48/00, closes both native ports in `finally`, and sends no page selection, export, STORE or firmware command. Its latest capture is `state-ctrl-2109.json`.

A paired owner-confirmed ZQR observation is still pending. Status02 alone is not a qualified mode event and has not been wired into the application. No physical-to-UI fix or physical acceptance is claimed. Export08 remains disabled.

## Paired state evidence and replacement implementation — 22:47–22:53 CET

Codex primary, exact model identifier/effort unavailable. Repository and full baseline remain `bcr-studio-firmware-103` at `e9c85468f8f3c6f275c7d870f88d8f809e1e62dd`; page-state, ZAQ host/hook, Workbench, fixtures/tests and catalogue changes are uncommitted. Outside-Git paired captures: `state-confirmed-ctrl.json`, `state-confirmed-zqr-2247.json` in ignored `output/research/mode-follow/`. Their hashes and sanitized replies are tracked in `scripts/fixtures/page-state-103.json`.

The owner confirmed ZQR. A fresh1.0.3 identity followed by48/00 returned a valid five-byte state, contrasted with exact status02 in owner-confirmed CTRL. No export, page change or write was used for these paired observations. This narrower, firmware-specific evidence supersedes the earlier prohibition against any inference from a refused sequencer request: only exact48/00 status02 versus a valid state is admitted, and other refusals/timeouts never choose a page.

`page-state.ts` coordinates one shared state exchange and two separated observations. Workbench uses the existing MIDI lease/input; useSequencerHost optionally delegates its state requests to the same coordinator and reports read/edit busy periods synchronously. Standalone hook callers retain their existing private state exchange. Manual navigation invalidates earlier observations. Automatic receive-driven navigation only sets the view and never reasserts the hardware page. Background export08 remains unavailable.

Verification: all57 test scripts, TypeScript and production build pass. The owned-browser simulated-MIDI scenario now covers physical-mode changes both ways without page-command echo, plus pattern read/edit/follow, paused draft retention, clock cursor and selective import. The first added browser assertion incorrectly selected the outer `.studio` rather than the inner element carrying `data-mode`; the selector was corrected and the scenario passed. The SXM browser import/export scenario also passes. No fake-MIDI test opens native ports.

Firefox at `http://127.0.0.1:5187/editor/` was observed on Sequencer with a live pattern read at22:49:58 after local reload. The owner has been asked to return physically to CTRL, without clicking the editor. That physical acceptance and sustained key availability remain pending. No commit, push or production deployment of this replacement has occurred.

Passive runtime check at22:55 CET: the input-only eight-second recorder saw six valid48 replies and no other packets in its observation window. The native listener was closed afterward. This verifies that the running local browser reader receives replies; it does not substitute for exercising the physical mode key. Generic publication scanning passed; the full private-denylist scanner still reports five existing file findings and five historical commit findings. No hook was bypassed and no push was attempted.
