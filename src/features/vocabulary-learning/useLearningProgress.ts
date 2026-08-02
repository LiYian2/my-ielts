import { type Ref, ref } from 'vue'
import { createWordProgress, recordExposure, recordProduction, recordReview } from './review'
import {
  createLearningState,
  exportLearningState,
  loadLearningState,
  parseLearningState,
  resetLearningState,
  saveLearningState,
} from './storage'
import type { EntryId, LearningStateV1, ReviewOutcome, SavedAnswer } from './types'

export interface LearningProgressOptions {
  storage?: Storage
  now?: () => Date
}

export function useLearningProgress(options: LearningProgressOptions = {}) {
  const now = options.now ?? (() => new Date())
  const storage = options.storage ?? browserStorage()
  const persistenceError = ref<string | null>(null)
  const state = ref(loadInitialState(storage, now, persistenceError)) as Ref<LearningStateV1>

  function persist(): void {
    if (!storage) {
      persistenceError.value = 'Learning progress storage is unavailable'
      return
    }

    try {
      saveLearningState(storage, state.value)
      persistenceError.value = null
    }
    catch (error) {
      persistenceError.value = storageErrorMessage(error)
    }
  }

  function recordWordExposure(entryId: EntryId, date = now()): void {
    replaceWord(entryId, progress => recordExposure(progress, date))
  }

  function recordWordReview(entryId: EntryId, outcome: ReviewOutcome, date = now()): void {
    replaceWord(entryId, progress => recordReview(progress, outcome, date))
  }

  function recordWordProduction(entryId: EntryId, date = now()): void {
    replaceWord(entryId, progress => recordProduction(progress, date))
  }

  function saveAnswer(answer: SavedAnswer): void {
    state.value = {
      ...state.value,
      answers: {
        ...state.value.answers,
        [answer.taskId]: {
          ...answer,
          selfAssessment: { ...answer.selfAssessment },
        },
      },
    }
    persist()
  }

  function completeLesson(lessonId: string): void {
    state.value = {
      ...state.value,
      completedLessons: state.value.completedLessons.includes(lessonId)
        ? state.value.completedLessons
        : [...state.value.completedLessons, lessonId],
    }
    persist()
  }

  function importProgress(json: string): void {
    const imported = parseLearningState(json)
    state.value = imported
    persist()
  }

  function exportProgress(): string {
    return exportLearningState(state.value)
  }

  function resetProgress(): void {
    state.value = createLearningState()
    if (!storage) {
      persistenceError.value = 'Learning progress storage is unavailable'
      return
    }

    try {
      resetLearningState(storage)
      persistenceError.value = null
    }
    catch (error) {
      persistenceError.value = storageErrorMessage(error)
    }
  }

  function replaceWord(entryId: EntryId, transition: (progress: ReturnType<typeof createWordProgress>) => ReturnType<typeof createWordProgress>): void {
    const progress = state.value.words[entryId] ?? createWordProgress()
    state.value = {
      ...state.value,
      words: {
        ...state.value.words,
        [entryId]: transition(progress),
      },
    }
    persist()
  }

  return {
    state,
    persistenceError,
    recordWordExposure,
    recordWordReview,
    recordWordProduction,
    saveAnswer,
    completeLesson,
    importProgress,
    exportProgress,
    resetProgress,
  }
}

function loadInitialState(storage: Storage | undefined, now: () => Date, persistenceError: Ref<string | null>): LearningStateV1 {
  if (!storage) {
    persistenceError.value = 'Learning progress storage is unavailable'
    return createLearningState()
  }

  try {
    return loadLearningState(storage, now())
  }
  catch (error) {
    persistenceError.value = storageErrorMessage(error)
    return createLearningState()
  }
}

function storageErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Learning progress storage is unavailable'
}

function browserStorage(): Storage | undefined {
  if (typeof window === 'undefined')
    return undefined

  try {
    return window.localStorage
  }
  catch {
    return undefined
  }
}
