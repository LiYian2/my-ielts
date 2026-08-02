import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RecallStage from '../../src/components/vocabulary-learning/RecallStage.vue'
import type { EntryId, RecallExercise } from '../../src/features/vocabulary-learning/types'

const galaxyId = '04-space-exploration:galaxy' as EntryId
const stationId = '04-space-exploration:station' as EntryId

const exercises: RecallExercise[] = [
  {
    id: 'galaxy-cloze',
    entryId: galaxyId,
    before: 'A distant ',
    after: ' can contain billions of stars.',
    acceptedAnswers: ['galaxy'],
    meaningCue: '星系',
  },
  {
    id: 'station-cloze',
    entryId: stationId,
    before: 'Astronauts live on a space ',
    after: ' for several months.',
    acceptedAnswers: ['space station', 'orbital station'],
    meaningCue: '空间站',
  },
]

function mountRecall() {
  return mount(RecallStage, { props: { exercises } })
}

describe('progressive recall stage', () => {
  it('records an exact first no-hint answer as unaided after case, Unicode-space, and edge-space normalisation', async () => {
    const wrapper = mountRecall()

    await wrapper.get('input').setValue('  GALAXY\u00A0')
    await wrapper.get('[data-action="submit-answer"]').trigger('click')

    expect(wrapper.emitted('reviewed')).toEqual([[{ entryId: galaxyId, outcome: 'unaided' }]])
  })

  it('reveals the first letter before the meaning cue and keeps accepted answers out of the DOM until explicit answer reveal', async () => {
    const wrapper = mountRecall()

    expect(wrapper.html()).not.toContain('galaxy')
    expect(wrapper.text()).not.toContain('星系')
    await wrapper.get('[data-action="hint"]').trigger('click')
    expect(wrapper.text().replace(/\s/g, '')).toContain('首字母：g')
    expect(wrapper.text()).not.toContain('星系')
    expect(wrapper.html()).not.toContain('galaxy')

    await wrapper.get('[data-action="hint"]').trigger('click')
    expect(wrapper.text()).toContain('词义提示：星系')
    expect(wrapper.html()).not.toContain('galaxy')

    await wrapper.get('[data-action="reveal-answer"]').trigger('click')
    expect(wrapper.text()).toContain('答案：galaxy')
  })

  it('records prompted only once for a correct answer after a hint, and records failed only when an incomplete exercise is revealed', async () => {
    const hinted = mountRecall()
    await hinted.get('[data-action="hint"]').trigger('click')
    await hinted.get('input').setValue('galaxy')
    await hinted.get('[data-action="submit-answer"]').trigger('click')
    await hinted.get('[data-action="reveal-answer"]').trigger('click')

    expect(hinted.emitted('reviewed')).toEqual([[{ entryId: galaxyId, outcome: 'prompted' }]])

    const incomplete = mountRecall()
    await incomplete.get('[data-action="reveal-answer"]').trigger('click')
    await incomplete.get('[data-action="reveal-answer"]').trigger('click')
    expect(incomplete.emitted('reviewed')).toEqual([[{ entryId: galaxyId, outcome: 'failed' }]])
  })

  it('keeps drafts isolated per exercise and preserves earlier emitted outcomes while advancing', async () => {
    const wrapper = mountRecall()

    await wrapper.get('input').setValue('galaxy')
    await wrapper.get('[data-action="submit-answer"]').trigger('click')
    await wrapper.get('[data-action="next"]').trigger('click')
    await wrapper.get('input').setValue('orbital station')
    await wrapper.get('[data-action="previous"]').trigger('click')

    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('galaxy')
    expect(wrapper.emitted('reviewed')).toEqual([[{ entryId: galaxyId, outcome: 'unaided' }]])
    await wrapper.get('[data-action="next"]').trigger('click')
    await wrapper.get('[data-action="submit-answer"]').trigger('click')
    expect(wrapper.emitted('reviewed')).toEqual([
      [{ entryId: galaxyId, outcome: 'unaided' }],
      [{ entryId: stationId, outcome: 'unaided' }],
    ])
  })

  it('accepts Unicode-whitespace multiword variants and emits once when Enter and repeated completion controls race', async () => {
    const wrapper = mountRecall()

    await wrapper.get('input').setValue('galaxy')
    await wrapper.get('input').trigger('keyup.enter')
    await wrapper.get('[data-action="submit-answer"]').trigger('click')
    await wrapper.get('[data-action="reveal-answer"]').trigger('click')
    expect(wrapper.emitted('reviewed')).toEqual([[{ entryId: galaxyId, outcome: 'unaided' }]])

    await wrapper.get('[data-action="next"]').trigger('click')
    await wrapper.get('input').setValue('\u2003SPACE\u202FSTATION\u00A0')
    await wrapper.get('[data-action="submit-answer"]').trigger('click')
    expect(wrapper.emitted('reviewed')).toEqual([
      [{ entryId: galaxyId, outcome: 'unaided' }],
      [{ entryId: stationId, outcome: 'unaided' }],
    ])
  })
})
