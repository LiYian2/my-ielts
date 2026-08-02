import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const productionConcurrency = 'group: cloudflare-pages-$' + '{{ github.event_name != \'pull_request\' && github.ref == \'refs/heads/master\' && \'production\' || format(\'verification-{0}\', github.ref) }}'
const occurrences = (source: string, value: string) => source.split(value).length - 1
const secretReference = (name: string) => '$' + `{{ secrets.${name} }}`
const checkoutAction = 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262' // v4
const pnpmSetupAction = 'pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1' // v4
const nodeSetupAction = 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020' // v4

describe('Cloudflare Pages deployment', () => {
  it('declares the expected Pages project and output directory', () => {
    const config = read('wrangler.toml')
    expect(config).toContain('name = "my-ielts"')
    expect(config).toContain('pages_build_output_dir = "dist"')
  })

  it('verifies pull requests but deploys only the master ref to production', () => {
    const workflow = read('.github/workflows/deploy.yml')
    const deployStart = workflow.indexOf('      - name: Deploy to Cloudflare Pages')
    const deployEnd = workflow.indexOf('\n      - name:', deployStart + 1)
    const deployment = workflow.slice(deployStart, deployEnd === -1 ? undefined : deployEnd)
    const setupAndVerify = workflow.slice(0, deployStart)
    const wranglerPreflightStart = workflow.indexOf('      - name: Verify Wrangler version')
    const wranglerPreflightEnd = workflow.indexOf('\n      - name:', wranglerPreflightStart + 1)
    const wranglerPreflight = workflow.slice(wranglerPreflightStart, wranglerPreflightEnd === -1 ? undefined : wranglerPreflightEnd)

    expect(workflow).toContain('push:\n    branches: [master]')
    expect(workflow).toContain('pull_request:\n    branches: [master]')
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain(productionConcurrency)
    expect(workflow).toContain(`${checkoutAction} # v4`)
    expect(workflow).toContain(`${pnpmSetupAction} # v4`)
    expect(workflow).toContain(`${nodeSetupAction} # v4`)
    expect(workflow).toContain('node-version: 22')
    expect(wranglerPreflightStart).toBeGreaterThan(-1)
    expect(wranglerPreflightStart).toBeLessThan(workflow.indexOf('      - name: Verify\n'))
    expect(wranglerPreflight).toContain('run: pnpm exec wrangler --version')
    expect(wranglerPreflight).not.toContain('CLOUDFLARE_')
    expect(workflow).toContain('if: github.event_name != \'pull_request\' && github.ref == \'refs/heads/master\'')
    expect(workflow.indexOf('run: pnpm check')).toBeLessThan(deployStart)
    expect(deployment).toContain('pnpm exec wrangler pages deploy dist')
    expect(deployment).toContain('--project-name my-ielts')
    expect(deployment).toContain('--branch master')
    for (const secret of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']) {
      expect(deployment).toContain(`${secret}: ${secretReference(secret)}`)
      expect(occurrences(workflow, secret)).toBe(2)
      expect(occurrences(workflow, secretReference(secret))).toBe(1)
    }
    expect(setupAndVerify).not.toContain('CLOUDFLARE_API_TOKEN')
    expect(setupAndVerify).not.toContain('CLOUDFLARE_ACCOUNT_ID')
    expect(workflow).not.toContain('github-pages-deploy-action')
    expect(workflow).not.toContain('branch: gh-pages')
  })

  it('publishes the fork and Cloudflare URLs', () => {
    expect(read('README.md')).toContain('https://my-ielts.pages.dev')
    expect(read('src/components/TheHeader.vue')).toContain('https://github.com/LiYian2/my-ielts')
  })

  it('builds deployment output without legacy topic audio', () => {
    const manifest = read('package.json')
    const vocabularyPage = read('src/pages/vocabulary/index.vue')
    expect(manifest).toContain('vite build && node scripts/prune-legacy-topic-audio.mjs')
    expect(manifest).toContain('pnpm check:pages-assets')
    expect(manifest).toContain('node scripts/validate-pages-assets.mjs dist')
    expect(vocabularyPage).not.toContain('refVocabulary[category].audio')
  })
})
