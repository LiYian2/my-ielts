import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DelayedReviewStage from '../../src/components/vocabulary-learning/DelayedReviewStage.vue'
import type { CanonicalEntry, DelayedReviewItem, EntryId, WordCard } from '../../src/features/vocabulary-learning/types'

const galaxyId = '04-space-exploration:galaxy' as EntryId

function item(mode: DelayedReviewItem['mode']): DelayedReviewItem {
  const entry: CanonicalEntry = {
    id: galaxyId,
    sourceId: 1,
    topicId: '04-space-exploration',
    headwords: ['galaxy'],
    primaryHeadword: 'galaxy',
    pos: 'n.',
    meaning: '星系',
    example: 'Our galaxy contains billions of stars.',
    extra: '',
    audioPath: '/vocabulary/audio/04_太空探索/galaxy.mp3',
  }
  const card: WordCard = {
    entryId: galaxyId,
    priority: 'high',
    ipa: '/ˈɡæləksi/',
    meaning: '星系',
    collocations: ['a distant galaxy', 'galaxy formation'],
    example: { text: 'Astronomers observed a distant galaxy.', use: 'both' },
    passageSentence: 'A distant galaxy may contain billions of stars.',
    outputPrompt: 'Explain why studying a galaxy matters.',
  }
  return { entry, card, mode }
}

describe('delayed review stage', () => {
  it('rotates four review forms without revealing references before the learner attempts an answer', async () => {
    const modes: DelayedReviewItem['mode'][] = ['meaning', 'cloze', 'collocation', 'production']

    for (const mode of modes) {
      const wrapper = mount(DelayedReviewStage, { props: { items: [item(mode)] } })
      expect(wrapper.get('[data-review-mode]').attributes('data-review-mode')).toBe(mode)
      if (mode === 'meaning')
        expect(wrapper.text()).toContain('词义“星系”')
      else
        expect(wrapper.text()).not.toContain('星系')
      expect(wrapper.text()).not.toContain('a distant galaxy')

      await wrapper.get('textarea').setValue('My unaided attempt')
      await wrapper.get('[data-action="reveal-reference"]').trigger('click')
      expect(wrapper.text()).toContain('星系')
      expect(wrapper.text()).toContain('a distant galaxy')
      expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('My unaided attempt')
    }
  })

  it('records exactly one self-assessed outcome only after an attempt and reference check', async () => {
    const wrapper = mount(DelayedReviewStage, { props: { items: [item('production')] } })

    expect(wrapper.find('[data-outcome="unaided"]').exists()).toBe(false)
    await wrapper.get('textarea').setValue('Studying a galaxy helps us test cosmological theories.')
    await wrapper.get('[data-action="reveal-reference"]').trigger('click')
    await wrapper.get('[data-outcome="unaided"]').trigger('click')
    await wrapper.get('[data-outcome="unaided"]').trigger('click')

    expect(wrapper.emitted('reviewed')).toEqual([[{ entryId: galaxyId, outcome: 'unaided' }]])
  })

  it('shows an empty queue state when no words are due', () => {
    const wrapper = mount(DelayedReviewStage, { props: { items: [] } })
    expect(wrapper.text()).toContain('今天没有到期词汇')
  })
})
