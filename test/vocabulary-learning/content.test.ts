import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getCanonicalTopic } from '../../src/features/vocabulary-learning/canonical'
import spaceExplorationContent from '../../src/features/vocabulary-learning/content/04-space-exploration'
import { assertValidTopicContent } from '../../src/features/vocabulary-learning/validate'
import type { EntryId } from '../../src/features/vocabulary-learning/types'

const sourceTopicId = '04_太空探索'
const canonicalTopic = getCanonicalTopic(sourceTopicId)

function annotatedLessonCount(entryId: EntryId) {
  return spaceExplorationContent.lessons.filter(lesson => lesson.passage.some(paragraph => paragraph.segments.some(segment => segment.entryId === entryId))).length
}

describe('Space Exploration learning content', () => {
  it('covers every canonical entry with complete cards and valid structure', () => {
    expect(canonicalTopic.entries).toHaveLength(75)
    expect(Object.keys(spaceExplorationContent.wordCards)).toHaveLength(75)
    expect(() => assertValidTopicContent(spaceExplorationContent, canonicalTopic)).not.toThrow()
  })

  it('keeps lessons focused and complete', () => {
    expect(spaceExplorationContent.lessons.length).toBeGreaterThanOrEqual(4)
    expect(spaceExplorationContent.lessons.length).toBeLessThanOrEqual(6)
    spaceExplorationContent.lessons.forEach((lesson) => {
      expect(new Set(lesson.targetEntryIds).size).toBe(lesson.targetEntryIds.length)
      expect(lesson.targetEntryIds.length).toBeGreaterThanOrEqual(15)
      expect(lesson.targetEntryIds.length).toBeLessThanOrEqual(25)
      expect(lesson.translation).toHaveLength(lesson.passage.length)
      expect(lesson.productionTasks.map(task => task.mode)).toEqual(['collocation', 'rewrite', 'sentence', 'speaking'])
    })
  })

  it('provides usable pronunciation and collocations, with repetition for high-priority cards', () => {
    Object.values(spaceExplorationContent.wordCards).forEach((card) => {
      expect(card.ipa.trim()).not.toBe('')
      expect(card.collocations.length).toBeGreaterThanOrEqual(2)
      expect(card.collocations.length).toBeLessThanOrEqual(4)
      if (card.priority === 'high')
        expect(annotatedLessonCount(card.entryId)).toBeGreaterThanOrEqual(2)
    })
  })

  it('maps every canonical pronunciation path to a public audio file', () => {
    canonicalTopic.entries.forEach((entry) => {
      expect(entry.audioPath.startsWith('/')).toBe(true)
      expect(existsSync(resolve('public', `.${entry.audioPath}`))).toBe(true)
    })
  })

  it('sets final challenges with required entries and a five-part self-check', () => {
    for (const task of [spaceExplorationContent.finalSpeaking, spaceExplorationContent.finalWriting]) {
      expect(task.requiredEntryIds.length).toBeGreaterThan(0)
      expect(task.rubric).toHaveLength(5)
      expect(task.rubric).toEqual(['meaning', 'collocation', 'grammar', 'register', 'relevance'])
    }
  })

  it('keeps the Task 2 reference paragraph within its stated word range', () => {
    const wordCount = spaceExplorationContent.finalWriting.referenceAnswer.trim().split(/\s+/).length
    expect(wordCount).toBeGreaterThanOrEqual(90)
    expect(wordCount).toBeLessThanOrEqual(120)
  })

  it('uses synthesise as the British primary form', () => {
    const entry = canonicalTopic.entries.find(candidate => candidate.primaryHeadword === 'synthesise')
    expect(entry?.id).toBe('04-space-exploration:synthesise')
    expect(spaceExplorationContent.wordCards['04-space-exploration:synthesise'].usageNotes?.[0]).toContain('British spelling synthesise')
  })
})
