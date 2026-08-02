import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TopicPage from '../../src/pages/vocabulary/learn/[topic].vue'
import type { TopicManifestEntry } from '../../src/features/vocabulary-learning/content/manifest'
import type { EntryId, LearningStateV1, ProductionTask, TopicContent } from '../../src/features/vocabulary-learning/types'

const orbitId = '04-space-exploration:orbit' as EntryId
const galaxyId = '04-space-exploration:galaxy' as EntryId
const signalId = '04-space-exploration:signal' as EntryId
const probeId = '04-space-exploration:probe' as EntryId
const entryIds = [orbitId, galaxyId, signalId, probeId]
const rubric = { meaning: true, collocation: true, grammar: true, register: true, relevance: true }

const route = reactive({ params: { topic: 'space-exploration' } })
const topics = new Map<string, TopicManifestEntry>()
const learningState = ref<LearningStateV1>({ schemaVersion: 1, words: {}, answers: {}, completedLessons: [] })
const progressFacade = {
  completeLesson: vi.fn((lessonId: string) => {
    if (!learningState.value.completedLessons.includes(lessonId))
      learningState.value = { ...learningState.value, completedLessons: [...learningState.value.completedLessons, lessonId] }
  }),
  persistenceError: ref<string | null>(null),
  recordWordExposure: vi.fn((entryId: EntryId) => {
    const current = learningState.value.words[entryId]
    learningState.value = { ...learningState.value, words: { ...learningState.value.words, [entryId]: current ?? wordProgress('understood') } }
  }),
  recordWordProduction: vi.fn((entryId: EntryId) => {
    const current = learningState.value.words[entryId] ?? wordProgress('understood')
    learningState.value = { ...learningState.value, words: { ...learningState.value.words, [entryId]: { ...current, productionDates: ['2026-08-03'] } } }
  }),
  recordWordReview: vi.fn((entryId: EntryId, outcome: 'unaided' | 'prompted' | 'failed') => {
    const current = learningState.value.words[entryId] ?? wordProgress('understood')
    learningState.value = { ...learningState.value, words: { ...learningState.value.words, [entryId]: { ...current, lastOutcome: outcome } } }
  }),
  recordRecallExercise: vi.fn((exerciseId: string, entryId: EntryId, outcome: 'unaided' | 'prompted' | 'failed') => {
    if (learningState.value.recalls?.[exerciseId])
      return
    const current = learningState.value.words[entryId] ?? wordProgress('understood')
    learningState.value = {
      ...learningState.value,
      words: { ...learningState.value.words, [entryId]: { ...current, lastOutcome: outcome } },
      recalls: { ...learningState.value.recalls, [exerciseId]: { entryId, outcome, completedOn: '2026-08-03' } },
    }
  }),
  saveAnswer: vi.fn((answer: LearningStateV1['answers'][string]) => {
    learningState.value = { ...learningState.value, answers: { ...learningState.value.answers, [answer.taskId]: answer } }
  }),
  state: learningState,
}

function wordProgress(state: 'unseen' | 'understood' | 'recallable' | 'active' = 'unseen') {
  return { state, intervalIndex: 0, nextReviewOn: null, unaidedRecallDates: [], productionDates: [], lastOutcome: null }
}

vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('../../src/features/vocabulary-learning/content/manifest', () => ({ findTopicBySlug: (slug: string) => topics.get(slug) }))
vi.mock('../../src/features/vocabulary-learning/useLearningProgress', () => ({ useLearningProgress: () => progressFacade }))
vi.mock('../../src/components/vocabulary-learning/LessonReader.vue', () => ({
  // eslint-disable-next-line vue/one-component-per-file -- Route-level integration stub.
  default: defineComponent({
    props: { lesson: { required: true, type: Object } },
    emits: ['exposed'],
    setup(props, { emit }) {
      return () => h('button', { 'data-action': 'complete-input', 'onClick': () => emit('exposed', (props.lesson as { targetEntryIds: EntryId[] }).targetEntryIds) }, '完成语境输入')
    },
  }),
}))
vi.mock('../../src/components/vocabulary-learning/RecallStage.vue', () => ({
  // eslint-disable-next-line vue/one-component-per-file -- Route-level integration stub.
  default: defineComponent({
    props: { exercises: { required: true, type: Array } },
    emits: ['reviewed'],
    setup(props, { emit }) {
      return () => h('div', (props.exercises as Array<{ id: string; entryId: EntryId }>).map(exercise => h('button', { 'data-recall': exercise.id, 'onClick': () => emit('reviewed', { exerciseId: exercise.id, entryId: exercise.entryId, outcome: 'unaided' }) }, exercise.id)))
    },
  }),
}))
vi.mock('../../src/components/vocabulary-learning/ProductionStage.vue', () => ({
  // eslint-disable-next-line vue/one-component-per-file -- Route-level integration stub.
  default: defineComponent({
    props: { tasks: { required: true, type: Array } },
    emits: ['answer-saved', 'production-recorded'],
    setup(props, { emit }) {
      const answerFor = (task: ProductionTask) => ({ taskId: task.id, text: `A complete ${task.id} response.`, selfAssessment: rubric, updatedAt: '2026-08-03T00:00:00.000Z' })
      return () => h('div', (props.tasks as ProductionTask[]).flatMap(task => [
        h('p', task.prompt),
        h('button', { 'data-save': task.id, 'onClick': () => emit('answer-saved', answerFor(task)) }, `保存 ${task.id}`),
        h('button', { 'data-record': task.id, 'onClick': () => emit('production-recorded', { taskId: task.id, entryIds: task.requiredEntryIds }) }, `提交 ${task.id}`),
      ]))
    },
  }),
}))
vi.mock('../../src/components/vocabulary-learning/DelayedReviewStage.vue', () => ({
  // eslint-disable-next-line vue/one-component-per-file -- Route-level integration stub.
  default: defineComponent({
    props: { items: { required: true, type: Array } },
    emits: ['reviewed'],
    setup(props, { emit }) {
      return () => h('div', (props.items as Array<{ entry: { id: EntryId } }>).map(item => h('button', { 'data-delayed-review': item.entry.id, 'onClick': () => emit('reviewed', { entryId: item.entry.id, outcome: 'unaided' }) }, item.entry.id)))
    },
  }),
}))

function tasks(prefix: string): ProductionTask[] {
  return entryIds.map((entryId, index) => ({
    id: `${prefix}-production-${index + 1}`,
    mode: 'sentence',
    prompt: `Use ${entryId}.`,
    requiredEntryIds: [entryId],
    referenceAnswer: 'A reference answer.',
    rubric: ['meaning', 'collocation', 'grammar', 'register', 'relevance'],
  }))
}

function lesson(id: string) {
  return {
    id,
    title: id,
    warmupPrompt: `Warm up ${id}`,
    targetEntryIds: entryIds,
    passage: [],
    translation: [],
    recallExercises: entryIds.map((entryId, index) => ({ id: `${id}-recall-${index + 1}`, entryId, before: '', after: '', acceptedAnswers: [entryId.split(':')[1]!], meaningCue: '提示' })),
    productionTasks: tasks(id),
  }
}

function content(title = '太空探索'): TopicContent {
  const first = lesson('lesson-one')
  const wordCards = Object.fromEntries(entryIds.map(entryId => [entryId, {
    entryId,
    priority: 'standard' as const,
    ipa: '/test/',
    meaning: '测试含义',
    collocations: ['test collocation', 'another collocation'] as [string, string],
    example: { text: 'A test example.', use: 'both' as const },
    passageSentence: 'A test passage sentence.',
    outputPrompt: 'Use the target word.',
  }])) as TopicContent['wordCards']
  return {
    schemaVersion: 1,
    topicId: '04-space-exploration',
    slug: 'space-exploration',
    title,
    level: 'B2-C1',
    wordCards,
    lessons: [first, lesson('lesson-two')],
    finalSpeaking: { ...tasks('final')[0]!, id: 'final-speaking', mode: 'speaking', prompt: 'IELTS Speaking challenge' },
    finalWriting: { ...tasks('final')[1]!, id: 'final-writing', mode: 'writing', prompt: 'IELTS Task 2 paragraph challenge' },
  }
}

function mountPage() {
  return mount(TopicPage, { global: { components: { RouterLink: { template: '<a><slot /></a>' } } } })
}

async function selectStage(wrapper: ReturnType<typeof mount>, stage: string) {
  await wrapper.get(`[data-stage="${stage}"]`).trigger('click')
}

describe('active vocabulary topic page', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 3, 12))
    route.params.topic = 'space-exploration'
    topics.clear()
    topics.set('space-exploration', { sourceTopicId: '04_太空探索', slug: 'space-exploration', title: '太空探索', available: true, load: async () => ({ default: content() }) })
    topics.set('space-two', { sourceTopicId: '04_太空探索', slug: 'space-two', title: '第二主题', available: true, load: async () => ({ default: content('第二主题') }) })
    learningState.value = { schemaVersion: 1, words: {}, answers: {}, completedLessons: [] }
    progressFacade.persistenceError.value = null
    progressFacade.completeLesson.mockClear()
    progressFacade.recordWordExposure.mockClear()
    progressFacade.recordWordProduction.mockClear()
    progressFacade.recordWordReview.mockClear()
    progressFacade.recordRecallExercise.mockClear()
    progressFacade.saveAnswer.mockClear()
  })

  afterEach(() => {
    topics.clear()
    vi.useRealTimers()
  })

  it('gates forward progress behind explicit input, every recall, and every valid production task while keeping completed stages available backwards', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.findAll('[data-stage]').map(item => item.text().trim())).toEqual(['预热', '语境输入', '主动回忆', '主动使用', '延迟复习'])
    expect(wrapper.get('[data-stage="input"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-stage="recall"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-stage="production"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-stage="review"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-stage-status]').text()).toContain('先写下预热回答')

    await wrapper.get('[data-warmup-answer]').setValue('I know that an orbit is a path around a planet.')
    await wrapper.get('[data-action="complete-warmup"]').trigger('click')
    expect(progressFacade.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'warmup:lesson-one',
      text: 'I know that an orbit is a path around a planet.',
    }))
    expect(wrapper.get('[data-stage="input"]').attributes('disabled')).toBeUndefined()

    await selectStage(wrapper, 'input')
    expect(progressFacade.recordWordExposure).not.toHaveBeenCalled()
    await wrapper.get('[data-action="complete-input"]').trigger('click')
    await selectStage(wrapper, 'input')
    await wrapper.get('[data-action="complete-input"]').trigger('click')
    expect(progressFacade.recordWordExposure).toHaveBeenCalledTimes(4)
    expect(wrapper.get('[data-stage="recall"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-recall="lesson-one-recall-1"]').exists()).toBe(true)

    for (let index = 1; index <= 3; index += 1)
      await wrapper.get(`[data-recall="lesson-one-recall-${index}"]`).trigger('click')
    expect(wrapper.get('[data-stage="production"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-recall="lesson-one-recall-4"]').trigger('click')
    expect(progressFacade.recordRecallExercise).toHaveBeenCalledTimes(4)
    expect(wrapper.get('[data-stage="production"]').attributes('disabled')).toBeUndefined()

    for (let index = 1; index <= 3; index += 1) {
      const taskId = `lesson-one-production-${index}`
      await wrapper.get(`[data-save="${taskId}"]`).trigger('click')
      await wrapper.get(`[data-record="${taskId}"]`).trigger('click')
    }
    expect(wrapper.get('[data-stage="review"]').attributes('disabled')).toBeDefined()
    const finalTaskId = 'lesson-one-production-4'
    await wrapper.get(`[data-save="${finalTaskId}"]`).trigger('click')
    await wrapper.get(`[data-record="${finalTaskId}"]`).trigger('click')
    expect(progressFacade.recordWordProduction).toHaveBeenCalledTimes(4)
    expect(progressFacade.completeLesson).toHaveBeenCalledWith('lesson-one')
    expect(wrapper.get('[data-stage="review"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('[data-action="next-lesson"]').trigger('click')
    expect(wrapper.get('[data-stage="production"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-action="previous-lesson"]').trigger('click')

    await selectStage(wrapper, 'input')
    expect(wrapper.get('[data-action="complete-input"]').text()).toContain('完成语境输入')
    expect(wrapper.get('[data-stage="input"]').attributes('disabled')).toBeUndefined()
    learningState.value = { ...learningState.value, words: {} }
    route.params.topic = 'space-two'
    await nextTick()
    await flushPromises()
    await selectStage(wrapper, 'input')
    await wrapper.get('[data-action="complete-input"]').trigger('click')
    expect(progressFacade.recordWordExposure).toHaveBeenCalledTimes(8)
  })

  it('resets route-local de-duplication, reconciles persisted completion after reload, unlocks finals only after every lesson, and refreshes due totals at midnight', async () => {
    const persistedAnswers = Object.fromEntries(tasks('lesson-one').map(task => [task.id, { taskId: task.id, text: 'Saved.', selfAssessment: rubric, updatedAt: '2026-08-03T00:00:00.000Z' }]))
    learningState.value = {
      schemaVersion: 1,
      words: {
        [orbitId]: { ...wordProgress('understood'), lastOutcome: 'unaided', nextReviewOn: '2026-08-04' },
        [galaxyId]: { ...wordProgress('understood'), lastOutcome: 'unaided' },
        [signalId]: { ...wordProgress('understood'), lastOutcome: 'unaided' },
        [probeId]: { ...wordProgress('understood'), lastOutcome: 'unaided' },
      },
      answers: persistedAnswers,
      completedLessons: [],
      recalls: Object.fromEntries(entryIds.map((entryId, index) => [`lesson-one-recall-${index + 1}`, { entryId, outcome: 'unaided', completedOn: '2026-08-03' }])),
    }
    vi.setSystemTime(new Date(2026, 7, 3, 23, 59, 50))
    const wrapper = mountPage()
    await flushPromises()

    expect(progressFacade.completeLesson).toHaveBeenCalledTimes(1)
    expect(progressFacade.completeLesson).toHaveBeenCalledWith('lesson-one')
    expect(wrapper.get('[data-stage="recall"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-topic-stats]').text()).toMatch(/今日待复习\s*0/)
    expect(wrapper.text()).toContain('完成所有课程后解锁')
    await vi.advanceTimersByTimeAsync(10_001)
    expect(wrapper.get('[data-topic-stats]').text()).toMatch(/今日待复习\s*1/)
    await selectStage(wrapper, 'review')
    await wrapper.get(`[data-delayed-review="${orbitId}"]`).trigger('click')
    expect(progressFacade.recordWordReview).toHaveBeenCalledWith(orbitId, 'unaided')

    learningState.value = { ...learningState.value, completedLessons: ['lesson-one', 'lesson-two'] }
    await nextTick()
    expect(wrapper.text()).toContain('IELTS Speaking')
    expect(wrapper.text()).toContain('IELTS Task 2')

    await selectStage(wrapper, 'input')
    await wrapper.get('[data-action="complete-input"]').trigger('click')
    expect(progressFacade.recordWordExposure).not.toHaveBeenCalled()
  })

  it('keeps persistence errors visible without hiding loaded content', async () => {
    progressFacade.persistenceError.value = 'Learning progress storage is unavailable'
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('太空探索')
    expect(wrapper.get('[role="alert"]').text()).toContain('Learning progress storage is unavailable')
  })
})
