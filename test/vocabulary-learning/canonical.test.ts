import { describe, expect, it } from 'vitest'
import { createEntryId, getCanonicalTopic } from '../../src/features/vocabulary-learning/canonical'

describe('canonical vocabulary adapter', () => {
  it('creates URL-safe deterministic IDs', () => {
    expect(createEntryId('04_太空探索', 'synthesise/synthesize')).toBe('04-space-exploration:synthesise')
  })

  it('adapts all Space Exploration entries with unique IDs and audio', () => {
    const topic = getCanonicalTopic('04_太空探索')
    expect(topic.entries).toHaveLength(75)
    expect(new Set(topic.entries.map(entry => entry.id)).size).toBe(75)
    expect(topic.entries.find(entry => entry.primaryHeadword === 'galaxy')).toMatchObject({
      id: '04-space-exploration:galaxy',
      audioPath: '/vocabulary/audio/04_太空探索/galaxy.mp3',
    })
  })
})
