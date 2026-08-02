import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('Cloudflare Pages deployment', () => {
  it('declares the expected Pages project and output directory', () => {
    const config = read('wrangler.toml')
    expect(config).toContain('name = "my-ielts"')
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
    expect(workflow).toContain('if: github.event_name != \'pull_request\'')
    expect(workflow).not.toContain('github-pages-deploy-action')
    expect(workflow).not.toContain('branch: gh-pages')
  })
})
