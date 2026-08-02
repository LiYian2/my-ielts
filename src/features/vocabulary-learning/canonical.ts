import vocabulary from '../../pages/vocabulary/vocabulary'
import type { CanonicalEntry, CanonicalTopic, EntryId } from './types'

interface SourceEntry {
  id: number
  word: string[]
  pos: string
  meaning: string
  example: string
  extra: string
}

interface SourceTopic {
  label: string
  audio: string
  words: SourceEntry[][]
}

const topicSlugs: Record<string, string> = {
  '01_自然地理': '01-physical-geography',
  '02_植物研究': '02-plant-research',
  '03_动物保护': '03-animal-conservation',
  '04_太空探索': '04-space-exploration',
  '05_学校教育': '05-school-education',
  '06_科技发明': '06-technology-invention',
  '07_文化历史': '07-culture-history',
  '08_语言演化': '08-language-evolution',
  '09_娱乐运动': '09-entertainment-sports',
  '10_物品材料': '10-objects-materials',
  '11_时尚潮流': '11-fashion-trends',
  '12_饮食健康': '12-diet-health',
  '13_建筑场所': '13-buildings-places',
  '14_交通旅行': '14-transport-travel',
  '15_国家政府': '15-national-government',
  '16_社会经济': '16-social-economy',
  '17_法律法规': '17-laws-regulations',
  '18_沙场争锋': '18-battlefield-conflict',
  '19_社会角色': '19-social-roles',
  '20_行为动作': '20-actions-behaviours',
  '21_身心健康': '21-physical-mental-health',
  '22_时间日期': '22-time-dates',
}

const sourceTopics = vocabulary as Record<string, SourceTopic>

function normaliseHeadword(headword: string) {
  return headword.split('/')[0].trim()
}

function toUrlSegment(headword: string) {
  return normaliseHeadword(headword)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getTopicSlug(topicId: string) {
  const topicSlug = topicSlugs[topicId]
  if (!topicSlug)
    throw new Error(`Unknown vocabulary topic: ${topicId}`)
  return topicSlug
}

function normaliseHeadwords(headwords: string[]) {
  return headwords
    .flatMap(headword => headword.split('/'))
    .map(headword => headword.trim())
    .filter(Boolean)
}

export function createEntryId(topicId: string, primaryHeadword: string): EntryId {
  return `${getTopicSlug(topicId)}:${toUrlSegment(primaryHeadword)}` as EntryId
}

export function getCanonicalTopic(topicId: string): CanonicalTopic {
  const sourceTopic = sourceTopics[topicId]
  if (!sourceTopic)
    throw new Error(`Unknown vocabulary topic: ${topicId}`)

  const id = getTopicSlug(topicId)
  const entryIds = new Set<EntryId>()
  const entries = sourceTopic.words.flat().map((sourceEntry): CanonicalEntry => {
    const headwords = normaliseHeadwords(sourceEntry.word)
    const primaryHeadword = headwords[0]
    if (!primaryHeadword)
      throw new Error(`Vocabulary entry ${sourceEntry.id} has no headword`)

    const entryId = createEntryId(topicId, primaryHeadword)
    if (entryIds.has(entryId))
      throw new Error(`Duplicate canonical vocabulary entry ID: ${entryId}`)
    entryIds.add(entryId)

    return {
      id: entryId,
      sourceId: sourceEntry.id,
      topicId: id,
      headwords,
      primaryHeadword,
      pos: sourceEntry.pos,
      meaning: sourceEntry.meaning,
      example: sourceEntry.example,
      extra: sourceEntry.extra,
      audioPath: `/vocabulary/audio/${topicId}/${primaryHeadword}.mp3`,
    }
  })

  return {
    id,
    label: sourceTopic.label,
    chapterAudioPath: `/vocabulary/audio/${sourceTopic.audio}`,
    entries,
  }
}

export function listCanonicalTopics(): CanonicalTopic[] {
  return Object.keys(sourceTopics).map(getCanonicalTopic)
}
