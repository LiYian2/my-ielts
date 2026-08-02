import { type Ref, ref } from 'vue'
import { createWordProgress, recordExposure, recordProduction, recordReview } from './review'
import {
  createLearningState,
  exportLearningState,
  importLearningState,
  loadLearningState,
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
  const state = ref(storage ? loadLearningState(storage, now()) : createLearningState()) as Ref<LearningStateV1>

  function persist(): void {
    if (storage)
      saveLearningState(storage, state.value)
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
    state.value = requiredStorage().importState(json)
  }

  function exportProgress(): string {
    return exportLearningState(state.value)
  }

  function resetProgress(): void {
    state.value = requiredStorage().resetState()
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

  function requiredStorage() {
    if (!storage)
      throw new Error('Learning progress storage is unavailable')

    return {
      importState: (json: string) => importLearningState(storage, json),
      resetState: () => resetLearningState(storage),
    }
  }

  return {
    state,
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
