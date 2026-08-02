export type EntryId = `${string}:${string}`

export interface CanonicalEntry {
  id: EntryId
  sourceId: number
  topicId: string
  headwords: string[]
  primaryHeadword: string
  pos: string
  meaning: string
  example: string
  extra: string
  audioPath: string
}

export interface CanonicalTopic {
  id: string
  label: string
  chapterAudioPath: string
  entries: CanonicalEntry[]
}
