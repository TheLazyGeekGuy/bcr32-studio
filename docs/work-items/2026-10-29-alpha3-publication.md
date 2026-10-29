# BCL-11 — publish alpha3 site and editor

## Authorization and source

Owner explicitly requested updating both site/editor and pushing to GitHub on2026-10-29 after the native SysEx STORE/change/recall test and a fresh device-identity reply. This authorizes publication to the existing GitHub Pages production routes; optional Cloudflare services remain disabled. No further hardware mutation is needed.

Codex primary,2026-10-29 09:19 onward; exact model/effort unavailable, so that part of review provenance is incomplete. Checkout `bcr-studio-firmware-103`, branch `work/bcr32-bcl-sysex`, initially clean full HEAD **`abb0fde0f8d9a9cc5bcfc95b2bd75cab7c8385a5`**. Remote main initially **`78ab3a227d50ef13716e6aa45a19a58e92bd5e32`**, an ancestor with no remote-only commits. Read scope: deployment workflows, publication/privacy records, native test evidence, site EN/FR catalog/HTML fallback and version test. Release changes add current BCL/SysEx features and measured acceptance/limitations to the existing presentation, fix outdated no-JavaScript version labels, and clarify one technical comment without changing its code.

## Publication contract

- Version remains **0.46.0-alpha.3**. Product presentation at `/bcr32-studio/`, editor at `/bcr32-studio/editor/` from the same complete Pages build.
- Native scope: rotation/push custom assignment STORE/change/recall and complete bank/global/working rollback passed on1.0.3. Actual emitted SysEx, advanced tokens and power-cycle persistence remain unvalidated and are stated on the site. Existing outgoing web sequencer transport restrictions remain unchanged.
- Final candidate is checked in an isolated release checkout with declared dependencies. Local main and unrelated worktrees are not checked out/reset. Publish by ordinary fast-forward push only; recheck remote main before sending. The owner account is an administrator and the existing protection does not enforce administrator review requirements; use the existing maintainer publication path without disabling protection or forging a review.
- Verify Pages workflow success and actual served release/asset identity at both routes. Push alone is not deployment proof.

## Privacy disposition

Generic gate passed the implementation scope. Full private scan in the shared development repository reports five contextual file findings and five unrelated-branch historical findings. Each historical commit was independently checked with `git merge-base --is-ancestor` and is absent from this release's ancestry. The isolated release graph is checked separately before publication.

File findings concern public manufacturer URLs (including the public source ledger in the new BCL dossier) and an ordinary technical substring already reviewed in BCR103-08. The new source-comment occurrence of that classifier was rephrased without changing semantics. No secret, personal path, full native capture, private denylist or unrelated preset name is included in the release. Public fixtures contain only targeted technical bodies and hashes/counts; complete64-slot backups stay ignored locally.

The owner's earlier explicit waiver for nonconfidential public manufacturer documentation remains applicable to these reviewed contextual findings. The private scanner is not weakened and its nonzero result is not reported as an automated pass. If a command-local pre-push-hook exception is required, it applies only to this reviewed publication; no global/repository hook or denylist configuration is changed. Any new/unexplained finding must be reviewed rather than covered by this disposition.

## Acceptance

- [x] Isolated full tests/typecheck/build, browser application/EN-FR landing/offline checks.
- [x] Isolated privacy/whitespace review, no unexpected data in the publication graph.
- [x] GitHub main fast-forward push, successful Pages run and served version0.46.0-alpha.3 at both routes.

Delivery evidence is recorded below when available. No screenshot is needed for the text-only site update; browser checks use fake/disabled MIDI and never acquire physical ports.

## Candidate verification — 2026-10-29 09:24–09:26 CET

Isolated clean source **`b1fa899ea18cdb697ac9579a8bf4a938ec5c5090`**, declared React/ReactDOM19.3.1 dependencies: **51/51 tests**, TypeScript and production build/distribution passed. Browser checks passed for explicit custom-program/preset STORE, sequencer regression, EN/FR landing content/version/limitations without MIDI acquisition, and shared-scope root/editor offline navigation under the production subpath. Existing large-chunk build warnings remain.

Generic privacy gate: **390 files /90 reachable commits**, pass. Full private scan: five manually reviewed contextual file findings, no historical/identity finding in the isolated publication graph. They match the public manufacturer-source links and already reviewed technical documentation substring; there is no new unexplained finding. No hook configuration is set in this isolated release checkout; the full scan was run explicitly and its nonzero result is retained above rather than mislabeled as a pass. No hook/denylist/protection setting was changed.

Reader: Codex primary; exact model/effort unavailable. This candidate record is a subsequent documentation-only change. Remote main was rechecked as the original ancestor before publication preparation; no forced push or unrelated-branch merge is needed.

## Published result — 2026-10-29 09:26–09:29 CET

Ordinary fast-forward push advanced GitHub main from `78ab3a227d50ef13716e6aa45a19a58e92bd5e32` to **`6e32e68bc5f56243fead0c0db42e93d4a30c2b05`**. GitHub reported the existing administrator exemption for pull-request/expected-status rules; no branch protection, hook, denylist or review was edited/forged. Local checks had already passed. The resulting remote [CI run40842159281](https://github.com/TheLazyGeekGuy/bcr32-studio/actions/runs/40842159281) and [Pages run40842159315](https://github.com/TheLazyGeekGuy/bcr32-studio/actions/runs/40842159315) both succeeded. Optional Cloudflare deployment remained skipped.

Independent cache-bypassing HTTP verification returned200 for both [product site](https://thelazygeekguy.github.io/bcr32-studio/) and [editor](https://thelazygeekguy.github.io/bcr32-studio/editor/). The public build manifest reports **0.46.0-alpha.3** and only `bcr32-editor`. The served editor registration asset contains that version and the custom transfer UI; its SHA256 is **`75739f795b3281cabf5792bfdafec06daecd64702593ad363351159d26fa605e`**. The served site script contains the updated BCL/SysEx copy. The two HTML documents remain distinct, and all checked referenced assets returned200.

This subsequent documentation-only record preserves the already completed deployment's proof; it introduces no runtime or hardware change. Existing offline tabs may retain their current build until the explicit update action is accepted; the published update policy is unchanged. No additional physical device operation was performed during publication.
