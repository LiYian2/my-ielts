import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useRoute } from 'vue-router'
import TopicPage from '../../src/pages/vocabulary/learn/[topic].vue'
import type { TopicManifestEntry } from '../../src/features/vocabulary-learning/content/manifest'
import type { TopicContent } from '../../src/features/vocabulary-learning/types'

const route = vi.hoisted(() => ({ params: { topic: 'unknown-topic' } }))
const topics = vi.hoisted(() => new Map<string, TopicManifestEntry>())

vi.mock('vue-router', async () => {
  const { reactive } = await vi.importActual<typeof import('vue')>('vue')
  return { useRoute: () => reactive(route) }
})

vi.mock('../../src/features/vocabulary-learning/content/manifest', () => ({
  findTopicBySlug: (slug: string) => topics.get(slug),
}))

const testRoute = useRoute() as unknown as { params: { topic: string } }

const RouterLinkStub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>',
}

function topic(slug: string, overrides: Partial<TopicManifestEntry> = {}): TopicManifestEntry {
  return {
    sourceTopicId: '04_太空探索',
    slug,
    title: slug,
    available: true,
    ...overrides,
  }
}

function loadedContent(title: string): TopicContent {
  return { title } as TopicContent
}

function deferred<T>() {
  let resolveDeferred!: (value: T) => void
  let rejectDeferred!: (reason?: unknown) => void
  const promise = new Promise<T>((resolve, reject) => {
    resolveDeferred = resolve
    rejectDeferred = reject
  })
  return { promise, reject: rejectDeferred, resolve: resolveDeferred }
}

function mountTopicPage() {
  return mount(TopicPage, { global: { components: { RouterLink: RouterLinkStub } } })
}

async function visit(slug: string): Promise<void> {
  testRoute.params.topic = slug
  await nextTick()
  await flushPromises()
}

describe('active vocabulary topic route', () => {
  beforeEach(() => {
    topics.clear()
    testRoute.params.topic = 'unknown-topic'
  })

  afterEach(() => {
    topics.clear()
  })

  it('shows the safe in-progress state for an unknown slug', async () => {
    const wrapper = mountTopicPage()

    await flushPromises()

    expect(wrapper.text()).toContain('内容生成中')
    expect(wrapper.text()).toContain('该主题的主动学习内容正在生成中。')
  })

  it('shows the safe in-progress state for an unavailable slug', async () => {
    topics.set('school-education', topic('school-education', { available: false }))
    testRoute.params.topic = 'school-education'
    const wrapper = mountTopicPage()

    await flushPromises()

    expect(wrapper.text()).toContain('内容生成中')
    expect(wrapper.find('p.text-gray-600').text()).toContain('该主题的主动学习内容正在生成中。')
  })

  it('renders successfully loaded content', async () => {
    topics.set('space-exploration', topic('space-exploration', {
      load: async () => ({ default: loadedContent('Loaded Space') }),
    }))
    testRoute.params.topic = 'space-exploration'
    const wrapper = mountTopicPage()

    await flushPromises()

    expect(wrapper.text()).toContain('Loaded Space')
    expect(wrapper.text()).not.toContain('内容生成中')
  })

  it.each([
    ['missing loader', undefined],
    ['failed loader', async () => Promise.reject(new Error('content failed'))],
  ])('shows the safe state for %s', async (_caseName, load) => {
    topics.set('space-exploration', topic('space-exploration', { load }))
    testRoute.params.topic = 'space-exploration'
    const wrapper = mountTopicPage()

    await flushPromises()

    expect(wrapper.text()).toContain('内容生成中')
  })

  it('keeps the newer route loading when a stale loader settles first', async () => {
    const first = deferred<{ default: TopicContent }>()
    const second = deferred<{ default: TopicContent }>()
    topics.set('topic-a', topic('topic-a', { load: () => first.promise }))
    topics.set('topic-b', topic('topic-b', { load: () => second.promise }))
    testRoute.params.topic = 'topic-a'
    const wrapper = mountTopicPage()

    await visit('topic-b')
    first.resolve({ default: loadedContent('Stale A') })
    await flushPromises()

    expect(wrapper.text()).toContain('正在加载学习内容…')
    second.resolve({ default: loadedContent('Current B') })
    await flushPromises()

    expect(wrapper.text()).toContain('Current B')
    expect(wrapper.text()).not.toContain('Stale A')
  })

  it('keeps newer content when an older loader resolves after it', async () => {
    const first = deferred<{ default: TopicContent }>()
    const second = deferred<{ default: TopicContent }>()
    topics.set('topic-a', topic('topic-a', { load: () => first.promise }))
    topics.set('topic-b', topic('topic-b', { load: () => second.promise }))
    testRoute.params.topic = 'topic-a'
    const wrapper = mountTopicPage()

    await visit('topic-b')
    second.resolve({ default: loadedContent('Current B') })
    await flushPromises()
    first.resolve({ default: loadedContent('Stale A') })
    await flushPromises()

    expect(wrapper.text()).toContain('Current B')
    expect(wrapper.text()).not.toContain('Stale A')
  })

  it('keeps newer content when an older loader rejects after it', async () => {
    const first = deferred<{ default: TopicContent }>()
    const second = deferred<{ default: TopicContent }>()
    topics.set('topic-a', topic('topic-a', { load: () => first.promise }))
    topics.set('topic-b', topic('topic-b', { load: () => second.promise }))
    testRoute.params.topic = 'topic-a'
    const wrapper = mountTopicPage()

    await visit('topic-b')
    second.resolve({ default: loadedContent('Current B') })
    await flushPromises()
    first.reject(new Error('Stale A failed'))
    await flushPromises()

    expect(wrapper.text()).toContain('Current B')
    expect(wrapper.text()).not.toContain('内容生成中')
  })
})
