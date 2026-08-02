# Cloudflare Pages Deployment Design

## Goal

Move the production site from GitHub Pages to a Cloudflare Pages project named `liyian2-my-ielts`, available at `https://liyian2-my-ielts.pages.dev`, with production deployments driven by GitHub Actions.

## Current State

- The Vue 3 application is built by Vite into `dist`.
- Routing uses `createWebHashHistory`, so Cloudflare does not need an SPA fallback rule for application routes.
- `.github/workflows/deploy.yml` currently publishes `dist` to the `gh-pages` branch.
- `netlify.toml` is legacy configuration and is not part of the current GitHub Pages workflow.
- Git SSH authentication succeeds as GitHub user `LiYian2`.
- The local `gh` CLI credential is expired. GitHub API operations such as setting Actions secrets require re-authentication or manual configuration in the GitHub UI.
- Wrangler is authenticated on the SSH host `home-local` and has Cloudflare Pages write permission for account ID `2703824a94ead093a61d95a442e43816`.

## Deployment Architecture

The repository will contain a `wrangler.toml` with:

- Pages project name: `liyian2-my-ielts`
- Static output directory: `dist`

The Pages project will use `master` as its production branch. The first project creation and deployment can run through the authenticated Wrangler installation on `home-local`. Normal production deployments will run in GitHub Actions with a scoped Cloudflare API token rather than copying Wrangler's interactive OAuth credential.

## GitHub Actions Behaviour

The workflow will have two responsibilities:

1. On pull requests targeting `master`, install dependencies, run validation, and build the site without deploying it.
2. On pushes to `master` and manual dispatch, run the same checks and deploy `dist` to the production branch of the `liyian2-my-ielts` Pages project.

The workflow will use current major versions of the checkout and Node setup actions. Dependency installation will respect the repository's pinned pnpm version and lockfile. Deployment will use Wrangler with these repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The API token must be scoped to the minimum account-level Cloudflare Pages edit permission required by Wrangler.

## Repository Changes

- Replace the GitHub Pages deployment step in `.github/workflows/deploy.yml` with Cloudflare Pages deployment.
- Add `wrangler.toml` for the `liyian2-my-ielts` Pages project.
- Update the README production link to `https://liyian2-my-ielts.pages.dev`.
- Stop writing new commits to the `gh-pages` branch. Do not delete the existing branch automatically.
- Leave `netlify.toml` untouched unless a later cleanup task explicitly removes legacy deployment configuration.

## Error Handling

- A pull request cannot deploy production, including pull requests from forks without secrets.
- A failed test, typecheck, lint, content validation, or production build prevents deployment.
- A Cloudflare upload failure fails the Actions job and leaves the previous production deployment active.
- The workflow concurrency group cancels stale production runs when a newer `master` commit is pushed.

## Verification

Before deployment:

- Run lint, typecheck, unit tests, content validation, and the production build.
- Confirm `dist/index.html` and required vocabulary audio assets exist.

After deployment:

- Confirm `https://liyian2-my-ielts.pages.dev` returns the application.
- Open the home page, existing vocabulary list, typing practice, and active-learning route.
- Confirm hash-route refreshes work.
- Confirm representative topic and word audio files load from Cloudflare.
- Confirm the GitHub Actions run reports the deployed commit hash.

## Out of Scope

- A custom domain
- Deleting the old `gh-pages` branch
- Cloudflare Workers, KV, D1, R2, or server-side rendering
- User accounts or cloud progress synchronisation
