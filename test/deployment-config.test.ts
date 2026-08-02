import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const productionConcurrency = 'group: cloudflare-pages-$' + '{{ github.event_name != \'pull_request\' && github.ref == \'refs/heads/master\' && \'production\' || format(\'verification-{0}\', github.ref) }}'
const occurrences = (source: string, value: string) => source.split(value).length - 1
const secretReference = (name: string) => '$' + `{{ secrets.${name} }}`

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

    expect(workflow).toContain('push:\n    branches: [master]')
    expect(workflow).toContain('pull_request:\n    branches: [master]')
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).toContain(productionConcurrency)
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
})
