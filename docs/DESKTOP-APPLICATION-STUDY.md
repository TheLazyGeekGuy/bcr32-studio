# Optional desktop application and MIDI feedback

Status: architecture study,2026-10-30. No desktop binary, installer or native RX/TX provider is delivered by this change. The static web edition stays the default independent distribution.

## Existing integration seams

Source baseline `1726b6217e958e8026bbe65a51e658c9a3e31b5f`, read2026-10-30 10:45–10:51 CET by Codex primary agent. Exact model/effort are unavailable. Initially clean; the accompanying catalogue/docs changes were uncommitted during review.

Read paths: `src/{main.tsx,web-midi.ts,midi-permission.ts}`, `src/editor-host/{runtime.ts,midi-broker.ts,midi-topology.ts,native-presence.ts,WorkspaceApp.tsx}`, `native/midi-presence.mjs`, `build/native-presence.mts`, `vite.config.mts`, package manifest and existing native MIDI scripts. The upstream platform skill's CORE-MODULE-API/BROWSER-PLATFORM-ROADMAP/BUILD-DISTRIBUTIONS documents are not present in this dedicated checkout; no API was inferred from those missing documents. This study concerns the actual standalone implementation.

- The product site and `/editor/` are separate build entries. Package the same editor assets and lazy module chunks; do not reimplement the UI.
- `createEditorRuntime({requestAccess})` already accepts an injectable access factory. `MidiAccess`/`MidiPort` and the existing broker provide the compatibility target.
- `WorkspaceApp` currently supplies browser `automaticMidiAccess()` itself; standalone/root composition must also accept an optional provider before a desktop app can inject it throughout. This is an identified delta, not an already implemented prop.
- The current native helper **only enumerates** ports. Its implementation explicitly never opens a port, installs an RX callback or sends a message. It helps presence checks; it is not a complete MIDI bridge.
- `@julusian/midi`3.8.1 is already a dependency and native scripts use it. Existing script success on macOS does not prove an Electron-packaged driver, Windows/Linux hotplug or timing behavior.

## Feasibility and choice

Both approaches can embed this React/Vite editor and work offline with installed MIDI drivers:

| Option | Reuse and cost | Qualification still required |
| --- | --- | --- |
| Electron + existing Node MIDI binding | Reuses JS/TS and the existing native dependency. Chromium renderer plus privileged main/utility process and narrow preload API. Recommended first desktop proof of concept to minimize new protocol/driver work | Native module rebuild/package per Electron ABI, signed binaries, OS driver/hotplug tests; memory/startup measurements |
| Tauri2 + Rust `midir` adapter | Reuses the frontend with the system webview; native Rust provider replaces the Node dependency | A new adapter, callback/timestamp/disconnect tests, webview behavior and platform packaging; cannot assume Web MIDI support inside every system webview |

This recommendation is an engineering inference from current dependencies, not a measured memory/performance winner. Keep a single provider contract so Tauri can be evaluated later without editing every instrument module. Do not install a local HTTP service as a mandatory dependency of the browser edition.

Primary references: [Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model), [native modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules), [Tauri architecture](https://v2.tauri.app/start/), [midir](https://github.com/Boddlnagg/midir). Framework capabilities are upstream claims; product integration remains proposed.

## Proposed provider contract and ownership

Extend composition additively, with the browser factory as fallback:

```typescript
interface MidiProvider {
  request(sysex: boolean): Promise<MidiAccess>;
  dispose(): Promise<void>;
}
```

This is a proposed composition contract, not a new exported SDK. Wrap it into `requestAccess`'s existing `{access, sysexError}` result, preserving SysEx-denied/voice-only fallback. Add optional provider injection at workspace/standalone composition; modules still receive their existing host leases. Closing one editor releases its lease, not the entire provider; only the application root disposes the provider.

| Owner | Responsibility |
| --- | --- |
| Browser provider | Existing permission flow, Web MIDI events and capability detection |
| Native backend | Enumerate/open/close OS endpoints, byte RX/TX, monotonic timestamps, topology and error events; bounded queues and explicit disposal |
| Preload/adapter | Translate a narrow typed IPC API into `MidiAccess` maps, open promises, port sends and state events; no Node API in the renderer |
| Studio host | Port leases, conflict checks, device validators, generations, request/read-back state, monitoring and translator routing |
| Device/family module | Manufacturer protocol, available read/write/feedback operations, firmware compatibility and assignment/value semantics |

Proposed IPC messages: `listPorts`, `openPort`, `closePort`, `sendPacket`; events `topology`, `packet`, `portError`, `overflow`. Include backend session/generation and endpoint token, not a bare changing numeric index. Resolve duplicate names explicitly; an inventory API returning names cannot guarantee stable physical identity across replug. Reject stale-generation sends and never silently bind a replacement device.

`MidiPort.send` is synchronous in the current interface. Queue admission must fail synchronously when closed/full; later driver failures must transition connection state and fail pending transactions. A queued IPC send is neither device delivery nor ACK. Wait for actual backend open confirmation before marking connected. Define how multiple windows share one backend/broker authority before enabling detachable windows; never create competing physical port owners.

Keep the renderer isolated with a narrow preload and local packaged assets; no arbitrary remote page receives device access. Use installed OS MIDI APIs/drivers. Preserve the host allowlists for firmware/STORE/global changes. Disconnect cancels pending transfers and revokes grants just as in the browser path.

## Feedback: what becomes possible

```text
physical device → OS MIDI callback → native provider → existing broker → module decoder → UI
UI action → module encoder → existing broker validation → native provider → physical device
```

Yes: LEDs, ring values, supported LCD/OLED messages, motor position and parameter responses can travel both ways when the selected device/firmware implements their protocols. The native edition can remove browser MIDI availability constraints and own callbacks independently from UI renders. It cannot create absent commands, retrieve a non-queryable encoder value, prove durable STORE from an ACK or prevent another application from opening a shared OS port.

The on-screen OLED, a detached editor window and the physical OLED are three separate presentation targets. A native window can show the existing display component; writing the physical display still needs a device-specific command. The [open demo audit](BCR32-OPEN-FIRMWARE-AUDIT.md) supplies local display routines but no remote display API. X-TOUCH MCU feedback is a different device protocol and does not transfer to BCR32 by inheritance.

Do not echo every RX event into TX. Keep physical-input observation, UI intent, read-back and feedback distinct. Preserve source monotonic timestamps, process ACK/SysEx independently from display refresh, batch continuous value presentation and coalesce only replaceable feedback. Never coalesce away SysEx fragments, note edges or transaction responses. Clock handling must preserve timing evidence; renderer FPS is not MIDI timing.

## Build, storage and acceptance plan

1. Add the optional provider composition seam, with unchanged browser fallback tests and unlike/duplicate module sessions.
2. Build an Electron proof of concept with local Vite output and one native backend; no automatic firmware/STORE at startup. Persist desktop drafts in an explicit app data directory and provide import/export migration—browser localStorage is not automatically the desktop app's storage.
3. CI matrix: macOS arm64/x64, Windows x64 and Linux x64 as intended targets, with native-module build/rebuild per target. Select actual supported architectures after toolchain/package verification. Sign/notarize installers where applicable; development executables do not prove distributable releases.
4. Fake backend acceptance: SysEx and voice fallback, hotplug/replug, duplicate names, occupied port, hidden-view RX, queues/overflow, failed native sends, close/reopen and root disposal. Ensure browser bundles import no native driver.
5. Physical acceptance on available BCR32 and X-TOUCH: supported read/write/LED/display paths, no unsolicited motor reset/echo, unchanged persistent state and independent read-back. Test Windows/Linux on actual hosts; a macOS build cannot certify them.
6. Measure before comparing frameworks: cold start, idle RSS, active/closed module memory, sustained RX p50/p95/p99 delivery latency, dropped messages, UI frame latency and recovery after unplug. Record source SHA, OS/hardware, raw samples and workload. Proposed budgets are decided from those baselines, not invented here.

The next implementation ticket should cover the optional provider seam and a minimal desktop transport proof of concept, not a second MIDI engine or a rewrite of all modules. Keep custom firmware/OLED research and native BCL checksums in separate tickets.
