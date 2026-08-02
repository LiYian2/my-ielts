import { describe, expect, it } from 'vitest'
import {
  LEARNING_STORAGE_KEY,
  RECOVERY_STORAGE_KEY_PREFIX,
  exportLearningState,
  importLearningState,
  loadLearningState,
  resetLearningState,
  saveLearningState,
} from '../../src/features/vocabulary-learning/storage'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

function savedState() {
  return {
    schemaVersion: 1 as const,
    words: {
      '04-space-exploration:orbit': {
        state: 'recallable' as const,
        intervalIndex: 1,
        nextReviewOn: '2026-08-05',
        unaidedRecallDates: ['2026-08-02', '2026-08-03'],
        productionDates: ['2026-08-03'],
        lastOutcome: 'unaided' as const,
      },
    },
    answers: {
      'lesson-1:task-1': {
        taskId: 'lesson-1:task-1',
        text: 'An orbit is the path of a body in space.',
        selfAssessment: { meaning: true, collocation: false },
        updatedAt: '2026-08-03T12:00:00.000Z',
      },
    },
    completedLessons: ['lesson-1'],
  }
}

describe('vocabulary learning storage', () => {
  it('returns a fresh v1 state when storage is empty', () => {
    const storage = new MemoryStorage()

    expect(loadLearningState(storage)).toEqual({
      schemaVersion: 1,
      words: {},
      answers: {},
      completedLessons: [],
    })
  })

  it('round-trips a saved state', () => {
    const storage = new MemoryStorage()
    const state = savedState()

    saveLearningState(storage, state)

    expect(loadLearningState(storage)).toEqual(state)
  })

  it('backs up malformed saved JSON under a deterministic recovery key before starting fresh', () => {
    const storage = new MemoryStorage()
    const raw = '{bad json'
    const now = new Date('2026-08-03T12:34:56.789Z')
    storage.setItem(LEARNING_STORAGE_KEY, raw)

    expect(loadLearningState(storage, now)).toEqual({
      schemaVersion: 1,
      words: {},
      answers: {},
      completedLessons: [],
    })
    expect(storage.getItem(`${RECOVERY_STORAGE_KEY_PREFIX}${now.toISOString()}`)).toBe(raw)
  })

  it('backs up a structurally invalid saved state instead of letting it reach review logic', () => {
    const storage = new MemoryStorage()
    const raw = JSON.stringify({
      schemaVersion: 1,
      words: { '04-space-exploration:orbit': { state: 'invalid' } },
      answers: {},
      completedLessons: [],
    })
    const now = new Date('2026-08-03T12:34:56.789Z')
    storage.setItem(LEARNING_STORAGE_KEY, raw)

    expect(loadLearningState(storage, now)).toEqual({
      schemaVersion: 1,
      words: {},
      answers: {},
      completedLessons: [],
    })
    expect(storage.getItem(`${RECOVERY_STORAGE_KEY_PREFIX}${now.toISOString()}`)).toBe(raw)
  })

  it('rejects malformed JSON and unsupported schema versions without changing active storage', () => {
    const storage = new MemoryStorage()
    const existing = JSON.stringify(savedState())
    storage.setItem(LEARNING_STORAGE_KEY, existing)

    expect(() => importLearningState(storage, '{bad json')).toThrow('Invalid learning progress import')
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBe(existing)
    expect(() => importLearningState(storage, JSON.stringify({ ...savedState(), schemaVersion: 2 }))).toThrow('Unsupported learning progress schema version')
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBe(existing)
  })

  it('exports then imports words, answers, and completed lessons without loss', () => {
    const source = savedState()
    const storage = new MemoryStorage()

    expect(importLearningState(storage, exportLearningState(source))).toEqual(source)
    expect(loadLearningState(storage)).toEqual(source)
  })

  it('removes only the active learning key when progress is reset', () => {
    const storage = new MemoryStorage()
    storage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(savedState()))
    storage.setItem('unrelated:key', 'keep me')

    expect(resetLearningState(storage)).toEqual({
      schemaVersion: 1,
      words: {},
      answers: {},
      completedLessons: [],
    })
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBeNull()
    expect(storage.getItem('unrelated:key')).toBe('keep me')
  })
})
