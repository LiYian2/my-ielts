# Cloudflare Pages Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the existing Vite site at `https://liyian2-my-ielts.pages.dev` and make pushes to `master` deploy through GitHub Actions.

**Architecture:** Keep the application as a static Vite build using hash routing. A Direct Upload Cloudflare Pages project named `liyian2-my-ielts` receives `dist` from a GitHub Actions workflow authenticated by a scoped API token; pull requests run the same verification without deploying.

**Tech Stack:** Vue 3, Vite 4, pnpm 8.6.10, Vitest, GitHub Actions, Wrangler 4.118.0, Cloudflare Pages Direct Upload

## Global Constraints

- Production URL is exactly `https://liyian2-my-ielts.pages.dev`.
- Cloudflare Pages project name is exactly `liyian2-my-ielts`.
- Production branch is `master`.
- Pull requests never receive production credentials and never deploy.
- Do not delete the existing `gh-pages` branch.
- Do not add Workers, KV, D1, R2, Pages Functions, server-side rendering, or a custom domain.
- Use `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` for CI authentication.
- Never print, commit, or copy the Cloudflare API token into shell history.

---

## File Map

- Modify `package.json`: pin pnpm, add Wrangler, and add deterministic check/deploy scripts.
- Modify `pnpm-lock.yaml`: lock Wrangler and the exact package-manager changes.
- Create `wrangler.toml`: declare the Pages project and output directory.
- Modify `.github/workflows/deploy.yml`: verify pull requests and deploy production pushes.
- Create `test/deployment-config.test.ts`: prevent regression to GitHub Pages or missing CI credentials.
- Modify `README.md`: publish the Cloudflare production URL.
- Modify `src/components/TheHeader.vue`: point the GitHub icon at the fork owner.

### Task 1: Pin the Build and Deployment Toolchain

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `pnpm check` for local/CI verification.
- Produces: `pnpm deploy:pages` for a pre-verified Pages upload.
- Produces: local executable `wrangler` version `4.118.0`.

- [ ] **Step 1: Install the repository's pinned pnpm and dependencies**

Run with network access:

```bash
npx pnpm@8.6.10 install --frozen-lockfile
```

Expected: dependencies install from the existing lockfile without the pnpm 11 lockfile warning.

- [ ] **Step 2: Add the pinned Wrangler development dependency**

Run:

```bash
npx pnpm@8.6.10 add --save-dev --save-exact wrangler@4.118.0
```

Expected: `package.json` and `pnpm-lock.yaml` change; `package-lock.json` remains untouched.

- [ ] **Step 3: Add deterministic scripts and align the package-manager declaration**

Set these exact `package.json` values:

```json
{
  "packageManager": "pnpm@8.6.10",
  "scripts": {
    "build": "vite build",
    "check": "pnpm lint && pnpm typecheck && pnpm test -- --run && pnpm build",
    "deploy:pages": "wrangler pages deploy dist --project-name liyian2-my-ielts --branch master",
    "dev": "vite --port 3333 --open",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest",
    "typecheck": "vue-tsc --noEmit",
    "up": "taze major -I"
  }
}
```

Preserve all existing dependencies and dev dependencies, adding only exact `wrangler: "4.118.0"`.

- [ ] **Step 4: Run the existing test suite before deployment configuration**

Run:

```bash
npx pnpm@8.6.10 test -- --run
npx pnpm@8.6.10 typecheck
npx pnpm@8.6.10 build
```

Expected: each command reaches the project tooling rather than attempting to repair the lockfile. If an existing source failure appears, record it and fix only failures that block the deployment workflow; do not hide failures with `continue-on-error`.

- [ ] **Step 5: Commit the toolchain change**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build: pin Cloudflare deployment toolchain"
```

### Task 2: Define and Test the Cloudflare Pages Workflow

**Files:**
- Create: `wrangler.toml`
- Modify: `.github/workflows/deploy.yml`
- Create: `test/deployment-config.test.ts`

**Interfaces:**
- Consumes: `pnpm check` and local `wrangler` from Task 1.
- Produces: a PR verification job and a production deploy step.
- Produces: `wrangler.toml` with `pages_build_output_dir = "dist"`.

- [ ] **Step 1: Write a failing deployment configuration test**

Create `test/deployment-config.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('Cloudflare Pages deployment', () => {
  it('declares the expected Pages project and output directory', () => {
    const config = read('wrangler.toml')
    expect(config).toContain('name = "liyian2-my-ielts"')
    expect(config).toContain('pages_build_output_dir = "dist"')
  })

  it('verifies pull requests and deploys only production events', () => {
    const workflow = read('.github/workflows/deploy.yml')
    expect(workflow).toContain('pull_request:')
    expect(workflow).toContain('branches: [master]')
    expect(workflow).toContain('pnpm check')
    expect(workflow).toContain('wrangler pages deploy dist')
    expect(workflow).toContain('CLOUDFLARE_API_TOKEN')
    expect(workflow).toContain('CLOUDFLARE_ACCOUNT_ID')
    expect(workflow).toContain("if: github.event_name != 'pull_request'")
    expect(workflow).not.toContain('github-pages-deploy-action')
    expect(workflow).not.toContain('branch: gh-pages')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
npx pnpm@8.6.10 test -- --run test/deployment-config.test.ts
```

Expected: FAIL because `wrangler.toml` does not exist and the old workflow still names GitHub Pages.

- [ ] **Step 3: Create the Pages configuration**

Create `wrangler.toml`:

```toml
name = "liyian2-my-ielts"
pages_build_output_dir = "dist"
```

- [ ] **Step 4: Replace the deployment workflow**

Replace `.github/workflows/deploy.yml` with:

```yaml
name: Verify and deploy

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]
  workflow_dispatch:

concurrency:
  group: cloudflare-pages-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 8.6.10
          run_install: false

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Verify
        run: pnpm check

      - name: Deploy to Cloudflare Pages
        if: github.event_name != 'pull_request'
        run: >-
          pnpm exec wrangler pages deploy dist
          --project-name liyian2-my-ielts
          --branch master
          --commit-hash "${GITHUB_SHA}"
          --commit-message "${GITHUB_COMMIT_MESSAGE}"
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          GITHUB_COMMIT_MESSAGE: ${{ github.event.head_commit.message || github.event_name }}
```

- [ ] **Step 5: Run the focused and full checks**

```bash
npx pnpm@8.6.10 test -- --run test/deployment-config.test.ts
npx pnpm@8.6.10 check
```

Expected: deployment configuration test passes and the full check exits 0.

- [ ] **Step 6: Commit the workflow**

```bash
git add wrangler.toml .github/workflows/deploy.yml test/deployment-config.test.ts
git commit -m "ci: deploy site to Cloudflare Pages"
```

### Task 3: Update Public Repository Links

**Files:**
- Modify: `README.md`
- Modify: `src/components/TheHeader.vue`

**Interfaces:**
- Produces: public site link `https://liyian2-my-ielts.pages.dev`.
- Produces: repository link `https://github.com/LiYian2/my-ielts`.

- [ ] **Step 1: Write a failing public-link test**

Append to `test/deployment-config.test.ts`:

```ts
it('publishes the fork and Cloudflare URLs', () => {
  expect(read('README.md')).toContain('<h2>在线地址 <a href="https://liyian2-my-ielts.pages.dev">https://liyian2-my-ielts.pages.dev</a></h2>')
  expect(read('README.md')).not.toContain('https://my-ielts.pages.dev')
  expect(read('src/components/TheHeader.vue')).toContain('https://github.com/LiYian2/my-ielts')
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

```bash
npx pnpm@8.6.10 test -- --run test/deployment-config.test.ts
```

Expected: FAIL because both files still point to the upstream owner's URLs.

- [ ] **Step 3: Replace only the public URLs**

In `README.md`, replace the online address heading with:

```html
<h2>在线地址 <a href="https://liyian2-my-ielts.pages.dev">https://liyian2-my-ielts.pages.dev</a></h2>
```

In `src/components/TheHeader.vue`, set the GitHub anchor to:

```html
href="https://github.com/LiYian2/my-ielts"
```

- [ ] **Step 4: Verify and commit**

```bash
npx pnpm@8.6.10 test -- --run test/deployment-config.test.ts
git add README.md src/components/TheHeader.vue test/deployment-config.test.ts
git commit -m "docs: point site links at fork deployment"
```

### Task 4: Create the Pages Project, Configure Secrets, and Deploy

**Files:**
- No repository file changes expected.

**Interfaces:**
- Consumes: Cloudflare account `2703824a94ead093a61d95a442e43816`.
- Consumes: GitHub repository `LiYian2/my-ielts`.
- Produces: production deployment at `https://liyian2-my-ielts.pages.dev`.

- [ ] **Step 1: Confirm the project name is available or already owned**

```bash
ssh home-local 'npx wrangler pages project list'
```

Expected: either no `liyian2-my-ielts` entry or an existing `liyian2-my-ielts` project in the authenticated account. If another account owns the global name and Cloudflare assigns a suffixed hostname, stop and ask the user to choose a new project name because the approved URL cannot be met.

- [ ] **Step 2: Create the Direct Upload project when absent**

```bash
ssh home-local 'npx wrangler pages project create liyian2-my-ielts --production-branch master'
```

Expected: project `liyian2-my-ielts` is created with production branch `master`. If Step 1 showed it already exists, skip creation.

- [ ] **Step 3: Create a scoped Cloudflare API token**

Open the Cloudflare dashboard API Tokens page for the authenticated account. Create a custom token named `github-my-ielts-pages` with only the account's Cloudflare Pages edit permission and no zone permissions. Copy it once into the secure prompt in the next step; do not paste it into chat, a command argument, or a file.

- [ ] **Step 4: Set GitHub Actions secrets securely**

```bash
gh secret set CLOUDFLARE_ACCOUNT_ID --body 2703824a94ead093a61d95a442e43816
gh secret set CLOUDFLARE_API_TOKEN
gh secret list
```

For the second command, paste the token into `gh` standard input when prompted. Expected: the secret list contains both names; values are never shown.

- [ ] **Step 5: Push the deployment commits**

```bash
git status --short --branch
git push origin master
```

Expected: `master` pushes successfully using SSH and triggers `Verify and deploy`.

- [ ] **Step 6: Watch the GitHub Actions run**

```bash
gh run list --workflow deploy.yml --limit 1
gh run watch --exit-status
```

Expected: install, verify, and deploy steps all pass.

- [ ] **Step 7: Verify production**

```bash
curl -I https://liyian2-my-ielts.pages.dev
curl -I https://liyian2-my-ielts.pages.dev/vocabulary/audio/04_%E5%A4%AA%E7%A9%BA%E6%8E%A2%E7%B4%A2/galaxy.mp3
```

Expected: both requests return a successful HTTP status. Open the site in a browser and check `/`, `/#/vocabulary`, and `/#/vocabulary/typing` before declaring the deployment complete.

---

## Plan Self-Review

- Spec coverage: project configuration, CI separation, credentials, public links, first deployment, and post-deploy verification are all assigned to tasks.
- Placeholder scan: no implementation placeholders remain; the only runtime-only value is the secret token created securely by the user.
- Interface consistency: project name, branch, output path, URLs, secret names, pnpm version, and Wrangler version are identical across tasks.
