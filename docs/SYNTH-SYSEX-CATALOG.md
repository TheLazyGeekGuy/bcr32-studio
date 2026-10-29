# Synth SysEx starter catalogue

Version: **0.46.0-alpha.5**. Twenty curated hardware models, 46 templates. This is an editorial selection of familiar synths, not a measured popularity ranking or a full editor for each instrument.

## Use in the editor

1. Select an encoder rotation or push in Control.
2. Choose Type **SysEx** or **BCL**.
3. Open **Synth SysEx catalogue**, search by model/parameter, select the command and destination channel, Device ID, scene or part.
4. Inspect the preview and the model prerequisites, then select **Load into current control draft**.
5. The catalogue closes and the message appears in the existing editor. **Undo text** restores the text immediately preceding loading; normal Apply/Export/hardware actions remain separate.

Loading does not alter the selected control assignment until Apply, does not send MIDI, and never switches ports. Channel/Device ID identify the target synth, not the BCR32. A native custom program installed on a BCR32 sends its own MIDI output: connect that output to the intended synth using the device routing. Studio does not create an implicit synth output connection or translate an incoming synth dump automatically.

## Coverage

| Manufacturer / hardware model | Included commands | Effect | Native limitation |
| --- | --- | --- | --- |
| Waldorf Microwave I | Filter cutoff (0–127), Filter resonance (0–127) | edit-buffer | Checksum BCL is file-only |
| Waldorf Microwave II / XT / XTk | Filter 1 cutoff (0–127), Filter 1 resonance (0–127) | edit-buffer | No synth hardware qualification |
| Waldorf Blofeld | Filter 1 cutoff (0–127), Filter 1 resonance (0–127) | edit-buffer | No synth hardware qualification |
| Yamaha TX81Z | Algorithm (0–7), Feedback (0–7), LFO speed (0–99), Operator 1 output level (0–99) | edit-buffer | No synth hardware qualification |
| Yamaha DX7 | Algorithm (0–31), Feedback (0–7), Operator 1 output level (0–99) | edit-buffer | No synth hardware qualification |
| Yamaha DX7II FD / D | Algorithm (0–31), Feedback (0–7), Operator 1 output level (0–99) | edit-buffer | No synth hardware qualification |
| Yamaha DX7s | Algorithm (0–31), Feedback (0–7), Operator 1 output level (0–99) | edit-buffer | No synth hardware qualification |
| Yamaha DX21 | Algorithm (0–7), Feedback (0–7), LFO speed (0–99) | edit-buffer | No synth hardware qualification |
| Yamaha AN1x | VCF filter cutoff (0–127), VCF filter resonance (13–127) | edit-buffer | No synth hardware qualification |
| Yamaha AN200 | VCF filter cutoff (element) (0–127), VCF filter resonance (element) (13–127) | edit-buffer | No synth hardware qualification |
| Yamaha FS1R | Common filter cutoff (0–127), Common LFO1 speed (0–99) | edit-buffer | No synth hardware qualification |
| Yamaha CS1x | Multi Part filter cutoff offset (0–127), Multi Part filter resonance offset (0–127) | edit-buffer | No synth hardware qualification |
| Yamaha CS2x | Multi Part filter cutoff offset (0–127), Multi Part filter resonance offset (0–127) | edit-buffer | No synth hardware qualification |
| Roland JX-8P | VCF cutoff (0–127), VCF resonance (0–127) | edit-buffer | No synth hardware qualification |
| Roland Alpha Juno-2 | VCF cutoff (0–127), VCF resonance (0–127) | edit-buffer | No synth hardware qualification |
| Roland Juno-106 | VCF cutoff (0–127), VCF resonance (0–127), Envelope attack (0–127) | edit-buffer | No synth hardware qualification |
| Korg DW-8000 | VCF cutoff (0–63), VCF resonance (0–31) | edit-buffer | No synth hardware qualification |
| Korg DW-6000 | VCF cutoff (0–63), VCF resonance (0–31) | edit-buffer | No synth hardware qualification |
| Korg M1 | Request current Program (0–127), Request current Combination (0–127) | request | No synth hardware qualification |
| Novation Bass Station II | Request AFX overlay 0-24 (0–24) | request | No synth hardware qualification |

## Evidence and compatibility

Every wire template is derived from its manufacturer document below. No synth or BCR32 output gesture was tested for this catalogue, and these templates are not hardware-certified. The existing explicit BCR32 transfer gate is unchanged: simple `.tx` programs may use the supported firmware transaction; advanced/opaque programs are exportable only. Assignment installation is distinct from proving actual synth response or persistent preset STORE.

- **Microwave I:** OS 2.00 RTBP, nibble-encoded parameter index (most-significant nibble first), additive 7-bit checksum over bytes 5–8. Example cutoff value 64: `F0 3E 00 00 60 00 04 01 40 45 F7`. The catalogue calculates the preview, but loads `.tx … cks-2 5 $F7` into BCL. This remains partial/opaque and hardware transfer stays disabled; no firmware token support is inferred.
- **Microwave II/XT and Blofeld:** SNDP has no checksum. Their model IDs and parameter indices are distinct.
- **TX81Z/DX21:** VCED group `12h`; this does not assume their additional-voice or remote-switch groups are identical. DX21 needs EDIT mode.
- **DX7/DX7II/DX7s:** algorithm address uses high parameter byte `01` plus low `06`. All values here remain 7-bit. Device number and receive channel are distinguished in the controls.
- **AN1x/AN200:** native element parameters are used; AN200 scene macros have separate offsets. Resonance starts at raw 13; zero offset is raw 25.
- **FS1R:** even the 7-bit parameters here carry two data bytes, MS7 then LS7; voice common part addresses are `40h`–`43h`.
- **CS1x/CS2x:** XG Multi Part offsets, not Performance Layer or absolute cutoff. Center value is 64.
- **DW-8000:** use the value-modified parameter bitmap, not packed dump bitfields. **DW-6000:** format byte is fixed `30h`, not `3n`; no channel-byte control is fabricated.
- **M1/Bass Station II:** read requests only. A reply is not automatically imported by this control editor. Continuous rotation can repeat requests; prefer a push for a fixed request. Bass Station II requires AFX-capable firmware and an already selected overlay bank.

## Primary source ledger

Access date: 2026-10-29. Manufacturer PDFs/archives and extracted/OCR reference material are retained locally under ignored `output/research/sysex-catalog/`. PDF page numbers below count from 1; named sections are authoritative when pagination is absent. Original bytes are not redistributed.

### Waldorf Microwave I

- Source: [Waldorf Microwave I - manufacturer MIDI documentation](https://downloads.waldorfmusic.com/cloud/index.php/s/weTqE3SkZzocxYe/download).
- Scope: SysEx 2.00 rev00 (1994-03-01): RTBP 60h, BPRD table, BYTE encoding and CHKSUM.
- Original download SHA-256: `08dde6bc05f8cfa5273ebd20e4786303a52211cfd7e86c739f9e70c6f7874e77`.
- Setup/constraints: OS 2.00. Single/Poly ignores Part; Multi selects Part 1-8. Requires additive checksum. Native BCL checksum execution is unqualified: file-only in this editor.

### Waldorf Microwave II / XT / XTk

- Source: [Waldorf Microwave II / XT / XTk - manufacturer MIDI documentation](https://downloads.waldorfmusic.com/cloud/index.php/s/2BLZXbKrMw3x26N/download).
- Scope: SysEx: 2.13 SNDP (20h); 3.1 Sound parameter table.
- Original download SHA-256: `9b544c45ba35c4ba8d8b3502fd30763ec8bc510f18aa8ea403119a9373ff3c85`.
- Setup/constraints: Match Device ID. Single mode: Part 1 (location 00); Multi: the selected part sound edit buffer. SNDP omits the checksum.

### Waldorf Blofeld

- Source: [Waldorf Blofeld - manufacturer MIDI documentation](https://downloads.waldorfmusic.com/cloud/index.php/s/ybExJgT4TzqT8ir/download).
- Scope: SysEx: 2.13 SNDP (20h); 3.1 Sound parameter table.
- Original download SHA-256: `6d3b6557b2a8ee377ff517460ec920a1dd8b576506f47d2bf40c553af82c80d5`.
- Setup/constraints: Match Device ID. Single mode: Part 1 (location 00); Multi: the selected part sound edit buffer. SNDP omits the checksum.

### Yamaha TX81Z

- Source: [Yamaha TX81Z - manufacturer MIDI documentation](https://usa.yamaha.com/files/download/other_assets/9/316769/TX81ZE.pdf).
- Scope: Owner Manual printed pp.67,71 / PDF pp.68,72: Parameter Change / VCED.
- Original download SHA-256: `a054ce349f0c59046baf955cfb1194195ff9e66d23fa2ad332509915f4ea67c0`.
- Setup/constraints: Enable exclusive reception; match Basic Receive Channel. VCED group 12h edits the current voice, without STORE.

### Yamaha DX7

- Source: [Yamaha DX7 - manufacturer MIDI documentation](https://usa.yamaha.com/files/download/other_assets/9/333979/DX7E1.pdf).
- Scope: MIDI Data Format: Parameter Change / voice table; PDF pp.31-33.
- Original download SHA-256: `a3bb18bafbb6d2ec03268b814ac495bb5dfdabbda53b52a46f510ebbc2ed9a42`.
- Setup/constraints: Voice edit buffer. Enable System Info/Exclusive and match receive channel (DX7) or Device number (DX7II/DX7s). Check hardware memory-protect if edits are ignored. No persistent STORE included.

### Yamaha DX7II FD / D

- Source: [Yamaha DX7II FD / D - manufacturer MIDI documentation](https://usa.yamaha.com/files/download/other_assets/7/320817/DX7IIE.PDF).
- Scope: MIDI Data Format Add-2, Add-8; PDF pp.96,102.
- Original download SHA-256: `7ea6771f0a3c984173390561de5b86375181ae9cb1df6c7a175bdf8a24eb5ca6`.
- Setup/constraints: Voice edit buffer. Enable System Info/Exclusive and match receive channel (DX7) or Device number (DX7II/DX7s). Check hardware memory-protect if edits are ignored. No persistent STORE included.

### Yamaha DX7s

- Source: [Yamaha DX7s - manufacturer MIDI documentation](https://usa.yamaha.com/files/download/other_assets/3/320813/DX7SE.pdf).
- Scope: MIDI Data Format Parameter Change / 5-1 Voice Parameter, Add-9; PDF p.98.
- Original download SHA-256: `83fbea493f0730c710a6bf5c519dd79d90df2e9a3a61f04309983d6da5156dca`.
- Setup/constraints: Voice edit buffer. Enable System Info/Exclusive and match receive channel (DX7) or Device number (DX7II/DX7s). Check hardware memory-protect if edits are ignored. No persistent STORE included.

### Yamaha DX21

- Source: [Yamaha DX21 - manufacturer MIDI documentation](https://usa.yamaha.com/files/download/other_assets/5/320775/DX21E1.pdf).
- Scope: MIDI Data Format: Parameter Change and Voice Parameters (VCED); printed pp.48,51,54 / PDF pp.49,52,55.
- Original download SHA-256: `a81463e25bc343de65b59ed46d4ff476e2441a45047f267a7af1c9b6f6e8195d`.
- Setup/constraints: Enable MIDI SYS INFO, match receive channel and use EDIT mode for voice parameter edits. No STORE.

### Yamaha AN1x

- Source: [Yamaha AN1x - manufacturer MIDI documentation](https://data.yamaha.com/files/download/other_assets/5/317965/AN1XE2.PDF).
- Scope: Data List pp.13-15: 3-5-3-2 / Current Voice Scene Buffer table.
- Original download SHA-256: `ffa9ace5c42d7344fa62e0e8dad755e3e4d5c9d00daef293ae5e80e71f60e502`.
- Setup/constraints: Native model 5Ch; explicitly select Scene 1 or 2. Match Device number, enable exclusive reception. Resonance starts at 0Dh; 19h is zero offset.

### Yamaha AN200

- Source: [Yamaha AN200 - manufacturer MIDI documentation](https://usa.yamaha.com/files/download/other_assets/0/320970/AN200E.pdf).
- Scope: Owner Manual pp.119-123: 2.1.3 Native parameter change / table 1-1 and Current Voice Element Buffer.
- Original download SHA-256: `d5b6beeecea5813726f1e44b8a3733c769b29e86a63e7301adeebc537adf8e2b`.
- Setup/constraints: Native model 5Ch, Current Voice Element address 10 10. These are element parameters, distinct from Scene macro offsets 0F/10. Match Device number and enable SysEx reception.

### Yamaha FS1R

- Source: [Yamaha FS1R - manufacturer MIDI documentation](https://usa.yamaha.com/files/download/other_assets/4/317954/FS1RE2.PDF).
- Scope: Data List pp.37,39: 3.1 Parameter Change / Voice Common Parameter.
- Original download SHA-256: `8a56852fc0c8f6b0afdcdc64d34ac09995377cb71540791eba1cf00cf8848c66`.
- Setup/constraints: Native model 5Eh. Part selects Voice Common 40h-43h. All parameter changes carry two value bytes (MS7 then LS7), even for 7-bit values. Enable Receive System Exclusive.

### Yamaha CS1x

- Source: [Yamaha CS1x - manufacturer MIDI documentation](https://usa.yamaha.com/files/download/other_assets/9/318059/CS1xE2.pdf).
- Scope: Data List pp.21,23: 3-6-3-3 XG Parameter Change / MULTI PART table.
- Original download SHA-256: `edb412429578df588d0dac1dab0c8903837c17e427870e815aa3ae6aaa86f68f`.
- Setup/constraints: XG model 4Ch, Multi mode Part 1-16. Filter values are offsets: 00=-64, 40=0, 7F=+63. Drum voices ignore these tone edits. Not a native Performance Layer template.

### Yamaha CS2x

- Source: [Yamaha CS2x - manufacturer MIDI documentation](https://usa.yamaha.com/files/download/other_assets/0/317960/CS2XE2.pdf).
- Scope: Data List pp.30-31: 3-6-3-3 XG Parameter Change / MULTI PART table.
- Original download SHA-256: `d211291028825740d273e8dfb8202d4375f93facfdfe848e2629931492d67910`.
- Setup/constraints: XG model 4Ch, Multi mode Part 1-16. Filter values are offsets: 00=-64, 40=0, 7F=+63. Drum voices ignore these tone edits. Not a native Performance Layer template.

### Roland JX-8P

- Source: [Roland JX-8P - manufacturer MIDI documentation](https://cdn.roland.com/assets/media/pdf/JX-8P_OM.pdf).
- Scope: MIDI Implementation 3.2 Individual Tone Parameter (IPR), entries 34,35.
- Original download SHA-256: `a69079a36e5f6c906be68fdb55b66bb632c5b712b7bf9e18386e91983751ebd4`.
- Setup/constraints: IPR operation 36h, format 21h, Level/Group 01/01. Enable Exclusive and match basic MIDI channel. Original JX-8P protocol; not JX-10 or aftermarket firmware.

### Roland Alpha Juno-2

- Source: [Roland Alpha Juno-2 - manufacturer MIDI documentation](https://cdn.roland.com/assets/media/pdf/JUNO-2_OM.pdf).
- Scope: MIDI Implementation v1.1 (1986-01-27), 3.2 IPR; PDF p.48.
- Original download SHA-256: `3ffb31537401738f744d12f20efa028e537f2d0561a2c875679f9da13a2c2b9b`.
- Setup/constraints: JU-2 format 23h, Level 20h, Group 01h. Enable EXCL and match basic MIDI channel. No DT1 checksum or memory write.

### Roland Juno-106

- Source: [Roland Juno-106 - manufacturer MIDI documentation](https://cdn.roland.com/assets/media/pdf/JUNO-106_OM.pdf).
- Scope: MIDI Implementation 2.3, 3.3, 3.4; PDF p.35.
- Original download SHA-256: `e9315efe58f26236ad26d1cd6d0359aab284741186ed31cf0bbadb1d08902efe`.
- Setup/constraints: Set rear MIDI FUNCTION switch to III; match MIDI channel. Individual parameter function 32h, distinct from Alpha Juno IPR.

### Korg DW-8000

- Source: [Korg DW-8000 - manufacturer MIDI documentation](https://cdn.korg.com/us/support/download/files/13086de65e3a0799a65ed5024cc39cce.pdf).
- Scope: MIDI Implementation Parameter Change, PDF p.65; value-modified bitmap PDF p.68.
- Original download SHA-256: `dd69007b46fd2f1c15f3d1cc07b848bfe6583f3c1c1ecb4581ca74243c5f6757`.
- Setup/constraints: Set MIDI Enable (85) to 2; match MIDI Channel (84). Use value-modified offsets 15/16, not packed dump offsets. Cutoff 0-63, resonance 0-31.

### Korg DW-6000

- Source: [Korg DW-6000 - manufacturer MIDI documentation](https://cdn.korg.com/us/support/download/files/f39b6481322a3bd6743b5c77c964a866.pdf).
- Scope: Owner Manual MIDI Implementation Parameter Change, PDF p.48; bitmap printed p.48 / PDF p.50.
- Original download SHA-256: `41bf5ce8f19cc9380833f3cdac4ec5f4043edb84f73c8189e185b7d552841ca8`.
- Setup/constraints: Model 04h with fixed format ID 30h, distinct from the DW-8000 channel-coded format. Enable exclusive reception. Cutoff offset 5 and resonance offset 6 are unshared byte fields.

### Korg M1

- Source: [Korg M1 - manufacturer MIDI documentation](https://cdn.korg.com/us/support/download/files/e223761dc7dee38a7c3c76983ddf2ea1.pdf).
- Scope: MIDI Exclusive Format, PDF p.125: Program Parameter Dump Request 10h / Combination Parameter Dump Request 19h.
- Original download SHA-256: `6882c3cb2e62f4ef00a1366f327833bcab04a0134de040c74a4585e9e38cbf20`.
- Setup/constraints: Enable exclusive reception. Fixed requests ask the M1 to send its edit buffer. Replies are not automatically decoded here; this is not instantaneous controller-value readout. Prefer a push/button.

### Novation Bass Station II

- Source: [Novation Bass Station II appendix, AFX mode SysEx support, updated 2025-04-29](https://userguides.novationmusic.com/hc/en-gb/articles/25494271270930-Bass-Station-II-appendix).
- Scope: Official appendix: AFX mode SysEx support / Export.
- Original-byte SHA-256 unavailable: web reader accessed the official HTML; direct download returned HTTP 403.
- Setup/constraints: Requires firmware with AFX support. Select the overlay bank on hardware first. Value selects overlay index 0-24; its 106-byte reply is not decoded here. Read request only, no clear/save/import.

## Architecture and extension

`src/sysex-catalog/catalog.json` contains versioned, declarative model/command/source data. `catalog.ts` is a pure, browser-independent formatter/validator with no ports, storage, timers or sender. It renders independently calculated catalogue previews and bounded destination addresses, then emits a control-body string consumed by the existing BCL parser. `CatalogPicker.tsx` is loaded dynamically on first catalogue opening and gives its host a local source callback. It owns no MIDI permission. The BCR32 adapter supplies its selected control; the same picker can be composed by another host without importing a BCR32 session.

Do not add bulk writes, STORE, reset, bootloader or firmware messages to this starter set. A new model/parameter needs exact manufacturer scope, byte layout, ranges, addressing, side effects and independent expected-byte fixtures. Family similarity is not protocol evidence. Do not mark a checksum supported by native hardware merely because catalogue preview computes it.

The optional fourth `createHistory.record` argument forces one discrete local Undo step. Existing three-argument callers retain their typing coalescing behavior. No preset schema, custom-program representation, MIDI transport or broker permission changed.

## Validation

See the [work item](work-items/2026-10-29-synth-sysex-catalog.md) for the source revision, tests, browser workload, size and delivery boundary.
