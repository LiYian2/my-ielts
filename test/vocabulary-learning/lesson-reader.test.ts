import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import LessonReader from '../../src/components/vocabulary-learning/LessonReader.vue'
import type { CanonicalTopic, EntryId, Lesson, WordCard } from '../../src/features/vocabulary-learning/types'

const galaxyId = '04-space-exploration:galaxy' as EntryId
const cosmosId = '04-space-exploration:cosmos' as EntryId

const topic: CanonicalTopic = {
  id: '04-space-exploration',
  label: '04_太空探索',
  chapterAudioPath: '/vocabulary/audio/04_太空探索.mp3',
  entries: [
    {
      id: galaxyId,
      sourceId: 1,
      topicId: '04-space-exploration',
      headwords: ['galaxy'],
      primaryHeadword: 'galaxy',
      pos: 'n.',
      meaning: '星系',
      example: 'A galaxy contains stars.',
      extra: '-',
      audioPath: '/vocabulary/audio/04_太空探索/galaxy.mp3',
    },
    {
      id: cosmosId,
      sourceId: 2,
      topicId: '04-space-exploration',
      headwords: ['cosmos'],
      primaryHeadword: 'cosmos',
      pos: 'n.',
      meaning: '宇宙',
      example: 'The cosmos is vast.',
      extra: '-',
      audioPath: '/vocabulary/audio/04_太空探索/cosmos.mp3',
    },
  ],
}

const lesson: Lesson = {
  id: 'reading-space',
  title: 'Reading space',
  warmupPrompt: 'What interests you about space?',
  targetEntryIds: [galaxyId, cosmosId, galaxyId],
  passage: [
    { segments: [{ text: 'The ' }, { text: 'galaxy', entryId: galaxyId }, { text: ' is vast.\n' }] },
    { segments: [{ text: 'Our ' }, { text: 'cosmos', entryId: cosmosId }, { text: ' changes.' }] },
  ],
  translation: ['这个星系很广阔。', '我们的宇宙在变化。'],
  recallExercises: [],
  productionTasks: [],
}

const wordCards: Record<EntryId, WordCard> = {
  [galaxyId]: {
    entryId: galaxyId,
    priority: 'high',
    ipa: '/ˈɡæləksi/',
    meaning: '星系',
    collocations: ['a distant galaxy', 'the Milky Way galaxy'],
    example: { text: 'I would like to visit another galaxy.', use: 'speaking' },
    passageSentence: 'The galaxy is vast.',
    outputPrompt: 'Describe a galaxy you would like to explore.',
    wordFamily: ['galactic'],
    synonyms: [{ word: 'star system', distinction: 'a system of stars, not a whole galaxy' }],
    usageNotes: ['Use it for a system containing many stars.'],
  },
  [cosmosId]: {
    entryId: cosmosId,
    priority: 'standard',
    ipa: '/ˈkɒzmɒs/',
    meaning: '宇宙',
    collocations: ['the known cosmos', 'the wider cosmos'],
    example: { text: 'The cosmos remains mysterious.', use: 'writing' },
    passageSentence: 'Our cosmos changes.',
    outputPrompt: 'Write one sentence about the cosmos.',
  },
}

class FakeAudio {
  src = ''
  currentTime = 0
  pauseCalls = 0
  playCalls = 0
  shouldRejectPlay = false
  nextPlay: Promise<void> | null = null
  private readonly listeners = new Map<string, Set<EventListener>>()

  play(): Promise<void> {
    this.playCalls += 1
    return this.nextPlay ?? (this.shouldRejectPlay ? Promise.reject(new Error('unavailable')) : Promise.resolve())
  }

  pause(): void {
    this.pauseCalls += 1
  }

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener)
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? [])
      listener(new Event(type))
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0
  }
}

function deferred() {
  let rejectDeferred: (reason?: unknown) => void = () => {}
  const promise = new Promise<void>((_resolve, reject) => {
    rejectDeferred = reject
  })
  return { promise, reject: rejectDeferred }
}

function mountReader(audio = new FakeAudio()) {
  return {
    audio,
    wrapper: mount(LessonReader, {
      props: {
        lesson,
        topic,
        wordCards,
        audioFactory: () => audio,
      },
    }),
  }
}

describe('contextual lesson reader', () => {
  it('preserves passage segment order and whitespace without recording exposure on mount', () => {
    const { wrapper } = mountReader()

    expect(wrapper.get('[data-passage]').text()).toBe('The galaxy is vast.\nOur cosmos changes.')
    expect(wrapper.findAll('[data-entry-id]').map(button => button.text())).toEqual(['galaxy', 'cosmos'])
    expect(wrapper.findAll('[data-entry-id]').map(button => button.attributes('type'))).toEqual(['button', 'button'])
    expect(wrapper.emitted('exposed')).toBeUndefined()
  })

  it('emits unique target exposure only once after explicit input completion', async () => {
    const { wrapper } = mountReader()
    const completeButton = wrapper.get('button[aria-label="完成语境输入"]')

    expect(completeButton.text()).toBe('完成语境输入')
    await completeButton.trigger('click')
    await completeButton.trigger('click')

    expect(wrapper.emitted('exposed')).toEqual([[[galaxyId, cosmosId]]])
  })

  it('allows explicit input completion again when the lesson changes', async () => {
    const { wrapper } = mountReader()

    await wrapper.get('button[aria-label="完成语境输入"]').trigger('click')
    await wrapper.setProps({
      lesson: {
        ...lesson,
        id: 'reading-space-2',
        targetEntryIds: [cosmosId, cosmosId],
      },
    })
    expect(wrapper.emitted('exposed')).toEqual([[[galaxyId, cosmosId]]])

    const completeButton = wrapper.get('button[aria-label="完成语境输入"]')
    expect(completeButton.attributes('disabled')).toBeUndefined()
    await completeButton.trigger('click')
    expect(wrapper.emitted('exposed')).toEqual([[[galaxyId, cosmosId]], [[cosmosId]]])
  })

  it('opens a fully resolved selected card without revealing the translation by default', async () => {
    const { wrapper } = mountReader()

    expect(wrapper.text()).not.toContain('这个星系很广阔。')
    await wrapper.get(`[data-entry-id="${galaxyId}"]`).trigger('click')

    expect(wrapper.emitted('open-card')).toEqual([[galaxyId]])
    expect(wrapper.text()).toContain('/ˈɡæləksi/')
    expect(wrapper.text()).toContain('星系')
    expect(wrapper.text()).toContain('a distant galaxy')
    expect(wrapper.text()).toContain('适合口语')
    expect(wrapper.text()).toContain('The galaxy is vast.')
    expect(wrapper.text()).toContain('Describe a galaxy you would like to explore.')
    expect(wrapper.text()).toContain('词族')
    expect(wrapper.text()).toContain('近义词')
    expect(wrapper.text()).toContain('用法提示')
    await wrapper.findAll('button').find(button => button.text() === '显示中文翻译')!.trigger('click')
    expect(wrapper.text()).toContain('这个星系很广阔。')
  })

  it('renders absent optional card fields nowhere', async () => {
    const { wrapper } = mountReader()

    await wrapper.get(`[data-entry-id="${cosmosId}"]`).trigger('click')

    expect(wrapper.text()).not.toContain('词族')
    expect(wrapper.text()).not.toContain('近义词')
    expect(wrapper.text()).not.toContain('用法提示')
    expect(wrapper.text()).toContain('适合写作')
  })

  it('reuses audio at the canonical path, stops it before each new request, and disables the affected speaker after an audio error', async () => {
    const { audio, wrapper } = mountReader()

    await wrapper.get(`[data-entry-id="${galaxyId}"]`).trigger('click')
    await wrapper.get('[data-action="play-audio"]').trigger('click')
    expect(audio.src).toBe('/vocabulary/audio/04_太空探索/galaxy.mp3')
    expect(audio.playCalls).toBe(1)

    await wrapper.get(`[data-entry-id="${cosmosId}"]`).trigger('click')
    await wrapper.get('[data-action="play-audio"]').trigger('click')
    expect(audio.pauseCalls).toBeGreaterThanOrEqual(2)
    expect(audio.currentTime).toBe(0)
    expect(audio.src).toBe('/vocabulary/audio/04_太空探索/cosmos.mp3')

    audio.emit('error')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-action="play-audio"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('音频不可用')

    wrapper.unmount()
    expect(audio.pauseCalls).toBeGreaterThanOrEqual(3)
    expect(audio.currentTime).toBe(0)
  })

  it('handles a rejected audio play promise without throwing', async () => {
    const audio = new FakeAudio()
    audio.shouldRejectPlay = true
    const { wrapper } = mountReader(audio)

    await wrapper.get(`[data-entry-id="${galaxyId}"]`).trigger('click')
    await wrapper.get('[data-action="play-audio"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-action="play-audio"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('音频不可用')
  })

  it('ignores an older deferred rejection after a newer word starts playing', async () => {
    const audio = new FakeAudio()
    const firstPlay = deferred()
    audio.nextPlay = firstPlay.promise
    const { wrapper } = mountReader(audio)

    await wrapper.get(`[data-entry-id="${galaxyId}"]`).trigger('click')
    await wrapper.get('[data-action="play-audio"]').trigger('click')
    audio.nextPlay = null
    await wrapper.get(`[data-entry-id="${cosmosId}"]`).trigger('click')
    await wrapper.get('[data-action="play-audio"]').trigger('click')
    firstPlay.reject(new Error('late failure'))
    await flushPromises()

    expect(wrapper.get('[data-action="play-audio"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).not.toContain('音频不可用')
    await wrapper.get(`[data-entry-id="${galaxyId}"]`).trigger('click')
    expect(wrapper.get('[data-action="play-audio"]').attributes('disabled')).toBeUndefined()
  })

  it('ignores a deferred rejection after unmounting the panel', async () => {
    const audio = new FakeAudio()
    const pendingPlay = deferred()
    audio.nextPlay = pendingPlay.promise
    const { wrapper } = mountReader(audio)

    await wrapper.get(`[data-entry-id="${galaxyId}"]`).trigger('click')
    await wrapper.get('[data-action="play-audio"]').trigger('click')
    wrapper.unmount()
    pendingPlay.reject(new Error('late failure'))
    await flushPromises()

    expect(audio.listenerCount('error')).toBe(0)
  })

  it('creates one audio player for the card lifecycle and removes its listener on unmount', async () => {
    const audio = new FakeAudio()
    const audioFactory = vi.fn(() => audio)
    const wrapper = mount(LessonReader, { props: { lesson, topic, wordCards, audioFactory } })

    await wrapper.get(`[data-entry-id="${galaxyId}"]`).trigger('click')
    await wrapper.get('[data-action="play-audio"]').trigger('click')
    await wrapper.get(`[data-entry-id="${cosmosId}"]`).trigger('click')
    await wrapper.get('[data-action="play-audio"]').trigger('click')

    expect(audioFactory).toHaveBeenCalledTimes(1)
    expect(audio.listenerCount('error')).toBe(1)
    wrapper.unmount()
    expect(audio.listenerCount('error')).toBe(0)
  })
})
