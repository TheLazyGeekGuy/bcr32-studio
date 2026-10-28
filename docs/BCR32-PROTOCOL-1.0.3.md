# BCR32 firmware 1.0.3: sequencer host integration

## Alpha.13 correction — automatic page/read/edit workflow

User acceptance of alpha.12 reported a Firefox response timeout and the absence of a hardware page change. Alpha.13 sends the native page messages `F0 00 20 32 7F 64 0B F7` (Sequencer) and `… 0C F7` (Controller). These come from ControlTribe 1.12.4 ARM64 functions `SendZaquencerPageMode` at `0x1005b8ccc` and `SendControllerPageMode` at `0x1005b8c40`; they have no immediate acknowledgement. The opaque host state vector must not be misrepresented as confirmation of the visible hardware page.

Entering Sequencer now sends its page command, automatically reads the pattern, then enables live step editing **after successful completion only**. RX relay installation happens before the first read effect, including synchronous replies. The large Controller assignment scan is cancelled/excluded while in Sequencer; failed reads, lock, disconnection and explicitly paused sending still prevent note writes. `0B`/`0C` use narrow page-change authorization, not a general-purpose raw sender or STORE grant.

On 2026-10-28, a real Chromium 155.0.8059.12 Web MIDI session against the connected BCR32 read all 36 lanes immediately after entering Sequencer (without waiting for the Controller scan), observed 38 host requests/replies including the two state reads, and showed live editing enabled. Native page-command output was recorded. **The reported Firefox failure has not yet been reproduced or cleared in the user's session.** Timeout errors now show command, expected device, RX count and last received header to make that next comparison specific.

This correction was reviewed/implemented by Codex, primary agent, 2026-10-28 13:41–13:51 CET, against full commit `75d091084073d73a0fc3ddef8e83037e151e97f9` plus this initially uncommitted patch. Exact model/effort are not exposed. Previous alpha.12 statements below about opt-in live editing and the absence of page changes are historical and superseded by this section. No STORE or firmware update was performed.

## Scope and provenance

Reviewed on 2026-10-28, 13:02–13:25 CET, by **Codex, primary agent**. The runtime does not expose the exact model identifier or reasoning-effort setting; provenance is therefore **incomplete at that level**, not asserted to be a separately versioned independent review.

- Repository: `TheLazyGeekGuy/bcr32-studio`; baseline full commit **`5afd1ff5b258e84384d753a12ba8b9aac6b35b76`**, version `0.45.0-alpha.11`.
- Isolated worktree: `<workspace>/bcr-studio-firmware-103`, branch `work/firmware-103-sequencer`. Implementation was initially uncommitted on that baseline. Main and other dirty worktrees were not modified.
- ControlTribe **1.12.4**, installed application, **outside Git**: binary SHA-256 `8715b0703ad62a923822deb8b4f3c8eb5943d865f30f70b71940b3c3a44e5d6e`.
- Physical BCR32 product response: `F0 00 20 32 00 64 00 01 00 00 01 00 03 F7`; decoded firmware **1.0.3**, device **00**.
- Downloaded firmware ciphertext, outside Git: 193,880 bytes, SHA-256 `47c55ed8e50a92d701f2a2aa4f09c2b0441e8051d81400f39a03e9dbca8c340c`; MD5 `9f2c63fe8c6d37da3eb1565286189dc7` matches vendor metadata.
- Official `Notes_BCR32_1.0.3.pdf`: SHA-256 `00066dff5efd059884185b373820c27864558ae07617dc07838d260d28639672`; document date **2026-10-24**, server publication **2026-10-28**. The dates describe different events.
- Source and full raw local evidence: `<workspace>/Codex/bcr32-firmware-103-analysis-2026-10-28/`. The repository fixture `scripts/fixtures/zaq-host-103.json` retains actual response bytes, not synthetic replacements. Signed download URLs and credentials are deliberately excluded.

The release notes announce an open Zaq host protocol, but do **not** supply the byte table below. That table is a **binary-derived inference**, subsequently checked against the connected hardware where explicitly stated. No firmware was flashed or patched by this work. Comparison with 1.0.2 ciphertext establishes size/header differences, not a decrypted instruction-level firmware diff.

## Firmware changes announced by the manufacturer

1. Per-preset Zaq GLOBAL parameters: tempo, clock, THRU, scale and track outputs.
2. COPY PARMS / COPY TRACK in Zaq GLOBAL.
3. PAT'N CH moves to shared device settings for CTRL/Zaq remote control.
4. Hold STORE for three seconds to save all changes.
5. Device ENC ACCEL and footswitch POLARITY settings.
6. Encoder-update delay during playback fixed.
7. Computer-side sequencer editing through the Zaq host protocol.

This release implements **step reading/editing from item 7**. It does not silently claim that all other new firmware settings have UI support.

## Exact framing and encoding

All numbers in wire examples are hexadecimal. Envelope:

`F0 00 20 32 <device> 64 <command> <payload…> F7`

The native editor sends host requests to device **7F**; the actual unit replies from configured device **00**. Host requests use the **CTRL/controller USB port**, not the ZAQ performance port. The browser integration retains the existing per-instance lease and broker; it never acquires another MIDI output.

| Command | Payload sent by native editor | Meaning | Implemented here |
| --- | --- | --- | --- |
| `44` | `01 track step field` | Read one step field | No; bulk lane reads used instead |
| `44` | `02 track step field packed-int16` | Edit one step field | Yes, current edit buffer only |
| `45` | `01 track field` | Read 32 values in one lane | Yes |
| `46` | `01 track field` / `02 track field packed-int16` | Track parameter read/write | Observed in binary; not enabled |
| `47` | `01 field` / `02 field packed-int16` | Global parameter read/write | Observed in binary; not enabled |
| `48` | `00` | Read current state | Yes; guarded against state changes |
| `48` | Other state selectors and optional value | Native state commands | Not exposed; no transport, mode change or STORE inferred |

Tracks and steps are zero-based: **0–3**, **0–31**. The opcode is not enough to authorize a packet: operation byte, length, selector and value ranges are checked. The exact verified firmware version is required; `1.x` or future versions are not implicitly granted writes.

Signed values use a big-endian 16-bit word. Seven-bit packing prepends a mask to up to seven bytes; mask bit *i* carries raw byte *i* bit 7. For a single word the wire is `[mask, high & 7F, low & 7F]`; this is **not** a little-endian MIDI 14-bit integer.

| Field | Meaning | Editor range / representation |
| --- | --- | --- |
| `00` | Pitch | 0–127 |
| `01` | Velocity | 0–127 |
| `02` | Step mute | 0/1, mapped to `rest` |
| `03` | Delay | −5…5 clock ticks |
| `04` | Note length code | 0–15; existing length-label ordering remains inferred |
| `05` | Ctrl A | −1…127; −1 maps to local raw 255 |
| `06` | Ctrl B | −1…127; −1 maps to local raw 255 |
| `07` | Chord/polyphony word | All 16 bits retained; signed reply converted to unsigned local word |
| `08` | Skip | 0/1, mapped to `mask` |

Field names 0/1/3/4/5/6/7 come from the native lane table at `0x10108b2a0`. Step Mute → 2 and Skip → 8 are visible in the native lane painter (`0x1005ed848` onwards), preventing a guessed/reversed flag mapping.

### Actual exchange

Read T1 pitch lane:

`F0 00 20 32 7F 64 45 01 00 00 F7`

Reply: 86 bytes, prefix `F0 00 20 32 00 64 45 01 00 00 00`, then 74 packed bytes, then `F7`. The packed data decodes to 64 bytes: **32 signed big-endian words**. Header bytes before the data are operation, track, field and status.

Temporarily set T1 step 1 pitch to 61:

`F0 00 20 32 7F 64 44 02 00 00 00 00 00 3D F7`

Actual reply:

`F0 00 20 32 00 64 44 02 00 00 00 00 00 00 3D F7`

The response includes status 0 and the echoed accepted value. The physical test then made a **separate lane read**, confirmed 61, wrote the original 60 back and separately read 60. No STORE was sent. UI confirmation is based on the device reply; the physical read-back test is additional evidence, not proof of power-cycle persistence.

State read returned five packed bytes, `[0, 0, 2, 0, 0]` in this capture. Their complete semantics are not asserted. The integration compares the full vector before/after a snapshot and before queued edits; any difference stops editing and requires another read.

## Native analysis entry points

ARM64 virtual addresses in the exact binary hash above:

- `0x1005e64f8`: `BCR32ZaqSync::Request::toMessage` — request construction.
- `0x1005e4b0c`: `BCR32::ZaqHost::parse` — response lengths, fields, status and packing.
- `0x1005e6878`: `ZaqHost::stateCommand` — distinguish state reads from commands.
- `0x1005e9cec`: `ZaqSync::readAll` — ordered native read plan.
- `0x1005e5190`: `ZaqSync::apply` — lane/step/track/global destinations.
- `0x100d81590`–`0x100d815c8`: literal message headers.

Focused disassembly and extraction scripts stay in the local analysis dossier. The application binary and firmware image are not redistributed in this repository.

## Integration and safety contract

- `zaq-host.ts`: pure codec, strict query/edit validators, single-flight session, finite timeout, no retries or opcode scan.
- `useSequencerHost.ts`: instance/view lifecycle, atomic 36-lane read, state-change checks, latest-value queue (128 distinct pending edits maximum), stop-on-error, lock/disconnect/unmount cleanup.
- `SequencerView.tsx`: preserves the existing grid/lanes/piano roll, templates and MIDI imports. Entering Sequencer on a connected verified 1.0.3 reads the current step values. Live editing is an explicit switch after the read, not a side effect of opening the page.
- `host-policy.ts` and `registration.tsx`: existing broker authorizations remain authoritative. Only the narrow new step-edit packet is granted as `edit-buffer`; it cannot borrow `preset-store` authority.
- Captured host values project onto the existing local step model. **Unknown track/global/header bytes are not a complete preset backup.** Export captured values as JSON; do not advertise the synthetic local header as a hardware dump.
- Bulk slot upload, persistent sequencer storage, copy commands, new globals and host transport remain unimplemented/gated. Existing firmware 1.0.2 BCL/controller write/store gates are deliberately unchanged for 1.0.3.
- Legacy `07` export is not used: earlier project observations report a hardware freeze. Firmware maintenance, bootloader and arbitrary SysEx are excluded.

## Validation matrix

| Gate | Result |
| --- | --- |
| Fresh physical identity | 1.0.3 / device 00 confirmed |
| Four tracks × nine lanes | 36 replies / 1,152 step values captured |
| Temporary pitch change | 60 → 61, independently read back |
| Restore | 60 restored and independently read back |
| Other eight field writes | Codec/range/offline tests; not individually physically exercised |
| Old track read commands `29`–`2D` | All four tracks read twice consistently on 1.0.3 |
| Permanent storage / power cycle | Not tested, not enabled |
| Browser hardware UX | Joint local acceptance with the user still required |

The complete native capture contained 43 requests and 43 replies in **821 ms**, including the deliberate 20 ms lane pacing, identity/state checks and the temporary write/restore. This is a single local observation, not a cross-platform performance guarantee.

Run offline checks with `npm test`. Explicit hardware tool:

```sh
node scripts/hw/bcr32-zaq-host.mjs /absolute/path/capture.json
# Optional, explicit temporary note edit + restoration, never STORE:
node scripts/hw/bcr32-zaq-host.mjs /absolute/path/capture.json --test-note-and-restore
```

The tool selects exactly one matching BCR32 port, requires fresh 1.0.3 identity and writes a local capture before any optional edit. Do not run concurrent writers against the same hardware edit buffer.
