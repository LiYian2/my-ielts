import type { EntryId, LearningStateV1, MasteryState, ReviewOutcome, SavedAnswer, WordProgress } from './types'
import { REVIEW_INTERVAL_DAYS } from './review'

export const LEARNING_STORAGE_KEY = 'my-ielts:vocabulary-learning:v1'
export const RECOVERY_STORAGE_KEY_PREFIX = 'my-ielts:vocabulary-learning:recovery:'

const MASTERY_STATES: MasteryState[] = ['unseen', 'understood', 'recallable', 'active']
const REVIEW_OUTCOMES: ReviewOutcome[] = ['unaided', 'prompted', 'failed']
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ENTRY_ID_PATTERN = /^[^:\s]+:[^:\s]+$/

export function createLearningState(): LearningStateV1 {
  return {
    schemaVersion: 1,
    words: {},
    answers: {},
    completedLessons: [],
  }
}

export function loadLearningState(storage: Storage, now = new Date()): LearningStateV1 {
  const raw = storage.getItem(LEARNING_STORAGE_KEY)
  if (raw === null)
    return createLearningState()

  try {
    return parseLearningState(raw)
  }
  catch {
    recoverInvalidState(storage, raw, now)
    return createLearningState()
  }
}

export function saveLearningState(storage: Storage, state: LearningStateV1): void {
  storage.setItem(LEARNING_STORAGE_KEY, exportLearningState(state))
}

export function exportLearningState(state: LearningStateV1): string {
  return JSON.stringify(validateLearningState(state))
}

export function importLearningState(storage: Storage, json: string): LearningStateV1 {
  const state = parseLearningState(json)
  saveLearningState(storage, state)
  return state
}

export function resetLearningState(storage: Storage): LearningStateV1 {
  storage.removeItem(LEARNING_STORAGE_KEY)
  return createLearningState()
}

export function parseLearningState(json: string): LearningStateV1 {
  try {
    return validateLearningState(JSON.parse(json))
  }
  catch (error) {
    if (error instanceof SyntaxError)
      throw new Error('Invalid learning progress import')
    throw error
  }
}

function validateLearningState(value: unknown): LearningStateV1 {
  if (!isRecord(value))
    throw new Error('Invalid learning progress import')
  if (value.schemaVersion !== 1) {
    if (typeof value.schemaVersion === 'number')
      throw new Error('Unsupported learning progress schema version')
    throw new Error('Invalid learning progress import')
  }
  if (!isRecord(value.words) || !isRecord(value.answers) || !Array.isArray(value.completedLessons))
    throw new Error('Invalid learning progress import')

  const words = Object.fromEntries(Object.entries(value.words).map(([entryId, progress]) => {
    if (!ENTRY_ID_PATTERN.test(entryId))
      throw new Error('Invalid learning progress import')
    return [entryId, validateWordProgress(progress)]
  })) as Record<EntryId, WordProgress>
  const answers = Object.fromEntries(Object.entries(value.answers).map(([taskId, answer]) => {
    if (!isNonEmptyString(taskId))
      throw new Error('Invalid learning progress import')
    return [taskId, validateSavedAnswer(answer, taskId)]
  })) as Record<string, SavedAnswer>

  if (!value.completedLessons.every(isNonEmptyString) || new Set(value.completedLessons).size !== value.completedLessons.length)
    throw new Error('Invalid learning progress import')

  return {
    schemaVersion: 1,
    words,
    answers,
    completedLessons: [...value.completedLessons],
  }
}

function validateWordProgress(value: unknown): WordProgress {
  if (!isRecord(value)
    || !MASTERY_STATES.includes(value.state as MasteryState)
    || !isReviewIntervalIndex(value.intervalIndex)
    || (value.nextReviewOn !== null && !isDateKey(value.nextReviewOn))
    || !isDistinctDateKeyArray(value.unaidedRecallDates)
    || !isDistinctDateKeyArray(value.productionDates)
    || (value.lastOutcome !== null && !REVIEW_OUTCOMES.includes(value.lastOutcome as ReviewOutcome)))
    throw new Error('Invalid learning progress import')

  const progress: WordProgress = {
    state: value.state as MasteryState,
    intervalIndex: value.intervalIndex,
    nextReviewOn: value.nextReviewOn,
    unaidedRecallDates: [...value.unaidedRecallDates],
    productionDates: [...value.productionDates],
    lastOutcome: value.lastOutcome as ReviewOutcome | null,
  }
  if (!isSemanticallyValidWordProgress(progress))
    throw new Error('Invalid learning progress import')

  return progress
}

function validateSavedAnswer(value: unknown, taskId: string): SavedAnswer {
  if (!isRecord(value)
    || value.taskId !== taskId
    || typeof value.text !== 'string'
    || !isBooleanRecord(value.selfAssessment)
    || !isDateTime(value.updatedAt))
    throw new Error('Invalid learning progress import')

  return {
    taskId,
    text: value.text,
    selfAssessment: { ...value.selfAssessment },
    updatedAt: value.updatedAt,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value))
    return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

function isDistinctDateKeyArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isDateKey) && new Set(value).size === value.length
}

function isReviewIntervalIndex(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value < REVIEW_INTERVAL_DAYS.length
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return isRecord(value) && Object.values(value).every(rating => typeof rating === 'boolean')
}

function isDateTime(value: unknown): value is string {
  if (typeof value !== 'string')
    return false

  const date = new Date(value)
  return !Number.isNaN(date.valueOf()) && date.toISOString() === value
}

function isSemanticallyValidWordProgress(progress: WordProgress): boolean {
  const unaidedCount = progress.unaidedRecallDates.length
  const hasProduction = progress.productionDates.length > 0

  if (progress.state === 'recallable' && unaidedCount === 0)
    return false
  if (progress.state === 'active' && (unaidedCount < 2 || !hasProduction))
    return false
  if ((progress.state === 'unseen' || progress.state === 'understood') && unaidedCount > 0)
    return false
  if (progress.state === 'recallable' && unaidedCount >= 2 && hasProduction)
    return false
  if ((progress.nextReviewOn === null) !== (progress.lastOutcome === null))
    return false
  if (progress.lastOutcome === 'failed' && progress.intervalIndex !== 0)
    return false
  if (progress.lastOutcome === 'unaided') {
    const lastUnaidedDate = progress.unaidedRecallDates.at(-1)
    if (!lastUnaidedDate || progress.nextReviewOn === null)
      return false
    if (progress.nextReviewOn !== addCalendarDays(lastUnaidedDate, REVIEW_INTERVAL_DAYS[progress.intervalIndex]))
      return false
  }

  return true
}

function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day + days)
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function recoverInvalidState(storage: Storage, raw: string, now: Date): void {
  try {
    const baseKey = `${RECOVERY_STORAGE_KEY_PREFIX}${now.toISOString()}`
    let recoveryKey = baseKey
    let suffix = 1
    while (storage.getItem(recoveryKey) !== null) {
      recoveryKey = `${baseKey}:${suffix}`
      suffix += 1
    }
    storage.setItem(recoveryKey, raw)
    storage.removeItem(LEARNING_STORAGE_KEY)
  }
  catch {
    // The active value remains untouched unless its recovery copy was written first.
  }
}
