# Physical BCR32 custom-value feedback — unresolved native operation

Tracking: [issue53](https://github.com/TheLazyGeekGuy/bcr32-studio/issues/53), open. Specification: [spec004](../../specs/004-custom-hardware-feedback/spec.md). Software correction: alpha.20. **The requested physical ring/value feedback is not implemented or qualified.**

## Owner requirement and correction

The owner clarified that mouse rotation8 must update the **physical BCR32 ring/current value**. Alpha.19's `F0 7D … F7` output was the assigned external-instrument payload, not a demonstrated native ring setter. A host OUT row was insufficient acceptance. The first correction therefore addressed the wrong target.

Alpha.20 removes that output bridge, exact-value grant and unused queue/policy/tests. Ordinary value grants are restored to voice-only. Custom mouse/keyboard/screen/aux values remain local preview, with a translated status and contextual help. The assignment badge is only live when its own hardware connection is available. Existing `.tx` source/native programming, standard CC/NRPN, passive custom RX, preset storage and the MIDI-dialog HTML correction are retained. No hardware assignment is changed to CC, no `.default` write is used as a live-value surrogate, and no unknown command is sent.

## Evidence examined

| Source | Identity/scope | Finding and boundary |
| --- | --- | --- |
| [Manufacturer BCR32 manual](https://cdn-media.empowertribe.com/611d8696b95f80f8c46dbecd816d0b65/Manual_BE_0715-AAW_BCR32_A4_WW_2026-04-06_Rev1.pdf) | Rev1 filename, printed22–23/PDF12; retrieved2026-11-08; SHA256 `619f3ecfdf874210bf2c84e28b0d3d20583c83801781e53aee485ca8557fee04` | Controller assignments and SysEx import/export are described; these passages do not specify a per-control custom-value feedback API. Absence in these passages is not proof of no undocumented command. |
| Installed ControlTribe1.12.4 | Full executable SHA256 `8715b0703ad62a923822deb8b4f3c8eb5943d865f30f70b71940b3c3a44e5d6e`; bundle version read from plist | Same binary as prior project observations. Vendor application was not launched. |
| Derived arm64 slice | SHA256 `ef205432c7d6a669666d3de9bcbbc7fcc18158398ca4205dae4c0ada76ca41e7`; REA Mach-O parent evidence `ev_7800ae1b29f0046d23d2e4c26a0b84d666e6836a6aee1d8eefb998d468c8c8f1` | REA records slice identity/tool inventory; it does not observe execution. Imports/exports are explicitly non-exhaustive. Universal import was rejected by the Ghidra provider, then a locally thinned slice was opened. No deep whole-program Ghidra decompilation was needed or claimed. Session closed after retaining the receipt. |
| Bounded native disassembly | `BCR32Controller::setParameterState` at `0x1005c5ef0` (252 instructions), `BCR32ParamSync::sendCurrent` at `0x1005e8ff8` (180), `BCR32::makeParamCommand` at `0x1005bcd04` (128); source-bound local extracts | These paths construct/synchronize parameters and BCL assignment changes. No separately qualified current-value/ring setter was established by this bounded inspection. This is not exhaustive proof about the application or firmware. |
| Existing `docs/firmware-1.0.2-command-map.json` | Retained static inventory, firmware SHA256 `118219386423549ed497877accc1e18a7f285e9838abe1a3c15f9a344bdfb158` | Assignment/global/BCL/snapshot paths are inventoried. Value1/Value2 are assignment fields, not an established live-position setter. Internal/unknown commands remain untested. This is not firmware1.0.3 validation. |
| [Original B-Control implementation author's explanation](https://mountainutilities.eu/forums/can-bcr2000-respond-nrpn-or-sysex) | Mark van den Berg, section14.4 context for BCF2000/BCR2000 | Standard `.easypar` receive matching differs from custom-only `.tx` output. Historical context only: do not infer BCR32's full behavior from it. |

Local research artifacts are ignored by Git. The REA receipt is `output/research/bcr32-ring-feedback-2026-11-08-rea.json`; the manual is `output/research/bcr32-manual-feedback-2026-11-08.pdf`. Selected extracts originated in temporary files; hashes are `8f99d8dbe4d65b26de166875bb160738bf360f674e1c739bad8fa71dc0306b47`, `6e39d502c3ad2b6a5923c92fd7dd5efd8d3e33a797e6ba008a48749463d998e3`, `b925990546c9e650116e5aeb3d2f89258cd5fab24e1147ce74d0448548d98dbc`, in the order listed above. No proprietary executable or disassembly body is committed.

## Verification

- 60/60 existing unit/conformance scripts and TypeScript pass after removing the mistaken output-only test. Focused version check passes for alpha.20.
- Three isolated Chromium/fake-MIDI scenarios pass: custom mouse/keyboard preview with explicit limitation and zero custom/fallback/assignment output; BCL local editing/history/reload; checked assignment backup/OFF/upload/readback/explicit simulated STORE/restoration. The first also verifies passive SysEx still updates the local OLED and that switching to standard CC still sends a CC.
- Production build/distribution verification passes, with its existing large-chunk warning. Whitespace check passes.
- No physical MIDI command, assignment/global/preset write, STORE, firmware operation or ControlTribe execution was performed for this investigation. Software tests do not clear the native hardware gate.

## Next acceptance gate

Identify a BCR32 firmware-specific value setter or demonstrated receive-matching mechanism; establish exact bytes, target index, range, effects and firmware before a targeted test. Physical ring/value agreement is required independently of a host log. Do not sweep unknown opcodes or reinstall native BCL on every drag.

An alternative CC/NRPN hardware assignment plus MIDI Studio SysEx translation is a separate workflow: it changes the native assignment and requires the host running. A preference question was sent to the owner; no conversion is applied while that decision is pending. Failure of the earlier indexed assignment scan is a separate unresolved synchronization issue, not proof of native SysEx value feedback.

## Review trace

Repository `bcr-studio-firmware-103`, branch `work/sysex-bcl-inspector`, clean baseline `090ae2c12ad2f112b72524b45aa5d6b5e6f0c4bb`. Read broker, BCR32 registration/workbench/custom editor/CC sender, existing protocol inventories and the paths above. Runtime/test/spec/docs/version changes were uncommitted during verification. Reader: Codex primary, 2026-11-08 10:58–11:09 CET. Exact model identifier and reasoning effort unavailable; provenance is incomplete for these fields. No push, merge, main change or production deployment.
