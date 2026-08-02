import { flushPromises, mount } from '@vue/test-utils'
import { computed, defineComponent, h, nextTick, reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TopicPage from '../../src/pages/vocabulary/learn/[topic].vue'
import type { TopicManifestEntry } from '../../src/features/vocabulary-learning/content/manifest'
import type { EntryId, LearningStateV1, ProductionTask, TopicContent } from '../../src/features/vocabulary-learning/types'

const orbitId = '04-space-exploration:orbit' as EntryId
const galaxyId = '04-space-exploration:galaxy' as EntryId
const signalId = '04-space-exploration:signal' as EntryId
const probeId = '04-space-exploration:probe' as EntryId

const route = { params: { topic: 'space-exploration' } }
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
    learningState.value = {
      ...learningState.value,
      words: {
        ...learningState.value.words,
        [entryId]: current ?? { state: 'understood', intervalIndex: 0, nextReviewOn: null, unaidedRecallDates: [], productionDates: [], lastOutcome: null },
      },
    }
  }),
  recordWordProduction: vi.fn((entryId: EntryId) => {
    const current = learningState.value.words[entryId] ?? { state: 'understood', intervalIndex: 0, nextReviewOn: null, unaidedRecallDates: [], productionDates: [], lastOutcome: null }
    learningState.value = { ...learningState.value, words: { ...learningState.value.words, [entryId]: { ...current, productionDates: ['2026-08-03'] } } }
  }),
  recordWordReview: vi.fn((entryId: EntryId, outcome: 'unaided' | 'prompted' | 'failed') => {
    const current = learningState.value.words[entryId] ?? { state: 'understood', intervalIndex: 0, nextReviewOn: null, unaidedRecallDates: [], productionDates: [], lastOutcome: null }
    learningState.value = { ...learningState.value, words: { ...learningState.value.words, [entryId]: { ...current, lastOutcome: outcome } } }
  }),
  saveAnswer: vi.fn((answer: LearningStateV1['answers'][string]) => {
    learningState.value = { ...learningState.value, answers: { ...learningState.value.answers, [answer.taskId]: answer } }
  }),
  state: learningState,
}

vi.mock('vue-router', () => ({ useRoute: () => reactive(route) }))
vi.mock('../../src/features/vocabulary-learning/content/manifest', () => ({
  findTopicBySlug: (slug: string) => topics.get(slug),
}))
vi.mock('../../src/features/vocabulary-learning/canonical', () => ({
  getCanonicalTopic: () => ({
    id: '04-space-exploration',
    label: '04_太空探索',
    chapterAudioPath: '',
    entries: [
      { id: orbitId, primaryHeadword: 'orbit' },
      { id: galaxyId, primaryHeadword: 'galaxy' },
      { id: signalId, primaryHeadword: 'signal' },
      { id: probeId, primaryHeadword: 'probe' },
    ],
  }),
}))
vi.mock('../../src/features/vocabulary-learning/useLearningProgress', () => ({ useLearningProgress: () => progressFacade }))
vi.mock('../../src/components/vocabulary-learning/LessonReader.vue', () => ({
  // eslint-disable-next-line vue/one-component-per-file -- Route-level integration stub.
  default: defineComponent({
    props: { lesson: { required: true, type: Object } },
    emits: ['exposed'],
    setup(props, { emit }) {
      return () => h('button', { 'data-action': 'expose', 'onClick': () => emit('exposed', (props.lesson as { targetEntryIds: EntryId[] }).targetEntryIds) }, '完成语境输入')
    },
  }),
}))
vi.mock('../../src/components/vocabulary-learning/RecallStage.vue', () => ({
  // eslint-disable-next-line vue/one-component-per-file -- Route-level integration stub.
  default: defineComponent({
    props: { exercises: { required: true, type: Array } },
    emits: ['reviewed'],
    setup(props, { emit }) {
      return () => h('button', { 'data-action': 'recall', 'onClick': () => emit('reviewed', { entryId: (props.exercises as Array<{ entryId: EntryId }>)[0]!.entryId, outcome: 'unaided' }) }, '提交回忆')
    },
  }),
}))
vi.mock('../../src/components/vocabulary-learning/ProductionStage.vue', () => ({
  // eslint-disable-next-line vue/one-component-per-file -- Route-level integration stub.
  default: defineComponent({
    props: { tasks: { required: true, type: Array } },
    emits: ['answer-saved', 'production-recorded'],
    setup(props, { emit }) {
      const task = computed(() => (props.tasks as ProductionTask[])[0]!)
      const answer = computed(() => ({
        taskId: task.value.id,
        text: 'A complete learner response.',
        selfAssessment: { meaning: true, collocation: true, grammar: true, register: true, relevance: true },
        updatedAt: '2026-08-03T00:00:00.000Z',
      }))
      return () => h('div', [
        ...(props.tasks as ProductionTask[]).map(task => h('p', task.prompt)),
        h('button', { 'data-action': 'save-production', 'onClick': () => emit('answer-saved', answer.value) }, '保存回答'),
        h('button', { 'data-action': 'record-production', 'onClick': () => emit('production-recorded', { taskId: task.value.id, entryIds: task.value.requiredEntryIds }) }, '提交主动运用'),
      ])
    },
  }),
}))

function content(): TopicContent {
  const task = {
    id: 'lesson-one-production',
    mode: 'sentence' as const,
    prompt: 'Use the required word.',
    requiredEntryIds: [orbitId, galaxyId],
    referenceAnswer: 'A reference answer.',
    rubric: ['meaning', 'collocation', 'grammar', 'register', 'relevance'],
  }
  return {
    schemaVersion: 1,
    topicId: '04_太空探索',
    slug: 'space-exploration',
    title: '太空探索',
    level: 'B2-C1',
    wordCards: {} as TopicContent['wordCards'],
    lessons: [
      {
        id: 'lesson-one',
        title: '第一课',
        warmupPrompt: 'What can you already say?',
        targetEntryIds: [orbitId, galaxyId],
        passage: [],
        translation: [],
        recallExercises: [{ id: 'lesson-one-recall', entryId: orbitId, before: '', after: '', acceptedAnswers: ['orbit'], meaningCue: '轨道' }],
        productionTasks: [task],
      },
      {
        id: 'lesson-two',
        title: '第二课',
        warmupPrompt: 'What remains?',
        targetEntryIds: [signalId, probeId],
        passage: [],
        translation: [],
        recallExercises: [{ id: 'lesson-two-recall', entryId: signalId, before: '', after: '', acceptedAnswers: ['signal'], meaningCue: '信号' }],
        productionTasks: [{ ...task, id: 'lesson-two-production', requiredEntryIds: [signalId, probeId] }],
      },
    ],
    finalSpeaking: { ...task, id: 'final-speaking', mode: 'speaking', prompt: 'IELTS Speaking challenge' },
    finalWriting: { ...task, id: 'final-writing', mode: 'writing', prompt: 'IELTS Task 2 paragraph challenge' },
  }
}

function mountPage() {
  return mount(TopicPage, { global: { components: { RouterLink: { template: '<a><slot /></a>' } } } })
}

async function showStage(wrapper: ReturnType<typeof mount>, stage: string) {
  await wrapper.get(`[data-stage="${stage}"]`).trigger('click')
}

describe('active vocabulary topic page', () => {
  beforeEach(() => {
    route.params.topic = 'space-exploration'
    topics.clear()
    topics.set('space-exploration', { sourceTopicId: '04_太空探索', slug: 'space-exploration', title: '太空探索', available: true, load: async () => ({ default: content() }) })
    learningState.value = { schemaVersion: 1, words: {}, answers: {}, completedLessons: [] }
    progressFacade.persistenceError.value = null
    progressFacade.completeLesson.mockClear()
    progressFacade.recordWordExposure.mockClear()
    progressFacade.recordWordProduction.mockClear()
    progressFacade.recordWordReview.mockClear()
    progressFacade.saveAnswer.mockClear()
  })

  afterEach(() => topics.clear())

  it('renders the five stages in learning order, records input and recall once, and requires submitted recall plus production before completing a lesson', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.findAll('[data-stage]').map(item => item.text().trim())).toEqual(['预热', '语境输入', '主动回忆', '主动使用', '延迟复习'])
    expect(wrapper.text()).toContain('What can you already say?')

    await showStage(wrapper, 'input')
    await wrapper.get('[data-action="expose"]').trigger('click')
    await wrapper.get('[data-action="expose"]').trigger('click')
    expect(progressFacade.recordWordExposure).toHaveBeenCalledTimes(2)
    expect(progressFacade.recordWordExposure).toHaveBeenNthCalledWith(1, orbitId)
    expect(progressFacade.recordWordExposure).toHaveBeenNthCalledWith(2, galaxyId)

    await showStage(wrapper, 'recall')
    await wrapper.get('[data-action="recall"]').trigger('click')
    await wrapper.get('[data-action="recall"]').trigger('click')
    expect(progressFacade.recordWordReview).toHaveBeenCalledTimes(1)
    expect(progressFacade.recordWordReview).toHaveBeenCalledWith(orbitId, 'unaided')
    expect(progressFacade.completeLesson).not.toHaveBeenCalled()

    await showStage(wrapper, 'production')
    await wrapper.get('[data-action="save-production"]').trigger('click')
    await wrapper.get('[data-action="record-production"]').trigger('click')
    await wrapper.get('[data-action="record-production"]').trigger('click')
    expect(progressFacade.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'lesson-one-production' }))
    expect(progressFacade.recordWordProduction).toHaveBeenCalledTimes(2)
    expect(progressFacade.recordWordProduction).toHaveBeenCalledWith(orbitId)
    expect(progressFacade.recordWordProduction).toHaveBeenCalledWith(galaxyId)
    expect(progressFacade.completeLesson).toHaveBeenCalledWith('lesson-one')
  })

  it('retains saved progress across lesson navigation, derives completion after reload, exposes all mastery totals and unlocks final tasks only when every lesson is complete', async () => {
    learningState.value = {
      schemaVersion: 1,
      words: {
        [orbitId]: { state: 'understood', intervalIndex: 0, nextReviewOn: null, unaidedRecallDates: [], productionDates: [], lastOutcome: 'prompted' },
        [galaxyId]: { state: 'recallable', intervalIndex: 0, nextReviewOn: '2026-08-03', unaidedRecallDates: ['2026-08-02'], productionDates: [], lastOutcome: 'unaided' },
        [signalId]: { state: 'active', intervalIndex: 1, nextReviewOn: '2026-08-06', unaidedRecallDates: ['2026-08-01', '2026-08-02'], productionDates: ['2026-08-02'], lastOutcome: 'unaided' },
      },
      answers: {
        'lesson-one-production': { taskId: 'lesson-one-production', text: 'Saved lesson answer.', selfAssessment: { meaning: true, collocation: true, grammar: true, register: true, relevance: true }, updatedAt: '2026-08-03T00:00:00.000Z' },
      },
      completedLessons: ['lesson-one'],
    }
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.get('[data-topic-stats]').text()).toMatch(/未接触\s*1/)
    expect(wrapper.get('[data-topic-stats]').text()).toMatch(/已理解\s*1/)
    expect(wrapper.get('[data-topic-stats]').text()).toMatch(/可回忆\s*1/)
    expect(wrapper.get('[data-topic-stats]').text()).toMatch(/可主动使用\s*1/)
    expect(wrapper.get('[data-topic-stats]').text()).toMatch(/今日待复习\s*1/)
    expect(wrapper.text()).toContain('完成 1 / 2 课')
    expect(wrapper.text()).toContain('完成所有课程后解锁')

    await wrapper.get('[data-action="next-lesson"]').trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('第二课')
    await wrapper.get('[data-action="previous-lesson"]').trigger('click')
    expect(wrapper.text()).toContain('第一课')
    expect(wrapper.text()).toContain('完成 1 / 2 课')

    learningState.value = { ...learningState.value, completedLessons: ['lesson-one', 'lesson-two'] }
    await nextTick()
    expect(wrapper.text()).toContain('IELTS Speaking')
    expect(wrapper.text()).toContain('IELTS Task 2')
  })

  it('keeps local persistence failures visible without hiding loaded content', async () => {
    progressFacade.persistenceError.value = 'Learning progress storage is unavailable'
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('太空探索')
    expect(wrapper.get('[role="alert"]').text()).toContain('Learning progress storage is unavailable')
  })
})
