# Five reproducible random catalogue checks

Date:2026-10-30, 00:04–00:07 CET. Reader: Codex primary agent; exact model identifier/effort unavailable, so that provenance field is incomplete. Repository `bcr-studio-firmware-103`, full baseline `08d4b91d016d8273bf0c9f871c424221c9729611`, branch `work/sysex-bcl-inspector`, initially clean. Read catalogue/SXM/BCL/native-preflight code and the existing catalogue tests. New sampling script and this report were uncommitted during verification. Outside Git: raw JSON under ignored `output/research/random-sysex-sample-20261030.json`, SHA-256 `ea27c5148f6f55629414dbe1ae217896c608309e0b1e723018d5d060e933e5c8`.

Scope: **software only**. No MIDI input/output port was opened; no BCR32 or external synth write was sent. Source-readback, physical emission, persistent STORE and synth acceptance are not tested. Native checksum issue41 remains open.

## Method

Reproducible seed `20261030`. One parameter/value/address tuple is drawn from each of five scoped pools: Microwave checksum, JV checksum, TX81Z simple, FS1R simple, M1 signed. This is a stratified sample, not a claim of uniform sampling across all3,122 definitions. Each TS frame is compared with the independent Python renderer. Invalid value/field boundaries are refused. Simple definitions additionally pass BCL evaluation parity and encoder8/push8 fragment validation; unsupported checksum/signed definitions must remain refused.

| Model | Parameter | Value | Native preflight |
| --- | --- | ---: | --- |
| Waldorf Microwave I | Vol Envel Attack Modifier Amount | 126 | refused: checksum is file-only |
| Roland JV-2080 | Tone 1 / Filter Resonance Velocity Sensitivity | 117 | refused: checksum is file-only |
| Yamaha TX81Z | Operator 2 Decay 1 Rate | 2 | software preflight accepted; hardware not exercised |
| Yamaha FS1R | VOICED EG - time scaling | 5 | software preflight accepted; hardware not exercised |
| Korg M1 | Double / Filter 2 Envelope Velocity Intensity | 59 | refused: signed BCL range |

## Generated software frames

- `parameter-77`; fields `{"device": 84, "part": 3}`: `F0 3E 00 54 60 02 04 0D 7E 11 F7`.
- `tone-1-84`; fields `{"device": 25}`: `F0 41 19 6A 12 03 00 10 54 75 24 F7`.
- `18-27`; fields `{"channel": 4}`: `F0 43 13 12 1B 02 F7`.
- `operator-21`; fields `{"device": 8, "operator": 6, "part": 2}`: `F0 43 17 5E 61 05 15 00 05 F7`.
- `edit-double-11-8`; fields `{"channel": 5}`: `F0 42 34 19 41 0B 08 3B 00 F7`.

Result: five software checks passed, including three expected native refusals. Two simple definitions pass software preflight only; no physical hardware success is inferred. TS/Python agreement tests serialization of the same definitions, not independent proof that every manufacturer address/range is correct.

Reproduce: `rtk proxy node scripts/test-sysex-random-sample.mjs` (optional `SXM_TEST_SEED`). This verification changes no application version, MIDI grant, parser capability or firmware gate.
