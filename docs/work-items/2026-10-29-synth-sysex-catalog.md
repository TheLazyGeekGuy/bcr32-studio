# Load a curated synth SysEx catalogue from the control editor

Status: implemented locally in **0.46.0-alpha.5**. Twenty synth models and 46 templates, including Waldorf Microwave and Yamaha TX81Z. Physical synth qualification and publication are not claimed.

## Scope and invariants

Provide searchable, manufacturer-documented parameter templates, destination addressing and local BCL/SysEx loading for the selected rotation or push. Preserve the current parser, history, explicit hardware transfer and STORE separation. Importing the catalogue, searching and loading a template must never send MIDI. No firmware, bulk-memory write, reset or automatic hardware qualification is included.

## Acceptance

- Twenty explicitly identified model entries with useful commands, value ranges, addressing semantics, primary source sections and evidence status.
- Channel/device/part changes produce bounded documented bytes. Microwave generations remain separate.
- A template loads into the current control draft, with Undo and without changing another control. Both SysEx and BCL Type entry points can browse it.
- Unsupported native checksum programs remain explicitly file-only; no implicit grant expansion.
- Offline catalogue available in the built editor; no external request needed at use time.
- Pure codec fixtures, browser selection/local-only/rotation-push checks, existing regression tests, typecheck and production build pass.

## Review trace

Codex primary agent; exact model and reasoning effort are not exposed. Read from 2026-10-29 10:07 CET onward, repository `bcr-studio-firmware-103`, branch `work/bcr32-bcl-sysex`, initially clean baseline `fd72cdb45ab03ed9ee8064fa4041e717e8e1d678`. Read existing `src/bcl-tx.ts`, BCR32 custom program editor and integration/transfer/browser tests. New work is uncommitted until the completion record. Manufacturer originals, extracted text and scanned appendix renders are retained outside Git in `output/research/sysex-catalog/`; durable source URL/hash/page records will accompany the catalogue. Source PDFs are reference material, not instructions.

## Completion record — 2026-10-29 10:24 CET

Implemented `src/sysex-catalog/{catalog.json,catalog.ts,CatalogPicker.tsx}`, composed lazily by the existing BCR32 `CustomProgramEditor.tsx`. No new MIDI engine or permissions were added. Optional discrete history recording preserves the precise BCL draft before a catalogue load; existing callers retain normal coalescing. User/technical reference is `docs/SYNTH-SYSEX-CATALOG.md`.

Scope review: Codex primary, exact model/effort not exposed, full clean baseline `fd72cdb45ab03ed9ee8064fa4041e717e8e1d678` plus the uncommitted catalogue, custom editor, history, scoped CSS, tests, documentation and synchronized version/site metadata at review time. Read manufacturer material in the source ledger; originals/OCR/renders under ignored `output/research/sysex-catalog/` are outside Git. Novation official HTML was read through the web tool; direct retrieval returned 403, so no original-byte hash is claimed. JX-8P manufacturer's MIDI table was also cross-checked through the web reader. No source from a third-party editor is used as protocol authority.

Validation:

- `npm test`: **52/52** test scripts and TypeScript passed.
- `META_CSP=1 npm run build`: passed; distribution verified.
- Pure catalogue fixture: all **4,115** bounded values, malformed destination values, independent manufacturer-specific expected frames, checksum calculation, source/parse parity, discrete Undo and immutable-by-use builders passed.
- New `e2e-sysex-catalog.cjs`: passed on the production preview, injected fake MIDI only. All 20 model options, search/no-result, invalid address refusal, Microwave checksum preview/file-only restriction, TX81Z channel/algorithm load, rotation/push isolation, Apply/reload, Undo and zero write frames.
- Existing `e2e-bcl-sysex.cjs` and `e2e-custom-program-transfer.cjs`: passed with fake MIDI, including explicit read/write/STORE/restore paths and push defaults.
- Extended `e2e-site-offline.cjs`: passed with real service worker, project subpath and disabled network. The catalogue had never been opened online; its first open, search and load succeeded offline. No physical MIDI API was available in this scenario.
- `node scripts/leak-gate.mjs --ci`: generic rules passed on 398 files and 329 reachable commits at that pre-commit run.
- `git diff --check`: passed.

Measured limits:

- Production catalogue chunk: **27.62 kB / 6.89 kB gzip**. Browser fixture proves it is not requested by the standard editor before opening the catalogue. Offline installation may precache its bytes without instantiating the picker.
- Parent registration bundle: 280.90 → 281.47 kB (rounded Vite output); main editor bundle stayed 578.96 kB. No retained-heap reduction is claimed.
- Initial local codec workload: 10,000 Microwave checksum previews in **2.97 ms**, one Node sample; no real MIDI rate or synth timing claim.
- Browser catalogue first open: **845.9 ms including Playwright click/scroll/actionability and render**, one Chromium sample on this Mac; not an isolated paint latency or a regression comparison.

Protocol decisions and remaining gates:

- Twenty models is a curated starting set, not a measured popularity ranking or complete per-synth editor.
- Original Microwave templates use `cks-2 5`. Preview is computed by the catalogue; BCL remains partial/file-only and the existing native transfer gate rejects it. No guessed checksum execution was enabled.
- DW-6000 format 30h is fixed; the DW-8000's channel-coded format is not extrapolated to it. Yamaha Device numbers, channels, raw offset ranges, AN200 element/scene distinction and FS1R two-byte values remain model-specific.
- M1 and Bass Station II entries are documented requests, not automatic dump importers. Reply decoding, real-device response and persistent storage remain separate work.
- No physical MIDI, GitHub push or deployment was performed. Local preview uses port 5193 under `/editor/?native=0`.
