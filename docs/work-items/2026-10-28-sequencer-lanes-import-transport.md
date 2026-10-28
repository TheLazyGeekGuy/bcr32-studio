# BCR103-04 — Seven lanes, selective MIDI import and UI page switch

## Review provenance

Codex primary agent; exact runtime model ID/effort unavailable, so those provenance fields are incomplete. Read/implementation window: 2026-10-28 13:53–14:12 CET. Repository `bcr32-studio`, isolated branch `work/firmware-103-sequencer`, full baseline `f79f552df0b55356fc4efa40cefe05b267c48817`; patch initially uncommitted. Main untouched. Scope: `src/editors/bcontrol/bcr32/{SequencerView,MidiImportDialog,useSequencerHost,Workbench,zaq-host}`, translations, existing tests/protocol docs; outside-Git ControlTribe 1.12.4 binary and native/physical captures in the analysis dossier documented by `BCR32-PROTOCOL-1.0.3.md`.

## Acceptance

- [x] Seven numeric lanes matching native fields, plus per-step Mute/Skip.
- [x] Native Chord range 0–55, lossless unknown reads, no invented chord names.
- [x] Import just one chosen destination, or several explicitly selected destinations; default only the current track. Other tracks untouched.
- [x] Idle state query reflects physical PLAY without clock spam/duplicate ports or invalidating a four-track snapshot.
- [x] Both UI page directions send native guarded commands; clicking the already-active view reasserts the command without losing a draft.
- [x] Returning to Sequencer performs the automatic 36-lane read.
- [ ] Visible physical Controller/Sequencer change confirmed by the user; wire commands have no page acknowledgement.
- [ ] Play/Stop/Space sends a verified working command. **Not complete.** Standard USB clock produced no notes. Approved selector `01` experiment falsified the transport hypothesis: it selects a track. No alternative selector is guessed or enabled.
- [ ] User-session Firefox acceptance after reload.

## Hardware safety / outcome

User started physical playback, then explicitly approved one selector-01 experiment. Full details and the insufficient initial restoration flag are recorded in the protocol document. Selected track was restored from 1 to 0, entire state returned to `[1,0,0,0,0]`, and an independent full 36-lane capture was identical to the pre-test capture. Playback remained running. No STORE/firmware update was sent. Temporary speculative probe removed; raw evidence retained outside Git.

## Validation

Browser simulation checks: all seven lanes; importing only T3 preserves T1/T2/T4; hardware running-state polling; edit/undo/pause; both page commands, including clicking the already-active view without draft loss; 72 lane reads after leaving/re-entering Sequencer; no STORE or browser errors. Executed 2026-10-28 14:12–14:15 CET: **47/47 offline scripts and TypeScript pass**, production build/distribution passes (existing large-chunk warning); normal and synchronous-reply production browser regressions pass; production subpath/offline test passes; smoke test serves alpha.14; generic leak-gate passes. Simulated browser tests are not physical or Firefox proof. Sanitized state responses and raw source hashes are retained in `scripts/fixtures/zaq-host-103-state.json`.

Version: `0.45.0-alpha.14`. Local changes only; no push, merge or deployment.
