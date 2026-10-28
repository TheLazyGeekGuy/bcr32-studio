# BCR103-07 — 300 BPM clock estimation and presentation load

Status: **software implemented; physical Firefox acceptance pending**. Related: [BCR103-05](2026-10-28-sequencer-transport-and-playhead.md). This is not completion of outgoing Play/Stop/Space.

## Traceable review

- Reader: **Codex, primary agent**, 2026-10-28 17:29–17:52 CET. The runtime does not expose the exact model identifier or reasoning level; those provenance fields are unavailable, not inferred.
- Repository: `bcr32-studio`, worktree `<workspace>/bcr-studio-firmware-103`, branch `work/firmware-103-sequencer`.
- Full clean starting revision: **`8485dd46db2b393ca50c75b4ecb909f0129ad1e6`**. Review includes the subsequently uncommitted alpha.17 patch to broker/view-access/MidiPort metadata, BCR32 Workbench/follower/view, tests/fixtures, version, changelog and documentation. The final local commit records these changes; no main, upstream MIDI Studio, remote publication or deployment is implied.
- Read scope: the actual timestamp and input-observer exports/callers, follower, Workbench receive chain, sequencer rendering and clock watchdog, simulated browser harness, production distribution, BCR103-05 and protocol dossier. The standalone checkout does not contain `CORE-MODULE-API.md`, `BROWSER-PLATFORM-ROADMAP.md`, `EDITOR-INTEGRATION-CONTRACT.md` or `MODULE-ARCHITECTURE-AUDIT.md`; the inspected source exports/tests are the authority here. This is not an assertion that upstream contracts have been updated.
- Outside Git: input-only native capture `clock-300-1730.json` and generated browser performance reports in `<workspace>/Codex/bcr32-firmware-103-analysis-2026-10-28/`. No screen capture, physical output, STORE, firmware operation or device-setting change was used for this correction. There is consequently no temporary hardware setting to restore in this turn; previous restoration limitations remain in BCR103-05.

## Evidence and cause boundaries

The owner set the physical BCR32 to 300 BPM and reported 277.8 in the UI with poor following. An eight-second native input-only capture received **960 F8 messages**. The first-to-last span gives **300.03844499282985 BPM**; individual gaps range from 5.713792 to 11.071417 ms, median 8.342334 ms. This sample does **not** demonstrate a hardware tempo ceiling. The source-hashed fixture `scripts/fixtures/zaq-clock-300.json` preserves the first 360 timestamps for tempo replay. There was no captured Start in this high-rate sample: no physical start-phase proof is claimed from it.

The old follower uses the median of short adjacent JavaScript delivery intervals and ignores measurements above 300. A synthetic **9/9/7 ms** sequence averages 300 BPM but deterministically produces **277.8** when replayed against the exact baseline source. Values just over 300 can leave an earlier wrong estimate frozen. This reproduces an algorithmic defect; the exact live Firefox delivery-gap pattern was not captured, so it is not asserted to be identical to the synthetic sequence.

The source timestamp was also lost at the shared input hub, broker packet, legacy Web-MIDI-shaped access and Workbench forwarding seams. [W3C Web MIDI §5.4.1/§5.5](https://www.w3.org/TR/webmidi/#midiinput-interface), read 2026-10-28, specifies `MIDIMessageEvent.timeStamp` as the system receive time. Callback processing time is not equivalent under queueing. The new path retains that metadata.

The displayed BPM does **not** drive the cursor. Its separate load issue was full sequencer React reconciliation on every changed playback step (20 step changes/second at 300 BPM with six clocks/step). Correcting the number alone would not correct that work.

## Delivered design

1. Fit clock index against source time over a bounded rolling one-second window, with at least eight samples/250 ms of span and at most four estimate updates/second. Relative coordinates avoid long-session precision loss. The 257-point cap bounds memory. Repeated timestamps retain their clock counts. Regression is measurement, not a clamp to the selected tempo; slightly-above-300 measurements stay visible.
2. Preserve source `timeStamp` through hub → broker packet → access wrapper → Workbench → follower. Clock/Start/Continue/Stop/Active Sensing bypass unrelated assignment/Learn decoders. System Reset is deliberately not included in that early return.
3. Tiny external-store subscribers own tempo/status. Playback positions stay outside the full editor React state. A per-instance animation-frame painter applies the latest **received** position to cached step/track node buckets. Selection, edits and view changes rebuild those buckets and repaint current heads. Closing cancels the pending frame and releases node references. There is no interpolation, synthetic tick, guessed elapsed-time step or MIDI sender.
4. Existing qualification and invalidation remain: forward, zero shuffle and no skipped step in the active sequence; independent per-track divider/start/length/offset. Stop, stale clock, new snapshot, local draft and rebind invalidate phase. Attaching mid-playback requires a fresh physical Start.

## Shared seam delta

| Owner / seam | Before | After / compatibility |
| --- | --- | --- |
| `MidiPort.onmidimessage` in root and BCR32 types | `{data: Uint8Array}` | `{data: Uint8Array; timeStamp?: number}`; optional, no existing provider required to add it |
| Broker input observer | `(bytes) => void` | `(bytes, timestamp) => void`; existing one-argument subscribers remain compatible |
| `BrokerPacket.timestamp` | Callback processing time | Finite nonnegative source `timeStamp`, otherwise injected `now()`; packet shape unchanged |
| Legacy access wrapper | Drops packet timestamp | Forwards it as event `timeStamp` |
| BCR32 sequencer receive ref | `(bytes) => void` | `(bytes, timeStamp?) => void`; omitted metadata retains follower `now()` fallback |

No saved-state schema, port ownership, grant/validator policy, hardware capability or output message changes. Timing estimation/presentation remains BCR32-owned, not manufacturer-specific core logic. Cross-module proof is limited to available standalone source plus unlike voice-message/duplicate-lease test doubles; upstream device inventories are not installed here. An upstream backport is separate work.

## Verification and remaining gates

- **49/49** test scripts and TypeScript pass. New tests cover inherited event timestamps, zero, invalid/absent fallback, two isolated leases/unlike voice payloads, release/closed wrapper, real high-rate replay, 1/2/10-ms quantization, batched delivery, 9/9/7 median trap and an actual estimate of 300.1.
- Production build/distribution verification and generic leak gate pass. Existing large-chunk warnings remain; they are not solved by this timing patch.
- Real Chromium with simulated MIDI: automatic read, editing, seven lanes, selective import, all cursor views, independent edit selection, Stop/stale clearing, pattern follow and both async/synchronous replies pass. Missing optional timing still disables only the cursor, not successful reads/verified edits. No browser test uses physical ports.
- `scripts/bench-sequencer-clock.cjs` compares preserved alpha.16 production output against alpha.17 at 1440×1000, CPU throttling 4×, two alternating eight-second runs/build, 960 simulated ticks/run. Reported marker latency is **DOM mutation latency**, not a captured physical/pixel-paint measurement. Final results are recorded below.
- [ ] Owner reloads alpha.17 in Firefox on port 5187, then performs physical STOP → PLAY at 300 BPM and accepts tempo plus cursor alignment over multiple loops. Current browser automation does not prove this physical Firefox outcome.
- [ ] Outgoing UI Play/Stop/Space remains a separate unresolved protocol capability; no speculative transport command was enabled.

## Final production-browser measurements

Final report generated 2026-10-28 17:49:06 CET: outside-Git `clock-render-bench-final.json`, SHA-256 **`b9aff1ebe3b0f898a373c5d7e85c14b80d45d6b036c1197582ea05d45af57e42`**. Baseline server 5191 served the preserved alpha.16 distribution; candidate 5187 served alpha.17. The temporary baseline preview was stopped after measurement. No other test/build job was deliberately run during this final comparison.

| Eight-second workload | Alpha.16 | Alpha.17 |
| --- | --- | --- |
| Final measured BPM, two runs | 290.7 / 287.4 | **300.0 / 300.0** |
| JavaScript `ScriptDuration`, mean | 0.544875 s | **0.201637 s (−63.0%)** |
| Main-thread `TaskDuration`, mean | 1.934870 s | **1.603640 s (−17.1%)** |
| Emitted clocks / final T1–T4 index | 960 / 31 each | 960 / 31 each |
| Step writes / runtime errors | 0 / 0 | 0 / 0 |

The animation-frame tradeoff is visible: marker DOM-mutation p95 changes from 6.9/6.8 ms to 15.9/16.4 ms; the candidate's largest measured DOM update delay is 45.7 ms. These measurements **do not establish lower display latency** or real Firefox/physical alignment. They establish the correct measured tempo/end phase for this simulated workload and reduced JavaScript/main-thread work. Pixel presentation was not captured. Do not present the 63% script reduction as a 63% reduction of total CPU or physical MIDI latency.
