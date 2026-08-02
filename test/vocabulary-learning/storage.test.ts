import { describe, expect, it, vi } from 'vitest'
import {
  LEARNING_STORAGE_KEY,
  RECOVERY_STORAGE_KEY_PREFIX,
  exportLearningState,
  importLearningState,
  loadLearningState,
  resetLearningState,
  saveLearningState,
} from '../../src/features/vocabulary-learning/storage'
import { useLearningProgress } from '../../src/features/vocabulary-learning/useLearningProgress'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  operations: Array<{ type: 'remove' | 'set'; key: string; value?: string }> = []
  failGet = false
  failSet = false
  failRemove = false
  onSet?: (key: string, value: string, storage: MemoryStorage) => void

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    if (this.failGet)
      throw new Error('get failed')
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.operations.push({ type: 'remove', key })
    if (this.failRemove)
      throw new Error('remove failed')
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.operations.push({ type: 'set', key, value })
    if (this.failSet)
      throw new Error('set failed')
    this.values.set(key, value)
    this.onSet?.(key, value, this)
  }
}

function savedState() {
  return {
    schemaVersion: 1 as const,
    words: {
      '04-space-exploration:orbit': {
        state: 'active' as const,
        intervalIndex: 1,
        nextReviewOn: '2026-08-06',
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
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBeNull()
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
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBeNull()
  })

  it('uses an unused deterministic recovery suffix and does not re-backup removed corruption', () => {
    const storage = new MemoryStorage()
    const raw = '{bad json'
    const now = new Date('2026-08-03T12:34:56.789Z')
    const base = `${RECOVERY_STORAGE_KEY_PREFIX}${now.toISOString()}`
    storage.setItem(base, 'first backup')
    storage.setItem(`${base}:1`, 'second backup')
    storage.setItem(LEARNING_STORAGE_KEY, raw)

    expect(loadLearningState(storage, now)).toEqual({ schemaVersion: 1, words: {}, answers: {}, completedLessons: [] })
    expect(storage.getItem(`${base}:2`)).toBe(raw)
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBeNull()
    expect(loadLearningState(storage, now)).toEqual({ schemaVersion: 1, words: {}, answers: {}, completedLessons: [] })
    expect(storage.getItem(`${base}:3`)).toBeNull()
  })

  it('keeps invalid active data when recovery storage cannot be written', () => {
    const storage = new MemoryStorage()
    const raw = '{bad json'
    storage.setItem(LEARNING_STORAGE_KEY, raw)
    storage.failSet = true

    expect(loadLearningState(storage, new Date('2026-08-03T12:34:56.789Z'))).toEqual({
      schemaVersion: 1,
      words: {},
      answers: {},
      completedLessons: [],
    })
    storage.failSet = false
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBe(raw)
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

  it('rejects semantically impossible review evidence and schedules', () => {
    const storage = new MemoryStorage()
    const existing = JSON.stringify(savedState())
    storage.setItem(LEARNING_STORAGE_KEY, existing)
    const invalidStates = [
      { ...savedState(), words: { '04-space-exploration:orbit': { ...savedState().words['04-space-exploration:orbit'], state: 'recallable', unaidedRecallDates: [] } } },
      { ...savedState(), words: { '04-space-exploration:orbit': { ...savedState().words['04-space-exploration:orbit'], state: 'active', unaidedRecallDates: ['2026-08-03'] } } },
      { ...savedState(), words: { '04-space-exploration:orbit': { ...savedState().words['04-space-exploration:orbit'], state: 'understood' } } },
      { ...savedState(), words: { '04-space-exploration:orbit': { ...savedState().words['04-space-exploration:orbit'], lastOutcome: null } } },
      { ...savedState(), words: { '04-space-exploration:orbit': { ...savedState().words['04-space-exploration:orbit'], lastOutcome: 'failed', intervalIndex: 1 } } },
      { ...savedState(), words: { '04-space-exploration:orbit': { ...savedState().words['04-space-exploration:orbit'], nextReviewOn: '2026-08-05' } } },
    ]

    for (const state of invalidStates)
      expect(() => importLearningState(storage, JSON.stringify(state))).toThrow('Invalid learning progress import')

    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBe(existing)
  })

  it('accepts legitimate exposure and production-first states while rejecting duplicate completed lessons', () => {
    const storage = new MemoryStorage()
    const base = savedState()
    const productionFirst = {
      ...base,
      words: {
        '04-space-exploration:orbit': {
          state: 'understood' as const,
          intervalIndex: 0,
          nextReviewOn: null,
          unaidedRecallDates: [],
          productionDates: ['2026-08-02'],
          lastOutcome: null,
        },
      },
    }

    expect(importLearningState(storage, JSON.stringify(productionFirst))).toEqual(productionFirst)
    const activeAfterFailure = {
      ...savedState(),
      words: {
        '04-space-exploration:orbit': {
          ...savedState().words['04-space-exploration:orbit'],
          intervalIndex: 0,
          nextReviewOn: '2026-08-07',
          lastOutcome: 'failed' as const,
        },
      },
    }
    expect(importLearningState(storage, JSON.stringify(activeAfterFailure))).toEqual(activeAfterFailure)
    expect(() => importLearningState(storage, JSON.stringify({ ...productionFirst, completedLessons: ['lesson-1', 'lesson-1'] }))).toThrow('Invalid learning progress import')
  })

  it('requires updatedAt to be a canonical ISO datetime', () => {
    const storage = new MemoryStorage()

    for (const updatedAt of ['2026-08-03', '2026-02-30T12:00:00.000Z', '2026-08-03T12:00:00Z']) {
      const state = savedState()
      state.answers['lesson-1:task-1'].updatedAt = updatedAt
      expect(() => importLearningState(storage, JSON.stringify(state))).toThrow('Invalid learning progress import')
    }
  })

  it('retains hostile record keys as data without changing object prototypes', () => {
    const storage = new MemoryStorage()
    const json = '{"schemaVersion":1,"words":{},"answers":{"__proto__":{"taskId":"__proto__","text":"safe","selfAssessment":{"__proto__":true},"updatedAt":"2026-08-03T12:00:00.000Z"}},"completedLessons":[]}'

    const state = importLearningState(storage, json)
    const hostileAnswer = Object.getOwnPropertyDescriptor(state.answers, '__proto__')?.value

    expect(Object.hasOwn(state.answers, '__proto__')).toBe(true)
    expect(hostileAnswer).toBeDefined()
    expect(Object.hasOwn(hostileAnswer.selfAssessment, '__proto__')).toBe(true)
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
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

describe('useLearningProgress', () => {
  it('keeps one state ref, delegates transitions with an injected clock, and persists immutable snapshots', () => {
    const storage = new MemoryStorage()
    const now = () => new Date(2026, 7, 2, 10)
    const progress = useLearningProgress({ storage, now })
    const state = progress.state
    const before = state.value
    const entryId = '04-space-exploration:orbit' as const

    progress.recordWordExposure(entryId)
    expect(progress.state).toBe(state)
    expect(state.value).not.toBe(before)
    expect(before.words).toEqual({})
    expect(state.value.words[entryId].state).toBe('understood')
    expect(loadLearningState(storage).words[entryId].state).toBe('understood')

    progress.recordWordReview(entryId, 'unaided')
    progress.recordWordProduction(entryId)
    expect(loadLearningState(storage).words[entryId]).toMatchObject({
      state: 'recallable',
      lastOutcome: 'unaided',
      productionDates: ['2026-08-02'],
    })
  })

  it('persists answers and completed lessons, and replaces the state value on import and reset', () => {
    const storage = new MemoryStorage()
    const progress = useLearningProgress({ storage, now: () => new Date('2026-08-03T12:00:00.000Z') })
    const state = progress.state

    progress.saveAnswer(savedState().answers['lesson-1:task-1'])
    progress.completeLesson('lesson-1')
    progress.completeLesson('lesson-1')
    expect(loadLearningState(storage)).toMatchObject({ answers: savedState().answers, completedLessons: ['lesson-1'] })

    const beforeImport = state.value
    progress.importProgress(exportLearningState(savedState()))
    expect(state.value).not.toBe(beforeImport)
    expect(state.value).toEqual(savedState())
    const beforeReset = state.value
    progress.resetProgress()
    expect(state.value).not.toBe(beforeReset)
    expect(state.value).toEqual({ schemaVersion: 1, words: {}, answers: {}, completedLessons: [] })
  })

  it('stays local when storage is unavailable or throws, preserving valid in-memory imports', () => {
    const storage = new MemoryStorage()
    storage.failGet = true
    const progress = useLearningProgress({ storage })
    const entryId = '04-space-exploration:orbit' as const

    expect(progress.state.value).toEqual({ schemaVersion: 1, words: {}, answers: {}, completedLessons: [] })
    expect(progress.persistenceError.value).toBeTruthy()
    storage.failGet = false
    storage.failSet = true
    progress.recordWordExposure(entryId)
    expect(progress.state.value.words[entryId].state).toBe('understood')
    expect(progress.persistenceError.value).toBeTruthy()
    progress.importProgress(exportLearningState(savedState()))
    expect(progress.state.value).toEqual(savedState())
    expect(progress.persistenceError.value).toBeTruthy()
    storage.failRemove = true
    progress.resetProgress()
    expect(progress.state.value).toEqual({ schemaVersion: 1, words: {}, answers: {}, completedLessons: [] })
    expect(progress.persistenceError.value).toBeTruthy()
  })

  it('retries a failed initial recovery before persisting a later user action', () => {
    const storage = new MemoryStorage()
    const raw = '{corrupt raw JSON'
    const now = new Date('2026-08-03T12:34:56.789Z')
    const recoveryKey = `${RECOVERY_STORAGE_KEY_PREFIX}${now.toISOString()}`
    storage.setItem(LEARNING_STORAGE_KEY, raw)
    storage.failSet = true

    const progress = useLearningProgress({ storage, now: () => now })

    expect(progress.state.value).toEqual({ schemaVersion: 1, words: {}, answers: {}, completedLessons: [] })
    expect(progress.persistenceError.value).toBeTruthy()
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBe(raw)
    storage.failSet = false
    storage.operations = []

    progress.recordWordExposure('04-space-exploration:orbit')

    expect(storage.getItem(recoveryKey)).toBe(raw)
    expect(loadLearningState(storage)).toMatchObject({
      words: { '04-space-exploration:orbit': { state: 'understood' } },
    })
    expect(storage.operations).toEqual([
      { type: 'set', key: recoveryKey, value: raw },
      { type: 'remove', key: LEARNING_STORAGE_KEY },
      { type: 'set', key: LEARNING_STORAGE_KEY, value: exportLearningState(progress.state.value) },
    ])
    expect(progress.persistenceError.value).toBeNull()
  })

  it('does not overwrite corrupt active data while a pending recovery still fails or conflicts', () => {
    const storage = new MemoryStorage()
    const raw = '{corrupt raw JSON'
    storage.setItem(LEARNING_STORAGE_KEY, raw)
    storage.failSet = true
    const progress = useLearningProgress({ storage, now: () => new Date('2026-08-03T12:34:56.789Z') })
    storage.operations = []

    progress.recordWordExposure('04-space-exploration:orbit')
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBe(raw)
    expect(progress.persistenceError.value).toBeTruthy()

    storage.failSet = false
    storage.setItem(LEARNING_STORAGE_KEY, 'externally changed')
    storage.operations = []
    progress.recordWordReview('04-space-exploration:orbit', 'unaided')
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBe('externally changed')
    expect(storage.operations).toEqual([])
    expect(progress.persistenceError.value).toBeTruthy()
  })

  it('keeps a newer active value when recovery backup triggers a re-entrant storage update', () => {
    const storage = new MemoryStorage()
    const raw = '{corrupt raw JSON'
    const newer = '{newer active value'
    const now = new Date('2026-08-03T12:34:56.789Z')
    const recoveryKey = `${RECOVERY_STORAGE_KEY_PREFIX}${now.toISOString()}`
    storage.setItem(LEARNING_STORAGE_KEY, raw)
    storage.failSet = true
    const progress = useLearningProgress({ storage, now: () => now })
    storage.failSet = false
    storage.operations = []
    storage.onSet = (key, _value, currentStorage) => {
      if (key === recoveryKey) {
        currentStorage.onSet = undefined
        currentStorage.setItem(LEARNING_STORAGE_KEY, newer)
      }
    }

    progress.recordWordExposure('04-space-exploration:orbit')

    expect(storage.getItem(recoveryKey)).toBe(raw)
    expect(storage.getItem(LEARNING_STORAGE_KEY)).toBe(newer)
    expect(storage.operations).toEqual([
      { type: 'set', key: recoveryKey, value: raw },
      { type: 'set', key: LEARNING_STORAGE_KEY, value: newer },
    ])
    expect(progress.state.value.words['04-space-exploration:orbit'].state).toBe('understood')
    expect(progress.persistenceError.value).toBeTruthy()
  })

  it('does not replace reactive state on an invalid import and works without window storage', () => {
    const storage = new MemoryStorage()
    const progress = useLearningProgress({ storage })
    const before = progress.state.value

    expect(() => progress.importProgress('{bad json')).toThrow('Invalid learning progress import')
    expect(progress.state.value).toBe(before)

    vi.stubGlobal('window', undefined)
    try {
      const serverProgress = useLearningProgress()
      serverProgress.recordWordExposure('04-space-exploration:orbit')
      expect(serverProgress.state.value.words['04-space-exploration:orbit'].state).toBe('understood')
      expect(serverProgress.persistenceError.value).toBeTruthy()
    }
    finally {
      vi.unstubAllGlobals()
    }

    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('blocked')
      },
    })
    try {
      const blockedProgress = useLearningProgress()
      expect(blockedProgress.state.value).toEqual({ schemaVersion: 1, words: {}, answers: {}, completedLessons: [] })
      expect(blockedProgress.persistenceError.value).toBeTruthy()
    }
    finally {
      vi.unstubAllGlobals()
    }
  })
})
