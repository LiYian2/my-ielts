import { describe, expect, it } from 'vitest'
import {
  REVIEW_INTERVAL_DAYS,
  createWordProgress,
  isDue,
  localDateKey,
  recordExposure,
  recordProduction,
  recordReview,
} from '../../src/features/vocabulary-learning/review'

describe('vocabulary review scheduling', () => {
  it('moves an unseen word to understood without scheduling a review', () => {
    const progress = createWordProgress()

    expect(recordExposure(progress, new Date(2026, 7, 2, 10))).toEqual({
      state: 'understood',
      intervalIndex: 0,
      nextReviewOn: null,
      unaidedRecallDates: [],
      productionDates: [],
      lastOutcome: null,
    })
  })

  it('makes a first unaided recall recallable and due the next local day', () => {
    const progress = recordReview(createWordProgress(), 'unaided', new Date(2026, 7, 2, 10))

    expect(progress).toMatchObject({
      state: 'recallable',
      intervalIndex: 0,
      nextReviewOn: '2026-08-03',
      unaidedRecallDates: ['2026-08-02'],
      lastOutcome: 'unaided',
    })
  })

  it('keeps the current interval after prompted success and schedules the next day', () => {
    const recalled = recordReview(createWordProgress(), 'unaided', new Date(2026, 7, 2, 10))

    expect(recordReview(recalled, 'prompted', new Date(2026, 7, 3, 10))).toMatchObject({
      intervalIndex: 0,
      nextReviewOn: '2026-08-04',
      lastOutcome: 'prompted',
    })
  })

  it('resets a failed review to the one-day interval', () => {
    const progress = {
      ...createWordProgress(),
      state: 'recallable' as const,
      intervalIndex: 2,
      nextReviewOn: '2026-08-09',
    }

    expect(recordReview(progress, 'failed', new Date(2026, 7, 3, 10))).toMatchObject({
      state: 'recallable',
      intervalIndex: 0,
      nextReviewOn: '2026-08-04',
      lastOutcome: 'failed',
    })
  })

  it('deduplicates same-date unaided recalls so they cannot satisfy active mastery', () => {
    const firstRecall = recordReview(createWordProgress(), 'unaided', new Date(2026, 7, 2, 10))
    const sameDateRecall = recordReview(firstRecall, 'unaided', new Date(2026, 7, 2, 15))

    expect(recordProduction(sameDateRecall, new Date(2026, 7, 2, 16))).toMatchObject({
      state: 'recallable',
      unaidedRecallDates: ['2026-08-02'],
      productionDates: ['2026-08-02'],
    })
  })

  it('makes a word active after unaided recalls on two dates and production', () => {
    const firstRecall = recordReview(createWordProgress(), 'unaided', new Date(2026, 7, 2, 10))
    const secondRecall = recordReview(firstRecall, 'unaided', new Date(2026, 7, 3, 10))

    expect(recordProduction(secondRecall, new Date(2026, 7, 3, 16))).toMatchObject({
      state: 'active',
      unaidedRecallDates: ['2026-08-02', '2026-08-03'],
      productionDates: ['2026-08-03'],
    })
  })

  it('retains active mastery after a later failure while resetting review timing', () => {
    const firstRecall = recordReview(createWordProgress(), 'unaided', new Date(2026, 7, 2, 10))
    const active = recordProduction(
      recordReview(firstRecall, 'unaided', new Date(2026, 7, 3, 10)),
      new Date(2026, 7, 3, 16),
    )

    expect(recordReview(active, 'failed', new Date(2026, 7, 6, 10))).toMatchObject({
      state: 'active',
      intervalIndex: 0,
      nextReviewOn: '2026-08-07',
      lastOutcome: 'failed',
    })
  })

  it('does not make production alone active', () => {
    expect(recordProduction(createWordProgress(), new Date(2026, 7, 2, 16))).toMatchObject({
      state: 'unseen',
      productionDates: ['2026-08-02'],
    })
  })

  it('returns a new snapshot without mutating the input', () => {
    const progress = createWordProgress()
    const updated = recordReview(progress, 'unaided', new Date(2026, 7, 2, 10))

    expect(updated).not.toBe(progress)
    expect(updated.unaidedRecallDates).not.toBe(progress.unaidedRecallDates)
    expect(progress).toEqual(createWordProgress())
  })

  it('advances through 1, 3, 7, 14, and capped 30-day intervals', () => {
    const reviewDates = [
      new Date(2026, 7, 2, 10),
      new Date(2026, 7, 3, 10),
      new Date(2026, 7, 6, 10),
      new Date(2026, 7, 13, 10),
      new Date(2026, 7, 27, 10),
      new Date(2026, 8, 26, 10),
    ]
    const expectedDueDates = [
      '2026-08-03',
      '2026-08-06',
      '2026-08-13',
      '2026-08-27',
      '2026-09-26',
      '2026-10-26',
    ]

    const progresses = reviewDates.reduce<ReturnType<typeof createWordProgress>[]>(
      (results, date) => [...results, recordReview(results.at(-1) ?? createWordProgress(), 'unaided', date)],
      [],
    )

    expect(REVIEW_INTERVAL_DAYS).toEqual([1, 3, 7, 14, 30])
    expect(progresses.map(progress => progress.nextReviewOn)).toEqual(expectedDueDates)
    expect(progresses.map(progress => progress.intervalIndex)).toEqual([0, 1, 2, 3, 4, 4])
  })

  it('uses local calendar dates for due checks and calendar-day additions', () => {
    const localMidnight = new Date(2026, 7, 2, 0, 5)
    const progress = { ...createWordProgress(), nextReviewOn: '2026-08-02' }
    const dstBoundaryReview = recordReview(createWordProgress(), 'unaided', new Date(2026, 2, 8, 12))

    expect(localDateKey(localMidnight)).toBe('2026-08-02')
    expect(isDue(progress, localMidnight)).toBe(true)
    expect(isDue(progress, new Date(2026, 7, 1, 23, 59))).toBe(false)
    expect(dstBoundaryReview.nextReviewOn).toBe('2026-03-09')
  })
})
