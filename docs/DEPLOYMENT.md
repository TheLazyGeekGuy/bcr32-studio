# Deployment

BCR32 Studio is a static single-page app served by Cloudflare Workers (static assets, no server code).

| Environment | Worker | Deployed when | Approval |
| --- | --- | --- | --- |
| development | `bcr32-studio-dev` | every push to `main` (merged pull request) | none: CI must be green |
| production | `bcr32-studio` | a GitHub release is published, or a manual run | required reviewer on the `production` environment |

Both jobs run the full test suite and the build before deploying, then a smoke test that checks the served bundle
carries the version of `package.json`. Workflows: `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`.

## Why it only runs on GitHub

Every job is guarded by `github.server_url == 'https://github.com'`, and the deploy jobs also by
`github.repository == 'TheLazyGeekGuy/bcr32-studio'` and `vars.DEPLOY_ENABLED == 'true'`. A Forgejo or Gitea mirror, which reads `.github/workflows` when
it has no `.forgejo/workflows`, skips the jobs; a fork has no Cloudflare secret and skips the deploy jobs.
Pull requests use the `pull_request` event, never `pull_request_target`, so code from a fork never runs with secrets.

## One-time setup (maintainer)

1. **Cloudflare API token**: in the Cloudflare dashboard, create a token with the "Edit Cloudflare Workers" template,
   limited to the account that hosts the workers.
2. **GitHub secrets** (Settings > Secrets and variables > Actions), entered by the maintainer:
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
3. **GitHub variables**: `DEV_URL` and `PROD_URL`, the two `workers.dev` URLs, used by the smoke tests, and
   `DEPLOY_ENABLED=true` once the secrets exist (until then the deploy jobs are skipped).
4. **Environments** (Settings > Environments): `dev` (no rule) and `production` with "Required reviewers" set to the
   maintainer, and "Deployment branches and tags" limited to tags `v*` and `main`.
5. **Branch protection on `main`**: pull request required, CI (`CI / test`) must pass, review from code owners.

## Releasing

1. Merge to `main`, check the development site.
2. Bump the version (`npm version <x.y.z> --no-git-tag-version`, README and CHANGELOG lines), merge.
3. Publish a GitHub release with tag `v<x.y.z>`. The production job waits for approval, then deploys.

## Manual deployment

```sh
npm run build
npx wrangler login                 # once
npx wrangler deploy --env dev      # development
npx wrangler deploy --env production   # production
```

## Running the workflows locally

`npm test`, `npm run build` and `node scripts/leak-gate.mjs` are exactly what CI runs. To execute the workflow files
themselves, [act](https://github.com/nektos/act) works with the `pull_request` event; leave the deploy jobs to GitHub.
