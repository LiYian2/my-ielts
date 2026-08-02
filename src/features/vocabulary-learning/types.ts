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

export interface PassageSegment {
  text: string
  entryId?: EntryId
}

export interface PassageParagraph {
  segments: PassageSegment[]
}

export interface WordCard {
  entryId: EntryId
  priority: 'high' | 'standard'
  ipa: string
  meaning: string
  collocations: [string, string, ...string[]]
  example: { text: string; use: 'speaking' | 'writing' | 'both' }
  passageSentence: string
  outputPrompt: string
  wordFamily?: string[]
  synonyms?: Array<{ word: string; distinction: string }>
  usageNotes?: string[]
}

export interface RecallExercise {
  id: string
  entryId: EntryId
  before: string
  after: string
  acceptedAnswers: string[]
  meaningCue: string
}

export interface ProductionTask {
  id: string
  mode: 'collocation' | 'rewrite' | 'sentence' | 'speaking' | 'writing'
  prompt: string
  requiredEntryIds: EntryId[]
  referenceAnswer: string
  rubric: string[]
}

export interface Lesson {
  id: string
  title: string
  warmupPrompt: string
  targetEntryIds: EntryId[]
  passage: PassageParagraph[]
  translation: string[]
  recallExercises: RecallExercise[]
  productionTasks: ProductionTask[]
}

export interface TopicContent {
  schemaVersion: 1
  topicId: string
  slug: string
  title: string
  level: 'B2-C1'
  lessons: Lesson[]
  wordCards: Record<EntryId, WordCard>
  finalSpeaking: ProductionTask
  finalWriting: ProductionTask
}

export interface ValidationIssue {
  code: string
  path: string
  message: string
}
