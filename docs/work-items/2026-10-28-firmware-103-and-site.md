# Local work items: firmware 1.0.3 and product-site routing

Status: **implemented locally; joint browser/hardware acceptance and publication remain separate gates**.

## Review trace

- Reader/implementer: Codex, primary agent, 2026-10-28 13:02–13:35 CET. Exact runtime model ID and effort are not exposed; the review is not fully traceable at those two fields. No independent/sub-agent review is claimed.
- Repository `TheLazyGeekGuy/bcr32-studio`, baseline full SHA `5afd1ff5b258e84384d753a12ba8b9aac6b35b76`; isolated `work/firmware-103-sequencer` worktree. The final implementation is on this branch, not main. No remote push, merge or deployment was performed.
- Read paths: `src/editors/bcontrol/bcr32/{Workbench,SequencerView,registration,host-policy,firmware-codec,zaquencer}.tsx/ts`, shared MIDI broker, build/offline/distribution files, architecture/deployment/protocol documentation, existing tests. Source files were clean on the baseline; subsequent uncommitted modifications were this implementation.
- Reused presentation source: `<workspace>/bcr-studio/site-prototype/{index.html,site.js,style.css,assets/}`. It was **untracked**, outside the target branch; parent repository full SHA `d4f024b2fa1a198d44e772003c53edae307e4bcf` does **not** version that presentation. The source was preserved, not moved or deleted. This branch captures the incorporated copy.
- External local application/firmware evidence and their SHA-256 digests are listed in [the protocol reference](../BCR32-PROTOCOL-1.0.3.md). No signed URLs, downloaded executables or firmware binaries were added to Git.

## BCR103-01 — Analyze the actual current release

- [x] Identify the latest standalone sequencer editor instead of modifying an old firmware worktree or MIDI Studio main.
- [x] Verify ControlTribe 1.12.4, installed BCR32 1.0.3, downloaded firmware identity and official release notes.
- [x] Recover host framing, lane selectors, signed packing and response structure from focused ARM64 functions.
- [x] Store actual response fixtures and distinguish binary inference, hardware evidence and unverified semantics.

## BCR103-02 — Connect the existing sequencer UI

- [x] Pure host codec and bounded single-flight session, using the existing instance lease/broker.
- [x] Automatic 36-lane step read on entering the connected 1.0.3 sequencer; read-again button.
- [x] Explicit live editing, device/state/range guards, reply confirmation and bounded coalescing queue.
- [x] Disarm on lock, disconnect, pattern change, errors, stale snapshot or divergent unsent local changes.
- [x] Keep file workflows, keyboard entry, note lanes and undo; block misleading full-preset `.syx` exports of a partial host capture.
- [x] Hardware: note 60 → 61, independent read-back, restoration to 60 independently checked; no STORE. All four tracks/nine lanes read. Native capture: 43 requests and replies over 821 ms, including pacing and restoration.
- [x] Broker regression: old/future firmware, locked state and unrelated STORE remain refused.
- [ ] Joint local user test of actual sequencer editing and front-panel behavior.
- [ ] Individually validate the other eight writable fields, playback behavior and multi-edit stress against hardware.
- [ ] Add track/global controls, new device settings, verified transport and persistent sequencer storage as separate validated work, not guessed opcodes.

## BCRSITE-01 — Presentation at root, application under `/editor/`

- [x] Reuse the existing composition and assets; retain its starfield, mode switch, reveal and language interactions.
- [x] Root presentation loads no editor bundle and requests no MIDI. Local Open editor links target `/editor/`.
- [x] Two Vite HTML entries, corrected public assets/font/documentation resolution, legacy explicit editor/workspace deep links.
- [x] Separate offline HTML navigation for root/editor; keep one project-root service-worker scope.
- [x] Remove external font dependency, stale local-demo links and inaccurate inherited feature/safety promises; clarify alpha and firmware boundaries.
- [x] Update smoke check to verify both entries and the build manifest, not an obsolete `index-*.js` filename.
- [x] Version 0.45.0-alpha.12, changelog, README and English integration documentation.

## Validation evidence

- `npm test`: **47/47 scripts**, including original 45, plus TypeScript check.
- `META_CSP=1 npm run build`: passes; existing large editor/PDF chunk warnings remain (not a new memory measurement).
- `scripts/e2e-zaq-host.cjs`: passes on development and production builds with simulated MIDI only. Root → editor, no MIDI on root, 36 automatic reads, live note edit, undo, disarm and no STORE.
- `scripts/e2e-site-offline.cjs dist`: passes with a production build under `/bcr32-studio/`, then a real offline browser context. No mix-up between the two HTML documents and no hardware access.
- `scripts/smoke-test.mjs`: local production preview serves both entries and manifest version 0.45.0-alpha.12.
- Generic publication scan (`leak-gate --ci`): passes. Full private scan **does not pass**: the private denylist flags the copied public manufacturer domain/URLs and old commit history. Personal home-directory paths found in new documentation were removed. The privacy gate itself and historical commits were **not** weakened or rewritten. Maintainer review remains required before publication.

## Local handoff

Run `npm ci`, then `npm run dev -- --port 5186` (development) or `npm run build && npm run preview -- --port 5187 --strictPort` (compiled preview).

- Presentation: `http://127.0.0.1:5187/`
- Editor: `http://127.0.0.1:5187/editor/`

For joint testing, leave a single writer active against the BCR32. Opening the sequencer reads its current step values. Live editing is initially off. No firmware update, mode change or permanent save is automatic. This is a local handoff, not a public deployment or certification of all 1.0.3 features.
