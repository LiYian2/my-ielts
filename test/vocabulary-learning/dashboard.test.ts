import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TopicDashboard from '../../src/components/vocabulary-learning/TopicDashboard.vue'
import ProgressBackup from '../../src/components/vocabulary-learning/ProgressBackup.vue'
import { findTopicBySlug, topicManifest } from '../../src/features/vocabulary-learning/content/manifest'
import type { TopicManifestEntry } from '../../src/features/vocabulary-learning/content/manifest'
import type { LearningStateV1 } from '../../src/features/vocabulary-learning/types'

const manifest: TopicManifestEntry[] = [
  {
    sourceTopicId: '04_太空探索',
    slug: 'space-exploration',
    title: '太空探索',
    available: true,
    load: async () => ({ default: {} as never }),
  },
  {
    sourceTopicId: '05_学校教育',
    slug: 'school-education',
    title: '学校教育',
    available: false,
  },
]

const progress: LearningStateV1 = {
  schemaVersion: 1,
  words: {
    '04-space-exploration:galaxy': {
      state: 'understood',
      intervalIndex: 0,
      nextReviewOn: null,
      unaidedRecallDates: [],
      productionDates: [],
      lastOutcome: null,
    },
    '04-space-exploration:cosmos': {
      state: 'recallable',
      intervalIndex: 0,
      nextReviewOn: '2026-08-03',
      unaidedRecallDates: ['2026-08-02'],
      productionDates: [],
      lastOutcome: 'unaided',
    },
    '04-space-exploration:universe': {
      state: 'active',
      intervalIndex: 1,
      nextReviewOn: '2026-08-06',
      unaidedRecallDates: ['2026-08-01', '2026-08-02'],
      productionDates: ['2026-08-02'],
      lastOutcome: 'unaided',
    },
    'obsolete-topic:deleted-word': {
      state: 'active',
      intervalIndex: 4,
      nextReviewOn: '2026-08-01',
      unaidedRecallDates: ['2026-07-01', '2026-08-01'],
      productionDates: ['2026-08-01'],
      lastOutcome: 'unaided',
    },
  },
  answers: {},
  completedLessons: [],
}

const RouterLinkStub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>',
}

describe('active vocabulary dashboard', () => {
  it('links available topics, keeps unavailable topics non-interactive, and renders exact progress totals', () => {
    const wrapper = mount(TopicDashboard, {
      props: { manifest, progress, now: new Date(2026, 7, 3) },
      global: { components: { RouterLink: RouterLinkStub } },
    })

    expect(wrapper.get('a[href="/vocabulary/learn/space-exploration"]').text()).toContain('太空探索')
    expect(wrapper.find('a[href="/vocabulary/learn/school-education"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('学校教育')
    expect(wrapper.text()).toContain('内容生成中')
    expect(wrapper.findAll('dl dt').map(item => item.text().trim())).toEqual([
      '未接触',
      '已理解',
      '可回忆',
      '可主动使用',
      '今日待复习',
    ])
    expect(wrapper.findAll('dl dd').map(item => item.text().trim())).toEqual(['72', '1', '1', '1', '1'])
  })

  it('emits export, imported JSON, and confirmed reset requests without owning storage', async () => {
    const wrapper = mount(ProgressBackup)

    await wrapper.get('[data-action="export"]').trigger('click')
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: { item: () => ({ text: async () => '{"schemaVersion":1}' }) } })
    await input.trigger('change')
    await flushPromises()
    await wrapper.get('[data-action="reset"]').trigger('click')
    await wrapper.get('[data-action="confirm-reset"]').trigger('click')

    expect(wrapper.emitted('export')).toHaveLength(1)
    expect(wrapper.emitted('import')?.[0]).toEqual(['{"schemaVersion":1}'])
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })

  it('declares all source topics and only advertises Space Exploration as loadable', () => {
    const availableTopics = topicManifest.filter(topic => topic.available)

    expect(topicManifest).toHaveLength(22)
    expect(availableTopics).toEqual([expect.objectContaining({
      sourceTopicId: '04_太空探索',
      slug: 'space-exploration',
      load: expect.any(Function),
    })])
    expect(findTopicBySlug('not-a-topic')).toBeUndefined()
  })

  it('adds the active-learning link without changing the legacy vocabulary implementation', async () => {
    const page = await import('../../src/pages/vocabulary/index.vue?raw')

    expect(page.default).toContain('主动学习')
    expect(page.default).toContain('to="/vocabulary/learn"')
    expect(page.default).toContain('练习模式')
  })
})
