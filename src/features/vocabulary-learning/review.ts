import type { MasteryState, ReviewOutcome, WordProgress } from './types'

export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const

export function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addLocalCalendarDays(date: Date, days: number): string {
  return localDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days))
}

function copyProgress(progress: WordProgress): WordProgress {
  return {
    ...progress,
    unaidedRecallDates: [...progress.unaidedRecallDates],
    productionDates: [...progress.productionDates],
  }
}

function addDistinctDate(dates: string[], dateKey: string): string[] {
  return dates.includes(dateKey) ? [...dates] : [...dates, dateKey]
}

function stateFromEvidence(
  currentState: MasteryState,
  unaidedRecallDates: string[],
  productionDates: string[],
): MasteryState {
  if (unaidedRecallDates.length >= 2 && productionDates.length > 0)
    return 'active'
  if (unaidedRecallDates.length > 0)
    return 'recallable'
  return currentState
}

export function createWordProgress(): WordProgress {
  return {
    state: 'unseen',
    intervalIndex: 0,
    nextReviewOn: null,
    unaidedRecallDates: [],
    productionDates: [],
    lastOutcome: null,
  }
}

export function recordExposure(progress: WordProgress, _date: Date): WordProgress {
  return {
    ...copyProgress(progress),
    state: progress.state === 'unseen' ? 'understood' : progress.state,
  }
}

export function recordReview(progress: WordProgress, outcome: ReviewOutcome, date: Date): WordProgress {
  const next = copyProgress(progress)
  if (outcome !== 'unaided') {
    return {
      ...next,
      intervalIndex: outcome === 'failed' ? 0 : progress.intervalIndex,
      nextReviewOn: addLocalCalendarDays(date, REVIEW_INTERVAL_DAYS[0]),
      lastOutcome: outcome,
    }
  }

  const dateKey = localDateKey(date)
  const isNewUnaidedRecall = !progress.unaidedRecallDates.includes(dateKey)
  const unaidedRecallDates = addDistinctDate(progress.unaidedRecallDates, dateKey)
  const intervalIndex = !isNewUnaidedRecall
    ? progress.intervalIndex
    : progress.unaidedRecallDates.length === 0
      ? 0
      : Math.min(progress.intervalIndex + 1, REVIEW_INTERVAL_DAYS.length - 1)

  return {
    ...next,
    state: stateFromEvidence(progress.state, unaidedRecallDates, next.productionDates),
    intervalIndex,
    nextReviewOn: isNewUnaidedRecall
      ? addLocalCalendarDays(date, REVIEW_INTERVAL_DAYS[intervalIndex])
      : progress.nextReviewOn,
    unaidedRecallDates,
    lastOutcome: outcome,
  }
}

export function recordProduction(progress: WordProgress, date: Date): WordProgress {
  const next = copyProgress(progress)
  const productionDates = addDistinctDate(progress.productionDates, localDateKey(date))

  return {
    ...next,
    state: stateFromEvidence(progress.state, next.unaidedRecallDates, productionDates),
    productionDates,
  }
}

export function isDue(progress: WordProgress, date: Date): boolean {
  return progress.nextReviewOn !== null && progress.nextReviewOn <= localDateKey(date)
}
