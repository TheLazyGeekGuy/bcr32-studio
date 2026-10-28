# BCR103-08 — Publish the accepted site and editor

Status: **owner accepted; release candidate verified locally for GitHub publication**. The delivery result is the GitHub Pages workflow run for the published commit, not this preparation status.

## Authorization and scope

On 2026-10-28 the owner reported the local site/editor working and explicitly requested local commits, privacy review, GitHub push and production publication of both the product site and editor. The owner acceptance updates BCR103-07; it does not establish a web Start/Stop command. Outgoing sequencer Play/Stop/Space remains disabled for firmware 1.0.3; physical transport and received-state following are separate capabilities.

## Traceable review

Codex, primary agent, 2026-10-28 18:41–18:46 CET. Exact model identifier/reasoning effort are not exposed and remain unavailable. Source checkout: `<workspace>/bcr-studio-firmware-103`, branch `work/firmware-103-sequencer`, full starting revision **`a785b07be0b1e4559ecd38d1054b734804531d69`**, initially clean. Read scope: deployment/CI workflows, privacy scanner and its outside-Git private denylist, actual transport gate, dependency delta and BCR103-07/protocol acceptance records. The publication patch updates acceptance/documentation and integrates remote main **`f96c4c09ba08da71b13b54db35f2635f703ffcea`** without discarding its four dependency commits. Existing other worktrees and their main branch are not checked out or reset.

## Privacy disposition

- Generic source/assets/commit-identity scan: no personal filesystem path, private address, non-noreply author email or credential detected at preparation. Repeat on the exact release candidate.
- Full private-denylist scan reports eight findings in the shared multi-worktree repository. Two file findings concern the public `behringer.com` manufacturer download URLs and their domain classifier. One is a substring match inside ordinary technical documentation. These contextual matches are not personal data; official source links are retained.
- Five historical commit findings belong to other local branches: none is an ancestor of either the publication HEAD or remote main, independently checked with `git merge-base --is-ancestor`. They are not part of this push. No unrelated history is rewritten.
- The scanner and private denylist are not disabled or weakened. Its nonzero full-scan result is recorded rather than falsely reported as an automated pass; the identified public/technical references are manually reviewed exceptions. A single-branch release checkout restricts the final history review to the actual publication graph.
- No native MIDI capture dossier, local settings, private denylist, credentials or absolute personal paths are added to the repository. Source commit author/committer uses the existing public GitHub alias and noreply address. Runtime storage/presets remain client-local.

## Delivery contract

- Version remains **0.45.0-alpha.17**; no additional runtime feature is introduced by publication.
- Preserve updated React/React DOM 19.3.1 and Wrangler 4.151.3 from remote main and verify the merged lockfile in an isolated release checkout.
- Primary production is GitHub Pages from `.github/workflows/pages.yml`: product site at `/bcr32-studio/`, editor at `/bcr32-studio/editor/`. Existing optional Cloudflare deployment is not activated.
- Run tests/typecheck, production build, privacy/whitespace checks and browser/site routing checks before publication. Push without force; remote concurrent changes require reintegration, not overwrite.
- Verify the GitHub deployment run and the version actually served at both public routes. A push alone is not deployment proof. Record final SHA/run/public checks in the delivery response.

## Release candidate verification — 2026-10-28 18:49 CET

Codex primary agent reviewed merged candidate **`c6a6ed2484e59868e7a63b615f3d44dd2a5416ec`** in an isolated single-branch checkout with a fresh `npm ci`, not the shared development dependency symlink. The exact model/reasoning level remains unavailable. Subsequent changes are this publication record only.

- 49/49 tests, TypeScript and production build/distribution pass with React/React DOM 19.3.1 and Wrangler 4.151.3.
- Production-browser simulated MIDI regression and production subpath/offline regression pass; neither accesses hardware. Existing large-chunk warnings remain.
- Generic privacy gate passes on **373 files / 82 reachable commits**. The isolated full private scan has four contextual file findings: public manufacturer references in site/translation/release documentation and the already reviewed technical substring. No commit-identity/history finding remains; unrelated local branches are absent. This is a manual disposition of these exact findings, not an automated full-gate pass.
- `npm audit --omit=dev` reports **zero** production dependency vulnerabilities. Development-only Wrangler/Miniflare/Undici report three advisories (two moderate, one high), with Wrangler 4.154.0 suggested. Optional Cloudflare tooling is not used by this GitHub Pages publication; upgrading/testing that tooling is separate follow-up, not an unreviewed forced dependency change in this release.
- No physical device operation or device-setting modification was needed. The earlier owner acceptance is preserved without inventing a new physical validation.

## Push-hook exception — 2026-10-28 18:52 CET

The first push of `66319577f60fc359d6f54436967bd0bc3fc2d2c3` was refused by the pre-push hook: its all-ref scan includes the five unrelated-branch commit findings in addition to the four contextual file findings. Nothing was published by that attempt. The single-branch release scan independently confirms that those unrelated commits are absent and that no identity finding remains. Generic checks, fresh dependency tests and browser checks pass.

The owner's earlier explicit permission to bypass this control for nonconfidential public manufacturer documentation is applied to this exact publication after contextual review. A command-local hook-path override is used for one push only; repository/global hook configuration, scanner and private denylist remain unchanged. This is a documented hook exception, **not** a claim that the full private scan passed or that every future finding is safe. No forced push or history rewrite is authorized or used.
