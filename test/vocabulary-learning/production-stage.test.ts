import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ProductionStage from '../../src/components/vocabulary-learning/ProductionStage.vue'
import type { EntryId, ProductionTask, SavedAnswer } from '../../src/features/vocabulary-learning/types'

const galaxyId = '04-space-exploration:galaxy' as EntryId
const launchId = '04-space-exploration:launch' as EntryId
const rubric = ['meaning', 'collocation', 'grammar', 'register', 'relevance']

function task(mode: ProductionTask['mode'], id = `${mode}-task`): ProductionTask {
  return {
    id,
    mode,
    prompt: `Complete this ${mode} response.`,
    requiredEntryIds: [galaxyId, launchId],
    referenceAnswer: `A model ${mode} response uses galaxy and launch naturally.`,
    rubric,
  }
}

const tasks = [
  task('collocation'),
  task('rewrite'),
  task('sentence'),
  task('speaking'),
  task('writing'),
]

function mountProduction(answers: Record<string, SavedAnswer> = {}) {
  return mount(ProductionStage, {
    props: {
      tasks,
      answers,
      requiredWords: { [galaxyId]: 'galaxy', [launchId]: 'launch' },
      now: () => new Date('2026-08-03T01:30:00.000Z'),
    },
  })
}

describe('constrained production stage', () => {
  it('renders every mode through one answer model, shows required words, and gives speaking a notes/timer prompt without microphone UI', async () => {
    const wrapper = mountProduction()

    for (const mode of tasks.map(item => item.mode)) {
      expect(wrapper.attributes('data-mode')).toBe(mode)
      expect(wrapper.text()).toContain('必须使用：galaxy、launch')
      expect(wrapper.get('textarea').attributes('aria-label')).toContain('回答')
      if (mode === 'speaking') {
        expect(wrapper.text()).toContain('口语笔记')
        expect(wrapper.text()).toContain('建议限时 2 分钟')
        expect(wrapper.html()).not.toContain('microphone')
        expect(wrapper.html()).not.toContain('getUserMedia')
      }
      if (mode !== 'writing')
        await wrapper.get('[data-action="next"]').trigger('click')
    }
  })

  it('emits a persistable saved answer and keeps the reference folded until a non-empty attempt is saved', async () => {
    const wrapper = mountProduction()

    expect(wrapper.text()).not.toContain('参考答案')
    await wrapper.get('textarea').setValue('   ')
    await wrapper.get('[data-action="save-answer"]').trigger('click')
    expect(wrapper.emitted('answer-saved')).toBeUndefined()
    expect(wrapper.text()).not.toContain('参考答案')

    await wrapper.get('textarea').setValue('A galaxy launch could inspire students.')
    await wrapper.get('[data-action="save-answer"]').trigger('click')
    expect(wrapper.emitted('answer-saved')).toEqual([[
      {
        taskId: 'collocation-task',
        text: 'A galaxy launch could inspire students.',
        selfAssessment: {},
        updatedAt: '2026-08-03T01:30:00.000Z',
      },
    ]])
    expect(wrapper.text()).toContain('参考答案')
    expect(wrapper.text()).not.toContain(tasks[0].referenceAnswer)
    await wrapper.get('[data-action="toggle-reference"]').trigger('click')
    expect(wrapper.text()).toContain(tasks[0].referenceAnswer)
  })

  it('uses exactly the five self-assessment dimensions and records required entry IDs once only after a saved non-empty answer and every check', async () => {
    const wrapper = mountProduction()
    const labels = wrapper.findAll('[data-rubric]').map(item => item.text().trim())

    expect(labels).toEqual(['meaning', 'collocation', 'grammar', 'register', 'relevance'])
    for (const input of wrapper.findAll('[data-rubric] input'))
      await input.setValue(true)
    expect(wrapper.emitted('production-recorded')).toBeUndefined()

    await wrapper.get('textarea').setValue('I would describe a galaxy launch carefully.')
    await wrapper.get('[data-action="save-answer"]').trigger('click')
    expect(wrapper.emitted('production-recorded')).toEqual([[
      { taskId: 'collocation-task', entryIds: [galaxyId, launchId] },
    ]])

    await wrapper.get('[data-rubric] input').setValue(false)
    await wrapper.get('[data-rubric] input').setValue(true)
    await wrapper.get('[data-action="save-answer"]').trigger('click')
    expect(wrapper.emitted('production-recorded')).toHaveLength(1)
  })

  it('does not allow authored task data to add or remove the five fixed self-assessment dimensions', () => {
    const wrapper = mount(ProductionStage, {
      props: {
        tasks: [{ ...task('sentence'), rubric: ['meaning', 'grammar', 'extra'] }],
        answers: {},
      },
    })

    expect(wrapper.findAll('[data-rubric]').map(item => item.text().trim())).toEqual(rubric)
  })

  it('hydrates saved answers when revisiting a task and never renders an automatic correctness or score claim', async () => {
    const answers: Record<string, SavedAnswer> = {
      'rewrite-task': {
        taskId: 'rewrite-task',
        text: 'My saved rewrite uses galaxy and launch.',
        selfAssessment: Object.fromEntries(rubric.map(item => [item, true])),
        updatedAt: '2026-08-03T01:30:00.000Z',
      },
    }
    const wrapper = mountProduction(answers)

    await wrapper.get('[data-action="next"]').trigger('click')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('My saved rewrite uses galaxy and launch.')
    expect(wrapper.findAll('[data-rubric] input').every(input => (input.element as HTMLInputElement).checked)).toBe(true)
    expect(wrapper.text()).not.toMatch(/正确|得分|score|correct/i)
  })

  it('hydrates a late external answer into an unchanged current draft, including its rubric and folded reference', async () => {
    const wrapper = mountProduction()
    const answer: SavedAnswer = {
      taskId: 'collocation-task',
      text: 'A newly saved galaxy launch answer.',
      selfAssessment: Object.fromEntries(rubric.map(item => [item, true])),
      updatedAt: '2026-08-03T01:30:00.000Z',
    }

    await wrapper.setProps({ answers: { [answer.taskId]: answer } })

    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe(answer.text)
    expect(wrapper.findAll('[data-rubric] input').every(input => (input.element as HTMLInputElement).checked)).toBe(true)
    expect(wrapper.text()).toContain('参考答案')
    expect(wrapper.text()).not.toContain(tasks[0].referenceAnswer)
  })

  it('hydrates an externally saved later task when it is opened, while preserving an unsaved conflicting local draft and its rubric', async () => {
    const wrapper = mountProduction()
    await wrapper.get('textarea').setValue('My local galaxy draft.')
    await wrapper.get('[data-rubric] input').setValue(true)
    const remoteCurrent: SavedAnswer = {
      taskId: 'collocation-task',
      text: 'A remote galaxy answer.',
      selfAssessment: Object.fromEntries(rubric.map(item => [item, false])),
      updatedAt: '2026-08-03T01:30:00.000Z',
    }
    const remoteLater: SavedAnswer = {
      taskId: 'rewrite-task',
      text: 'A remote rewrite using galaxy and launch.',
      selfAssessment: Object.fromEntries(rubric.map(item => [item, true])),
      updatedAt: '2026-08-03T01:30:00.000Z',
    }

    await wrapper.setProps({ answers: { [remoteCurrent.taskId]: remoteCurrent, [remoteLater.taskId]: remoteLater } })
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('My local galaxy draft.')
    expect((wrapper.get('[data-rubric] input').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.text()).toContain('参考答案')

    await wrapper.get('[data-action="next"]').trigger('click')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe(remoteLater.text)
    expect(wrapper.findAll('[data-rubric] input').every(input => (input.element as HTMLInputElement).checked)).toBe(true)
  })

  it('isolates drafts, rubric state, and reference visibility across task navigation', async () => {
    const wrapper = mountProduction()
    await wrapper.get('textarea').setValue('A local galaxy answer.')
    await wrapper.get('[data-action="save-answer"]').trigger('click')
    await wrapper.get('[data-action="toggle-reference"]').trigger('click')
    await wrapper.get('[data-rubric] input').setValue(true)
    await wrapper.get('[data-action="next"]').trigger('click')

    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('')
    expect((wrapper.get('[data-rubric] input').element as HTMLInputElement).checked).toBe(false)
    expect(wrapper.text()).not.toContain('参考答案')

    await wrapper.get('textarea').setValue('A local rewrite answer.')
    await wrapper.get('[data-action="previous"]').trigger('click')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('A local galaxy answer.')
    expect((wrapper.get('[data-rubric] input').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.text()).toContain(tasks[0].referenceAnswer)

    await wrapper.get('[data-action="next"]').trigger('click')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('A local rewrite answer.')
  })

  it('records production at most once despite repeated saves and check updates', async () => {
    const wrapper = mountProduction()
    await wrapper.get('textarea').setValue('I would describe a galaxy launch carefully.')
    for (const input of wrapper.findAll('[data-rubric] input'))
      await input.setValue(true)

    await wrapper.get('[data-action="save-answer"]').trigger('click')
    await wrapper.get('[data-action="save-answer"]').trigger('click')
    await wrapper.get('[data-rubric] input').setValue(false)
    await wrapper.get('[data-rubric] input').setValue(true)
    await wrapper.get('[data-action="save-answer"]').trigger('click')

    expect(wrapper.emitted('production-recorded')).toEqual([[
      { taskId: 'collocation-task', entryIds: [galaxyId, launchId] },
    ]])
  })
})
