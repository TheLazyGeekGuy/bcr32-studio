# Publish SXM documentation, site and editor to GitHub and Forgejo

Status: completed — published to both source repositories and GitHub Pages.

Owner request on 2026-10-29 authorizes adding SXM to the public website documentation, committing and pushing to the existing GitHub and Forgejo repositories. Existing GitHub Pages publication is included. No hardware operation, forced push or modification of local main is needed.

## Source and review trace

Codex primary, exact model/effort not exposed. Review began 2026-10-29 10:49 CET on `bcr-studio-firmware-103`, `work/bcr32-bcl-sysex`, initially clean full commit `ec48aee5bf0ce27bed3d60c58bcd60a12968af95`. Read the site, Vite/docs/offline build hooks, deployment workflows, previous publication/privacy record, source format and unit/browser fixtures. Changes reviewed include the then-uncommitted documentation build plugin, pinned Markdown renderer, site navigation/EN-FR labels, offline document routing, tests, changelog and synchronized version metadata.

The standalone checkout has no VitePress portal sources/dependency. It now renders the canonical SXM Markdown into four static pages using a pinned build-only Markdown dependency; no second handwritten specification or runtime Vue application is introduced. Route: `/docs/sysex-map/`. Downloads include schema, portable examples, Python renderer and independent ES module. Documentation content remains English as requested.

The checkout's dependency symlink was detached before `npm ci`; the other project's shared dependency directory was left untouched. The original link target is retained only in ignored local output. Fresh declared React/ReactDOM 19.3.1 and marked 18.1.2 are used for candidate checks.

## Publication plan and acceptance

- Version 0.46.0-alpha.7, site and editor updated from the same build.
- Four generated documentation pages with internal-link/download integrity, site EN/FR entry points, no MIDI scripts and offline navigation.
- Full tests/typecheck/build and standalone SXM SDK check, browser documentation/editor/offline checks and privacy review.
- Clean isolated release checkout: recheck both remote main branches as ancestors, ordinary fast-forward pushes only; no local main checkout/reset.
- Verify remote SHAs, successful GitHub CI/Pages and actual HTTP content at site/editor/docs/downloads. Push, deployment and device proof remain distinct.

Initial GitHub main: `55107e924d4da8988734a37975dffaaf1dfed506`. Initial Forgejo main: `f96c4c09ba08da71b13b54db35f2635f703ffcea`. Both were confirmed ancestors, with no remote-only commits. Remotes are the existing public repositories for this project. Previous owner permission covers contextual scanner matches on public manufacturer documentation; the scanner is not weakened and any nonzero result is reviewed rather than reported as an automated pass.

## Local candidate verification — 2026-10-29 10:54–10:56 CET

Fresh declared dependencies: 54/54 scripts, TypeScript, META_CSP production build/distribution and standalone SXM SDK/NodeNext consumer check passed. Browser tests passed for EN/FR site links, all four documentation pages, schema download and 20-model catalogue without MIDI access. The real-service-worker subpath test covers offline editor/catalogue/SXM exchange plus documentation root and architecture navigation. Documentation assets are generated from tracked sources and explicitly precached; the worker resolves only inventory-listed documentation pages, preserving application/root boundaries. Marked is a pinned build dependency only and is absent from browser application code.

Source Markdown, HTML links, dependencies and offline routing were reviewed by Codex primary, exact model/effort unavailable, against the full baseline above plus the identified uncommitted candidate. No native hardware, local main or unrelated worktree was modified. Existing native dependency install scripts were not run by npm's current policy; no physical MIDI acceptance is claimed.

## Isolated candidate and push receipts — 2026-10-29 10:57–10:59 CET

Clean isolated candidate **`c79beb67d046cbd55141b7af8edec79bf5a2f921`** passed 54/54 tests, TypeScript, the production build/distribution, standalone SDK and four release browser fixtures (public documentation, SXM exchange, simulated custom-program STORE/restore and subpath/offline navigation).

Generic privacy gate passed **421 files / 96 reachable commits** in the isolated graph. Full private gate returned five contextual file findings, matching the previously reviewed public manufacturer URLs and ordinary technical documentation substring; no new finding or historical identity finding was reported. The two older publication/transport work items carrying these findings were independently confirmed unchanged from the published baseline. No secret or private capture is included. The owner's prior permission for these nonconfidential source references applies; this nonzero scan is not called an automated pass. No hook, denylist or branch protection setting was changed.

Ordinary fast-forward pushes succeeded:

- GitHub main: `55107e924d4da8988734a37975dffaaf1dfed506` → `c79beb67d046cbd55141b7af8edec79bf5a2f921`.
- Forgejo main: `f96c4c09ba08da71b13b54db35f2635f703ffcea` → the same candidate.

GitHub reported its existing administrator exemption from PR/expected-status requirements. Local checks had passed first; no review/check was forged or protection disabled. GitHub CI run **40853836121** and Pages run **40853836250** were created. Their completion and public HTTP evidence are recorded below after verification. Optional Cloudflare deployment remains disabled/skipped. Forgejo is a source mirror here; a push is not a separate hosted-site deployment claim.

## Public delivery verification — 2026-10-29 11:01 CET

GitHub CI [40853836121](https://github.com/TheLazyGeekGuy/bcr32-studio/actions/runs/40853836121) and Pages [40853836250](https://github.com/TheLazyGeekGuy/bcr32-studio/actions/runs/40853836250) both completed successfully for the full candidate SHA above. Independent public HTTP requests returned 200 and byte-identical SHA-256 content against the isolated release distribution for the site, editor, all four documentation pages, schema, TX81Z example, standalone ES module and version manifest.

Public documentation: https://thelazygeekguy.github.io/bcr32-studio/docs/sysex-map/ . Version: **0.46.0-alpha.7**. SXM 1.0 remains an open draft proposal, with no claim of official standardization or third-party adoption. This documentation-only delivery receipt is committed after the validated application candidate; it changes no runtime source or generated artifact. No device operation was performed.
