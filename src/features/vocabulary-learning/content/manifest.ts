import type { TopicContent } from '../types'

export interface TopicManifestEntry {
  sourceTopicId: string
  slug: string
  title: string
  available: boolean
  load?: () => Promise<{ default: TopicContent }>
}

const contentModules = import.meta.glob<{ default: TopicContent }>('./*.ts')

function loadSpaceExploration(): Promise<{ default: TopicContent }> {
  const loader = contentModules['./04-space-exploration.ts']
  if (!loader)
    throw new Error('Space Exploration learning content is not available yet')
  return loader()
}

export const topicManifest: TopicManifestEntry[] = [
  { sourceTopicId: '01_自然地理', slug: 'physical-geography', title: '自然地理', available: false },
  { sourceTopicId: '02_植物研究', slug: 'plant-research', title: '植物研究', available: false },
  { sourceTopicId: '03_动物保护', slug: 'animal-conservation', title: '动物保护', available: false },
  { sourceTopicId: '04_太空探索', slug: 'space-exploration', title: '太空探索', available: true, load: loadSpaceExploration },
  { sourceTopicId: '05_学校教育', slug: 'school-education', title: '学校教育', available: false },
  { sourceTopicId: '06_科技发明', slug: 'technology-invention', title: '科技发明', available: false },
  { sourceTopicId: '07_文化历史', slug: 'culture-history', title: '文化历史', available: false },
  { sourceTopicId: '08_语言演化', slug: 'language-evolution', title: '语言演化', available: false },
  { sourceTopicId: '09_娱乐运动', slug: 'entertainment-sports', title: '娱乐运动', available: false },
  { sourceTopicId: '10_物品材料', slug: 'objects-materials', title: '物品材料', available: false },
  { sourceTopicId: '11_时尚潮流', slug: 'fashion-trends', title: '时尚潮流', available: false },
  { sourceTopicId: '12_饮食健康', slug: 'diet-health', title: '饮食健康', available: false },
  { sourceTopicId: '13_建筑场所', slug: 'buildings-places', title: '建筑场所', available: false },
  { sourceTopicId: '14_交通旅行', slug: 'transport-travel', title: '交通旅行', available: false },
  { sourceTopicId: '15_国家政府', slug: 'national-government', title: '国家政府', available: false },
  { sourceTopicId: '16_社会经济', slug: 'social-economy', title: '社会经济', available: false },
  { sourceTopicId: '17_法律法规', slug: 'laws-regulations', title: '法律法规', available: false },
  { sourceTopicId: '18_沙场争锋', slug: 'battlefield-conflict', title: '沙场争锋', available: false },
  { sourceTopicId: '19_社会角色', slug: 'social-roles', title: '社会角色', available: false },
  { sourceTopicId: '20_行为动作', slug: 'actions-behaviours', title: '行为动作', available: false },
  { sourceTopicId: '21_身心健康', slug: 'physical-mental-health', title: '身心健康', available: false },
  { sourceTopicId: '22_时间日期', slug: 'time-dates', title: '时间日期', available: false },
]

export function findTopicBySlug(slug: string): TopicManifestEntry | undefined {
  return topicManifest.find(topic => topic.slug === slug)
}
