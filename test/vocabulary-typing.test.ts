import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('vocabulary typing audio', () => {
  it('waits for an explicit learner action and handles blocked playback', async () => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })
    const { default: TypingPage } = await import('../src/pages/vocabulary/typing.vue')
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play')
      .mockRejectedValue(new DOMException('Playback blocked', 'NotAllowedError'))
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})

    const wrapper = mount(TypingPage)
    expect(play).not.toHaveBeenCalled()

    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(1)
    await buttons[0].trigger('click')
    await Promise.resolve()

    expect(play).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})
