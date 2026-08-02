import { type Ref, ref } from 'vue'
import { createWordProgress, localDateKey, recordExposure, recordProduction, recordReview } from './review'
import {
  type LearningStateLoadResult,
  createLearningState,
  exportLearningState,
  loadLearningStateWithRecovery,
  parseLearningState,
  resetLearningState,
  retryPendingLearningStateRecovery,
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
  const initial = loadInitialState(storage, now, persistenceError)
  let pendingRecovery = initial.pendingRecovery
  const state = ref(initial.state) as Ref<LearningStateV1>

  function persist(): void {
    if (!storage) {
      persistenceError.value = 'Learning progress storage is unavailable'
      return
    }
    if (!recoverPendingStorage())
      return

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

  function recordRecallExercise(exerciseId: string, entryId: EntryId, outcome: ReviewOutcome, date = now()): void {
    if (state.value.recalls?.[exerciseId])
      return

    const progress = state.value.words[entryId] ?? createWordProgress()
    state.value = {
      ...state.value,
      words: {
        ...state.value.words,
        [entryId]: recordReview(progress, outcome, date),
      },
      recalls: {
        ...state.value.recalls,
        [exerciseId]: {
          entryId,
          outcome,
          completedOn: localDateKey(date),
        },
      },
    }
    persist()
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
    if (!recoverPendingStorage())
      return

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

  function recoverPendingStorage(): boolean {
    if (!pendingRecovery || !storage)
      return true

    const outcome = retryPendingLearningStateRecovery(storage, pendingRecovery)
    if (outcome === 'recovered') {
      pendingRecovery = undefined
      return true
    }

    persistenceError.value = outcome === 'conflict'
      ? 'Learning progress changed before corrupt-state recovery could finish'
      : 'Learning progress recovery is pending'
    return false
  }

  return {
    state,
    persistenceError,
    recordWordExposure,
    recordWordReview,
    recordRecallExercise,
    recordWordProduction,
    saveAnswer,
    completeLesson,
    importProgress,
    exportProgress,
    resetProgress,
  }
}

function loadInitialState(storage: Storage | undefined, now: () => Date, persistenceError: Ref<string | null>): LearningStateLoadResult {
  if (!storage) {
    persistenceError.value = 'Learning progress storage is unavailable'
    return { state: createLearningState() }
  }

  try {
    const result = loadLearningStateWithRecovery(storage, now())
    if (result.pendingRecovery)
      persistenceError.value = 'Learning progress recovery is pending'
    return result
  }
  catch (error) {
    persistenceError.value = storageErrorMessage(error)
    return { state: createLearningState() }
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
