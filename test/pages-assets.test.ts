import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PAGES_MAX_ASSET_BYTES, findOversizedFiles } from '../scripts/validate-pages-assets.mjs'
import { findLegacyTopicAudioFiles, pruneLegacyTopicAudio } from '../scripts/prune-legacy-topic-audio.mjs'

const temporaryDirectories: string[] = []

function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'pages-assets-test-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { force: true, recursive: true })
})

describe('Cloudflare Pages asset limit', () => {
  it('uses the documented 25 MiB per-asset limit', () => {
    expect(PAGES_MAX_ASSET_BYTES).toBe(26_214_400)
  })

  it('recursively reports deployable files that exceed the limit', () => {
    const directory = createFixture()
    mkdirSync(join(directory, 'nested'))
    writeFileSync(join(directory, 'within-limit.txt'), 'abc')
    writeFileSync(join(directory, 'nested', 'too-large.txt'), 'abcd')

    expect(findOversizedFiles(directory, 3)).toEqual([
      { path: 'nested/too-large.txt', size: 4 },
    ])
  })

  it('prunes only top-level topic audio while preserving per-word audio', () => {
    const directory = createFixture()
    const audioDirectory = join(directory, 'vocabulary', 'audio')
    const wordAudioDirectory = join(audioDirectory, '01_自然地理')
    mkdirSync(wordAudioDirectory, { recursive: true })
    const topicAudio = join(audioDirectory, '01_自然地理.mp3')
    const wordAudio = join(wordAudioDirectory, 'atmosphere.mp3')
    writeFileSync(topicAudio, 'legacy topic audio')
    writeFileSync(wordAudio, 'word audio')

    expect(findLegacyTopicAudioFiles(audioDirectory)).toEqual([topicAudio])
    expect(pruneLegacyTopicAudio(audioDirectory)).toEqual([topicAudio])
    expect(existsSync(topicAudio)).toBe(false)
    expect(existsSync(wordAudio)).toBe(true)
  })
})
