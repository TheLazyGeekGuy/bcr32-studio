# Separate develop/staging deployments and restore yesterday's production

Status: implementation in progress; GitHub-only hosting selected by the owner; Cloudflare is not needed.

Owner authorizes develop and staging URLs integrated with GitHub, removal of automatic production publication on main pushes, and rollback of the production URL to yesterday's version. No commit/history deletion or local main reset is required.

## Review trace

Codex primary, exact model and reasoning effort not exposed, 2026-10-29 18:10–18:12 CET. Repository bcr-studio-firmware-103, branch work/bcr32-bcl-sysex, clean baseline 7ae6833bbfec6cd27db9a8a927318e9b47829754. Read .github/workflows/{pages,deploy,ci}.yml, wrangler.jsonc, vite.config.mts, docs/DEPLOYMENT.md and scripts/smoke-test.mjs. Later working files are uncommitted changes until the delivery commit below.

Confirmed: Pages publishes every main push. The disabled Cloudflare workflow references an obsolete repository name. GitHub has no Cloudflare Actions secret. Its existing production environment requires a maintainer review; its github-pages environment admits only main. Those rules must not be weakened. Current local Cloudflare OAuth reaches a different account from the legacy controller-tools namespace; owner was asked before using it.

Yesterday's last first-parent source: 78ab3a227d50ef13716e6aa45a19a58e92bd5e32, 2026-10-28 18:52 CET, version 0.45.0-alpha.17; successful Pages run 40739833189. Today's source 7ae6833bbfec6cd27db9a8a927318e9b47829754 is preserved in develop, not discarded.

## Acceptance

- Production Pages is manual, checks out an explicit immutable full source SHA, and keeps current deployment environment restrictions.
- Restore the production URL to alpha.17 and verify actual public manifest/assets.
- Branches develop and staging, matching GitHub environments and isolated nonproduction deployment targets; no preview push publishes production.
- Develop is automatic after tests; staging is a distinct candidate branch/URL. Missing CI credentials fail clearly rather than claim a deployment.
- Preserve all code, drafts and existing production protection; no hardware operation.
- Document promotion, rollback, CI secrets, actual URLs, branch policies and tested limits.

## Immediate containment

Production Pages is changed to workflow_dispatch only, from main, with a mandatory validated full source SHA. This permits the explicitly requested rollback to 78ab3a227d50ef13716e6aa45a19a58e92bd5e32 while retaining all current code. The owner clarified that GitHub hosting is preferred when possible. Develop/staging will be separate subpaths in the same Pages artifact, with separate service-worker scopes and application storage namespaces. No Cloudflare resource is created or existing OAuth credential copied to GitHub.
