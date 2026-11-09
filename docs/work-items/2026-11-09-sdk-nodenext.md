# SDK NodeNext declaration fix — 2026-11-09

## Evidence

Source: BCR32 Studio `05ee0346d9b21eca92695f8c61f67ca2a25972e3`, clean work branch before correction. Read by Codex primary, 2026-11-09 11:49 CET. Exact model identifier and effort are unavailable; model traceability is incomplete. Read `src/sysex-map/index.ts`, `value-domain.ts`, SDK build script and GitHub run42603118740 failed log. No outside-Git source or hardware input.

CI passed the project tests and web build, then failed at `build:sysex-map-sdk`: TS2834 on the exported value-domain declaration. The prior local merge verification omitted this separate CI step. The same failure was reproduced locally.

## Correction

Use explicit `.js` relative module specifiers for the SDK value-domain imports/exports and its type-only dependency, following existing SDK ESM conventions. No data, API, SysEx or MIDI behavior changes. The actual generated-package NodeNext consumer check now passes; no CI check was removed or relaxed.

## Acceptance

Use the complete existing CI chain: tests/typecheck, web build, standalone SDK build plus NodeNext consumer, generic scan and full private pre-push scan. Submit this correction through a PR and wait for required checks before merging. Hardware validation is unrelated to this declaration-only fix.

Local acceptance: 61/61 scripts and typecheck, web build/distribution, standalone SDK NodeNext consumer, generic and full private scans pass. Remote acceptance is tracked by the pull request and CI run.
