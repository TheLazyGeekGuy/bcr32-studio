# Synthesizer SysEx catalogue

The built-in catalogue contains **22 model entries and 3,122 definitions**. The original20 models are retained; the MicrowaveII and XT variants are separated, and the Roland JV-2080 is added. This is coverage of the scopes below, **not a claim that every MIDI feature or bulk format of each instrument is implemented**.

The accent Catalogue button opens a responsive modal. One search filters instruments, parameter names and exact section names; the instrument selector and visible parameter list lead directly to addressing and preview. Definitions can be exported as SXM or loaded into an encoder rotation/push draft when the BCL adapter supports them. File operations share one folder menu; sources and coverage share one reference disclosure. Import, preview, browsing and export never send MIDI. Native BCR32 execution and physical synth qualification remain separate.

## Coverage

| Instrument | Definitions | Documented scope |
| --- | ---: | --- |
| Waldorf Microwave I | 166 | BPRD byte table and RTBP 60h, OS2.0; RTBP index = BPRD byte offset minus 5 |
| Waldorf Microwave II | 218 | SDATA |
| Waldorf Microwave XT / XTk | 219 | SDATA |
| Waldorf Blofeld | 305 | SDATA |
| Yamaha TX81Z | 110 | System Exclusive Data Format, printed pp.67,71-73 / PDF68,72-74; VCED and ACED |
| Yamaha DX7 | 170 | MIDI Data Format, printed pp.30-31 / PDF31-32; voice and function parameter tables |
| Yamaha DX7II FD / D | 157 | DX7II MIDI Data Format 5-1 VCED / PDF102 |
| Yamaha DX7s | 157 | DX7s Parameter Chart 5-1 / PDF98 |
| Yamaha DX21 | 93 | DX21 MIDI Data Format 5-2 VCED / PDF55; operator wire order4,2,3,1 |
| Yamaha AN1x | 110 | MIDI Data Table1-4 Current Voice Scene Buffer / PDF14-15; 10 1S address; waveform interpretation depends on sync algorithm |
| Yamaha AN200 | 113 | MIDI Data Format1-3 Current Voice Element Buffer, printed pp123-124; dynamic sound context, not Scene bulk buffers |
| Yamaha FS1R | 147 | FS1R Data List Table2 Voice Common and Voiced/Unvoiced operator parameters / PDF39-40; composite fields retain documented packed masks |
| Yamaha CS1x | 103 | MIDI Data Table Multi Part08 nn, XG model4C; CS1x PDF23-24 / CS2x PDF31-32 |
| Yamaha CS2x | 103 | MIDI Data Table Multi Part08 nn, XG model4C; CS1x PDF23-24 / CS2x PDF31-32 |
| Roland JX-8P | 54 | MIDI Implementation 3.2 Individual Tone Parameter, PDF28-29; enum ranges remain raw 0..127 intervals |
| Roland Alpha Juno-2 | 36 | MIDI Implementation 3.2 IPR, PDF48; tone parameters0..35 (chord-memory parameter48 separately scoped) |
| Roland Juno-106 | 18 | MIDI Implementation 3.3-3.4, PDF35;16 continuous values and2 composite switch bytes |
| Korg DW-8000 | 50 | MIDI Implementation5 parameter change / PDF65; DW-8000 BIT MAP / PDF66-67 |
| Korg DW-6000 | 26 | MIDI Data Dump Reference / DW-6000 BIT MAP, printed p47 / PDF49; composite raw bytes, not independent subfields |
| Korg M1 | 175 | MIDI Exclusive Format21 and Tables1/5, PDF126,128,131; EDIT PROGRAM mode with matching Single/Double layout; positions8..15 are wire positions, not dump offsets; requests1-10 / PDF125 |
| Novation Bass Station II | 7 | Official appendix / AFX mode SysEx support and Micro-tuning |
| Roland JV-2080 | 585 | JV-2080 Owner Manual MIDI Implementation1.3 Patch Common and Patch Tone / PDF188-190; temporary Patch Mode only |

## Explicit boundaries

- The largest expansions cover sound/voice tables. System, performance, rhythm, sequencer, effect-algorithm and bulk tables are included only where the scope explicitly says so. A large count does not imply whole-instrument completeness.
- M1 parameter41 uses **page/position8-15**, matching EDIT PROGRAM mode and its Single/Double layout. Memory offsets are not wire addresses. Packed switch/polarity fields and algorithm-specific effect positions remain inventory-only.
- JV-2080 parameters address the **temporary Patch-mode buffer** and its four Tones. System, Performance, Rhythm, user-memory writes and GS scale-tune blocks are not included. Wave numbers/tempo use two high-first nibbles; the DT1 complement checksum covers the four address bytes and data.
- FS1R covers Voice Common and the shared eight-operator Voiced/Unvoiced tables with explicit Part/Operator fields. Common6E packing remains unknown and is not synthesized. Packed composite bytes are identified as such.
- Bass StationII includes the documented AFX requests/copy/move/clear/save and one-note realtime tuning templates. Overlay import requires a captured payload. Its CC/NRPN table is a separate protocol; no fake SysEx wrapper is generated.
- TX81Z includes VCED/ACED, not an extrapolated PCED, tuning or system mapping. DX7 includes its separately classified function group; DX7II/DX7s use their own voice-table ranges and operator-selection extension.
- DW-6000 shared bytes and JUNO-106 switches are composite masks. Changing a composite value changes the whole byte, not a single independent sub-control.
- AN200 Control Matrix source exclusions in manual footnote11 still require exact reconciliation against the raw source IDs. Some DW logical limits also need a second manual reconciliation. These unresolved semantic constraints prevent claiming exhaustive valid-value coverage.
- Effect parameter interpretation and some oscillator/waveform ranges depend on the active algorithm. No automatic read-modify-write or hidden context switch is performed.

## Encoding corrections and compatibility

The MicrowaveI RTBP parameter number is relative to the180-byte BPR payload: subtract the five-byte BPRD header offset. Cutoff is index60 (`03 0C`), resonance61. The old starter examples used dump-byte offsets65/66. Existing user-authored programs are never silently rewritten. The historical alpha5 fixture and seed retain their original bytes solely for regression/provenance; the shipped expanded map and public example use the corrected address.

The DX21 wire operator order is4,2,3,1; TX81Z is4,3,2,1. These tables are distinct. CS1x/CS2x Detune uses high-first nibbles; AN two-byte values use high-first7-bit slices. FS1R always carries two7-bit value bytes.

The AN200 printed data range for Dry/Wet extends to8F despite a one-byte7-bit field and the text ending at7F; the implementation is bounded to7F. The Distortion switch description0/1 conflicts with printed00..00;0/1 is used and recorded. Octave Shift follows the discrete62/64/66 domain. These are documented reconciliation choices, not hardware observations.

## SXM domains and BCL projection

The required extension `org.midistudio.value-domain.v1` describes discrete raw values using a positive `step` relative to `value.minimum`, an explicit sorted `allowed` set, or both. Examples include Microwave octave/semitone steps, Blofeld octave steps and packed-byte gaps. Invalid intermediate raw values are rejected. Unknown required extensions are still refused.

BCL loading refuses discrete-domain mappings, signed logical ranges, unsupported slices and effects other than edit-buffer/request. Checksum templates remain file-only for native BCR32 execution. Exporting a definition is not permission to execute it. Signed M1 values are rendered in software with the documented14-bit two-complement representation; this does not grant a signed native BCL range.

## Source and build architecture

`src/sysex-catalog/tables/` contains reviewed normalized tables. `scripts/build-sysex-catalog.mjs` compiles them together with the retained historical seed into `expanded.sxm.json`. The compiler is offline and deterministic and needs no vendor binary, hardware, downloaded PDF or local research directory. The UI is lazy-loaded on catalogue opening; helpers own no MIDI ports or sender. The existing selected-control callback and host transport remain authoritative.

Run `node scripts/build-sysex-catalog.mjs`, `node scripts/test-sysex-catalog.mjs`, `node scripts/test-sysex-map.mjs`, TypeScript/build and the browser catalogue/map scenarios. Published standalone SDK and Python renderer support the domain extension. A scoped export removes that required extension when no selected parameter uses it.

The2MiB SXM input budget remains. For large valid maps the deterministic serializer omits indentation to keep its own output re-importable; smaller files retain two-space indentation. No limits were relaxed. Larger future collections require multiple SXM files, not an unbounded document.

## Manufacturer source ledger

### Yamaha TX81Z - manufacturer MIDI documentation

- Source: [Yamaha TX81Z - manufacturer MIDI documentation](https://usa.yamaha.com/files/download/other_assets/9/316769/TX81ZE.pdf).
- Retrieved: 2026-10-29; SHA-256: `a054ce349f0c59046baf955cfb1194195ff9e66d23fa2ad332509915f4ea67c0`; bytes: 3814856.

### Yamaha DX7 - manufacturer MIDI documentation

- Source: [Yamaha DX7 - manufacturer MIDI documentation](https://usa.yamaha.com/files/download/other_assets/9/333979/DX7E1.pdf).
- Retrieved: 2026-10-29; SHA-256: `a3bb18bafbb6d2ec03268b814ac495bb5dfdabbda53b52a46f510ebbc2ed9a42`; bytes: 5533964.

### Yamaha DX7II FD / D - manufacturer MIDI documentation

- Source: [Yamaha DX7II FD / D - manufacturer MIDI documentation](https://usa.yamaha.com/files/download/other_assets/7/320817/DX7IIE.PDF).
- Retrieved: 2026-10-29; SHA-256: `7ea6771f0a3c984173390561de5b86375181ae9cb1df6c7a175bdf8a24eb5ca6`; bytes: 5274118.

### Yamaha AN1x - manufacturer MIDI documentation

- Source: [Yamaha AN1x - manufacturer MIDI documentation](https://data.yamaha.com/files/download/other_assets/5/317965/AN1XE2.PDF).
- Retrieved: 2026-10-29; SHA-256: `ffa9ace5c42d7344fa62e0e8dad755e3e4d5c9d00daef293ae5e80e71f60e502`; bytes: 786697.

### Yamaha AN200 - manufacturer MIDI documentation

- Source: [Yamaha AN200 - manufacturer MIDI documentation](https://usa.yamaha.com/files/download/other_assets/0/320970/AN200E.pdf).
- Retrieved: 2026-10-29; SHA-256: `d5b6beeecea5813726f1e44b8a3733c769b29e86a63e7301adeebc537adf8e2b`; bytes: 6672606.

### Yamaha FS1R - manufacturer MIDI documentation

- Source: [Yamaha FS1R - manufacturer MIDI documentation](https://usa.yamaha.com/files/download/other_assets/4/317954/FS1RE2.PDF).
- Retrieved: 2026-10-29; SHA-256: `8a56852fc0c8f6b0afdcdc64d34ac09995377cb71540791eba1cf00cf8848c66`; bytes: 747123.

### Yamaha CS1x - manufacturer MIDI documentation

- Source: [Yamaha CS1x - manufacturer MIDI documentation](https://usa.yamaha.com/files/download/other_assets/9/318059/CS1xE2.pdf).
- Retrieved: 2026-10-29; SHA-256: `edb412429578df588d0dac1dab0c8903837c17e427870e815aa3ae6aaa86f68f`; bytes: 342670.

### Yamaha CS2x - manufacturer MIDI documentation

- Source: [Yamaha CS2x - manufacturer MIDI documentation](https://usa.yamaha.com/files/download/other_assets/0/317960/CS2XE2.pdf).
- Retrieved: 2026-10-29; SHA-256: `d211291028825740d273e8dfb8202d4375f93facfdfe848e2629931492d67910`; bytes: 489657.

### Roland JX-8P - manufacturer MIDI documentation

- Source: [Roland JX-8P - manufacturer MIDI documentation](https://cdn.roland.com/assets/media/pdf/JX-8P_OM.pdf).
- Retrieved: 2026-10-29; SHA-256: `a69079a36e5f6c906be68fdb55b66bb632c5b712b7bf9e18386e91983751ebd4`; bytes: 987286.

### Roland Juno-106 - manufacturer MIDI documentation

- Source: [Roland Juno-106 - manufacturer MIDI documentation](https://cdn.roland.com/assets/media/pdf/JUNO-106_OM.pdf).
- Retrieved: 2026-10-29; SHA-256: `e9315efe58f26236ad26d1cd6d0359aab284741186ed31cf0bbadb1d08902efe`; bytes: 1226575.

### Roland Alpha Juno-2 - manufacturer MIDI documentation

- Source: [Roland Alpha Juno-2 - manufacturer MIDI documentation](https://cdn.roland.com/assets/media/pdf/JUNO-2_OM.pdf).
- Retrieved: 2026-10-29; SHA-256: `3ffb31537401738f744d12f20efa028e537f2d0561a2c875679f9da13a2c2b9b`; bytes: 1844202.

### Korg DW-8000 - manufacturer MIDI documentation

- Source: [Korg DW-8000 - manufacturer MIDI documentation](https://cdn.korg.com/us/support/download/files/13086de65e3a0799a65ed5024cc39cce.pdf).
- Retrieved: 2026-10-29; SHA-256: `dd69007b46fd2f1c15f3d1cc07b848bfe6583f3c1c1ecb4581ca74243c5f6757`; bytes: 11302345.

### Korg DW-6000 - manufacturer MIDI documentation

- Source: [Korg DW-6000 - manufacturer MIDI documentation](https://cdn.korg.com/us/support/download/files/f39b6481322a3bd6743b5c77c964a866.pdf).
- Retrieved: 2026-10-29; SHA-256: `41bf5ce8f19cc9380833f3cdac4ec5f4043edb84f73c8189e185b7d552841ca8`; bytes: 2555016.

### Waldorf Microwave I - manufacturer MIDI documentation

- Source: [Waldorf Microwave I - manufacturer MIDI documentation](https://downloads.waldorfmusic.com/cloud/index.php/s/weTqE3SkZzocxYe/download).
- Retrieved: 2026-10-29; SHA-256: `08dde6bc05f8cfa5273ebd20e4786303a52211cfd7e86c739f9e70c6f7874e77`; bytes: 13235334.

### Waldorf Blofeld - manufacturer MIDI documentation

- Source: [Waldorf Blofeld - manufacturer MIDI documentation](https://downloads.waldorfmusic.com/cloud/index.php/s/ybExJgT4TzqT8ir/download).
- Retrieved: 2026-10-29; SHA-256: `6d3b6557b2a8ee377ff517460ec920a1dd8b576506f47d2bf40c553af82c80d5`; bytes: 105135.

### Waldorf Microwave II / XT / XTk - manufacturer MIDI documentation

- Source: [Waldorf Microwave II / XT / XTk - manufacturer MIDI documentation](https://downloads.waldorfmusic.com/cloud/index.php/s/2BLZXbKrMw3x26N/download).
- Retrieved: 2026-10-29; SHA-256: `9b544c45ba35c4ba8d8b3502fd30763ec8bc510f18aa8ea403119a9373ff3c85`; bytes: 2053766.

### Korg M1 - manufacturer MIDI documentation

- Source: [Korg M1 - manufacturer MIDI documentation](https://cdn.korg.com/us/support/download/files/e223761dc7dee38a7c3c76983ddf2ea1.pdf).
- Retrieved: 2026-10-29; SHA-256: `6882c3cb2e62f4ef00a1366f327833bcab04a0134de040c74a4585e9e38cbf20`; bytes: 7959347.

### Yamaha DX21 - manufacturer MIDI documentation

- Source: [Yamaha DX21 - manufacturer MIDI documentation](https://usa.yamaha.com/files/download/other_assets/5/320775/DX21E1.pdf).
- Retrieved: 2026-10-29; SHA-256: `a81463e25bc343de65b59ed46d4ff476e2441a45047f267a7af1c9b6f6e8195d`; bytes: 1566209.

### Yamaha DX7s - manufacturer MIDI documentation

- Source: [Yamaha DX7s - manufacturer MIDI documentation](https://usa.yamaha.com/files/download/other_assets/3/320813/DX7SE.pdf).
- Retrieved: 2026-10-29; SHA-256: `83fbea493f0730c710a6bf5c519dd79d90df2e9a3a61f04309983d6da5156dca`; bytes: 3410963.

### Novation Bass Station II appendix, AFX mode SysEx support, updated 2025-04-29

- Source: [Novation Bass Station II appendix, AFX mode SysEx support, updated 2025-04-29](https://userguides.novationmusic.com/hc/en-gb/articles/25494271270930-Bass-Station-II-appendix).
- Retrieved: 2026-10-29; SHA-256: `None`; bytes: not recorded.

### Roland JV-2080 Owner Manual / MIDI Implementation

- Source: [Roland JV-2080 Owner Manual / MIDI Implementation](https://static.roland.com/assets/media/pdf/JV-2080_OM.pdf).
- Retrieved: 2026-10-29; SHA-256: `668a223fcffdfe300f1816cdd0f538125ba829a6d2072df72d95b36a7e94e001`; bytes: 14935712.

## Review trace

Codex primary agent,2026-10-29 20:29 CET onward; repository `bcr-studio-firmware-103`, branch `work/sxm-full-catalog`, baseline `e9c85468f8f3c6f275c7d870f88d8f809e1e62dd`. Exact model identifier/effort are unavailable, so that provenance field remains incomplete. Tables/compiler, SDK, picker, examples, tests and this document were uncommitted during review. Manufacturer PDFs/text/OCR are outside Git under the ignored local research directory; source URLs/hashes above identify them. No physical synth test or production deployment is claimed.
