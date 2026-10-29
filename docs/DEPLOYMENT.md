# Deployment and isolated preview environments

The presentation lives at `/` and the editor at `/editor/` inside each deployment root. Relative assets and service-worker scopes follow that root. GitHub Pages hosts all three applications; Cloudflare is not required.

| Environment | URL | Source branch | Update |
| --- | --- | --- | --- |
| Production | https://thelazygeekguy.github.io/bcr32-studio/ | `production` | explicit source promotion, then manual Pages run |
| Develop | https://thelazygeekguy.github.io/bcr32-studio/develop/ | `develop` | successful CI after a develop push |
| Staging | https://thelazygeekguy.github.io/bcr32-studio/staging/ | `staging` | push a selected candidate; successful CI republishes |

Append `editor/` to open an editor directly. Preview pages visibly identify DEVELOP or STAGING. `deployment.json` records each source's full commit and application version. The same version may appear in two environments; compare their source revisions as well.

## Production rollback on 2026-10-29

At the owner's request, production was restored to **0.45.0-alpha.17**, source **78ab3a227d50ef13716e6aa45a19a58e92bd5e32**, the last first-parent commit of 2026-10-28. GitHub Pages run 40919814496 succeeded and the public distribution manifest returned alpha.17. All 2026-10-29 development commits remain in Git. Production's branch was created at that older source; no history was rewritten and local main was untouched.

## How publication works

`.github/workflows/ci.yml` validates pull requests and pushes to main, develop and staging. `.github/workflows/pages.yml` runs manually or after successful **CI** on develop/staging. Its workflow definition is taken from the default branch. It builds production separately from the `production` branch and both previews separately from their own branches, tests each, then assembles one Pages artifact:

```text
/                 production build
/develop/         develop build
/staging/         staging build
```

A failed build prevents publication of the complete artifact. A preview update cannot change the production source branch. There is no automatic production publication on a main push. GitHub environments `develop` and `staging` record the preview URLs after the complete Pages deployment. Their branch rules admit main, since the orchestrating workflow runs on the default branch even when CI was triggered by a preview branch. The existing `github-pages` main restriction and existing production review rules are preserved. No Cloudflare credential is needed or copied to Actions.

GitHub Pages is a static host and publishes one artifact per repository. These are three applications at separate paths, not three independently hosted Pages sites. Building the root from the pinned production branch is mandatory on every combined deployment. Keep its source stable until an explicit release is approved.

## Browser data isolation

Paths on github.io share an origin; paths alone do not isolate localStorage. New preview code scopes editor drafts, module settings, instance recovery IDs and presentation state under `midi-studio.environment.develop.` or `.staging.`. The library database likewise gets an environment suffix. Production keys and database names remain unchanged, and preview startup never silently seeds a production draft. Use file export/import to move data deliberately. Service workers and Cache Storage use each deployment's distinct path/scope; the production inventory excludes preview files.

Some general appearance/language preferences can remain shared. MIDI hardware ports are not isolated by URL: close or disconnect one editor before using another on the same device. The preview banner is an identification aid, not a browser sandbox.

## Promotion

1. Develop and test using `develop`, including physical MIDI acceptance when needed.
2. Fast-forward `staging` to the chosen tested candidate and inspect the staging URL.
3. After explicit acceptance, update `production` to that verified source and manually run **Pages** from main. Confirm `deployment.json`, editor version, CI and public assets.
4. Record the previous production SHA before promotion. For a future rollback, preserve history using a reviewed restoration commit on production; do not force-push or reset another checkout.

A merge to main alone is not a release. Do not move the production branch just to fix the deployment workflow. The old disabled Cloudflare workflow, which referenced an obsolete repository, has been removed; `wrangler.jsonc` remains available for separately authorized manual hosting, without activating it here.

## Checks and provenance

`npm test` covers path/storage/database isolation and deployment source invariants. Browser fixtures must also prove production/develop/staging draft separation and service-worker/offline navigation under their real subpaths. Each build retains its distribution manifest and exact source revision. GitHub Pages has no custom response headers, so the existing CSP is injected into both HTML entries with `META_CSP=1`.

Review: Codex primary, exact model/effort unavailable, 2026-10-29 18:10 CET onward; baseline 7ae6833bbfec6cd27db9a8a927318e9b47829754 plus the explicitly identified environment workflow, storage, build, test and documentation edits in [the work item](work-items/2026-10-29-deployment-environments.md). This configuration does not establish physical MIDI acceptance of development features.
