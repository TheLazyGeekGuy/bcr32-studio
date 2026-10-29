# Unify controller/sequencer page switching

Status: local UI correction verified; physical-button receive integration pending a captured event.

## Traceability

Codex primary agent, exact model identifier/effort unavailable, 2026-10-29 19:14–19:20 CET. Repository `bcr-studio-firmware-103`, branch `work/bcr32-bcl-sysex`, baseline full commit `886b8ac04ecc7f240c15d9e96d93f27f2467754b`. Read Workbench, FrontPanel, SequencerView, useSequencerHost, zaq-host, controller-presets and the sidebar/browser tests. Implementation changes to Workbench and those tests were uncommitted during verification. Outside Git: installed ControlTribe1.12.4 binary and bounded local disassemblies under `/tmp`; they do not establish an observed physical mode event.

## Confirmed correction

The on-screen ZQR/CTRL key previously used an opt-in, default-off preference and only set local editor state. It now calls the same `chooseEditorMode('sequencer')` action as the top toolbar. The obsolete preference and misleading view-only settings UI are removed. Existing lock/busy guards, qualified hardware page commands, sequencer automatic reads and nonpersistent operation boundaries remain unchanged. Native commands are `F0 00 20 32 7F 64 0B F7` for sequencer and `…0C F7` for controller. No STORE or new opcode is introduced.

The production build/typecheck, sidebar checks and full sequencer browser scenario with simulated MIDI passed. The extended browser scenario clicks the actual panel key, checks the selected view and outgoing0B, returns through the top Controller button and checks outgoing0C, then runs existing automatic read/edit/follow/cursor/import/no-STORE coverage. These tests do not prove the physical screen state.

## Physical direction still pending

The owner requested that a physical ZQR/CTRL press also switch the editor. An input-only recorder was opened at19:14 CET, and controller/global polling was suspended by selecting Files. The owner was asked to press once and identify the resulting physical mode. No confirmed physical-button event or resulting mode has yet been received at this checkpoint. A development hot reload briefly restarted ordinary assignment reads; Files was reselected afterward. Do not classify those query responses as a physical mode change.

Do not infer current page from `.startup`, the USB operating mode, the sequencer running flag or an outgoing page command. Receipt-driven navigation must not echo page commands or reassert the previous page through automatic readers. Complete the physical capture and strict parser/context tests before claiming bidirectional page synchronization.
