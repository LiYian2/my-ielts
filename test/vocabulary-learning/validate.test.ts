import { describe, expect, it } from 'vitest'
import { assertValidTopicContent, validateTopicContent } from '../../src/features/vocabulary-learning/validate'
import type { CanonicalTopic, EntryId, TopicContent, WordCard } from '../../src/features/vocabulary-learning/types'

const galaxy = '04-space-exploration:galaxy' as EntryId
const telescope = '04-space-exploration:telescope' as EntryId

const topic: CanonicalTopic = {
  id: '04-space-exploration',
  label: '太空探索',
  chapterAudioPath: '/vocabulary/audio/04_太空探索.mp3',
  entries: [
    {
      id: galaxy,
      sourceId: 1,
      topicId: '04-space-exploration',
      headwords: ['galaxy'],
      primaryHeadword: 'galaxy',
      pos: 'n.',
      meaning: '星系',
      example: 'Our galaxy contains billions of stars.',
      extra: '',
      audioPath: '/vocabulary/audio/04_太空探索/galaxy.mp3',
    },
    {
      id: telescope,
      sourceId: 2,
      topicId: '04-space-exploration',
      headwords: ['telescope'],
      primaryHeadword: 'telescope',
      pos: 'n.',
      meaning: '望远镜',
      example: 'The telescope recorded a distant signal.',
      extra: '',
      audioPath: '/vocabulary/audio/04_太空探索/telescope.mp3',
    },
  ],
}

function createCard(entryId: EntryId, passageSentence: string): WordCard {
  return {
    entryId,
    priority: 'standard',
    ipa: '/ˈɡæləksi/',
    meaning: entryId === galaxy ? '星系' : '望远镜',
    collocations: entryId === galaxy
      ? ['a distant galaxy', 'map a galaxy']
      : ['a powerful telescope', 'use a telescope'],
    example: { text: 'Scientists share their findings clearly.', use: 'both' },
    passageSentence,
    outputPrompt: 'Use this word in a response about space exploration.',
  }
}

function createContent(): TopicContent {
  const passageSentence = 'A galaxy is observed through a telescope.'

  return {
    schemaVersion: 1,
    topicId: topic.id,
    slug: topic.id,
    title: 'Space Exploration',
    level: 'B2-C1',
    lessons: [{
      id: 'observing-space',
      title: 'Observing space',
      warmupPrompt: 'What would you like to observe in space?',
      targetEntryIds: [galaxy, telescope],
      passage: [{
        segments: [
          { text: 'A ' },
          { text: 'galaxy', entryId: galaxy },
          { text: ' is observed through a ' },
          { text: 'telescope', entryId: telescope },
          { text: '.' },
        ],
      }],
      translation: ['通过望远镜可以观测到一个星系。'],
      recallExercises: [{
        id: 'recall-galaxy',
        entryId: galaxy,
        before: 'A ',
        after: ' is observed.',
        acceptedAnswers: ['galaxy'],
        meaningCue: '星系',
      }],
      productionTasks: [{
        id: 'describe-observation',
        mode: 'sentence',
        prompt: 'Describe an observation.',
        requiredEntryIds: [galaxy, telescope],
        referenceAnswer: 'A telescope can observe a distant galaxy.',
        rubric: ['meaning', 'collocation'],
      }],
    }],
    wordCards: {
      [galaxy]: createCard(galaxy, passageSentence),
      [telescope]: createCard(telescope, passageSentence),
    },
    finalSpeaking: {
      id: 'final-speaking',
      mode: 'speaking',
      prompt: 'Talk about a scientific discovery.',
      requiredEntryIds: [galaxy],
      referenceAnswer: 'I would talk about a galaxy observed through a telescope.',
      rubric: ['meaning'],
    },
    finalWriting: {
      id: 'final-writing',
      mode: 'writing',
      prompt: 'Write a paragraph about space research.',
      requiredEntryIds: [telescope],
      referenceAnswer: 'A telescope makes distant research possible.',
      rubric: ['meaning'],
    },
  }
}

describe('topic content validator', () => {
  it('accepts a complete topic fixture', () => {
    const content = createContent()

    expect(validateTopicContent(content, topic)).toEqual([])
    expect(() => assertValidTopicContent(content, topic)).not.toThrow()
  })

  it('reports missing canonical entry coverage', () => {
    const content = createContent()
    delete content.lessons[0].passage[0].segments[1].entryId

    expect(validateTopicContent(content, topic)).toEqual([
      {
        code: 'missing-passage-coverage',
        path: `wordCards.${galaxy}`,
        message: 'Canonical entry must have at least one annotated passage use',
      },
    ])
  })

  it('reports an unknown word card entry ID', () => {
    const content = createContent()
    const unknownEntryId = '04-space-exploration:nebula' as EntryId
    content.wordCards[unknownEntryId] = createCard(unknownEntryId, 'A nebula is visible.')

    expect(validateTopicContent(content, topic)).toEqual([
      {
        code: 'unknown-entry-id',
        path: `wordCards.${unknownEntryId}.entryId`,
        message: 'Entry ID is not part of the canonical topic',
      },
    ])
  })

  it('reports word cards with fewer than two collocations', () => {
    const content = createContent()
    content.wordCards[galaxy].collocations = ['a distant galaxy'] as unknown as [string, string, ...string[]]

    expect(validateTopicContent(content, topic)).toEqual([
      {
        code: 'invalid-collocation-count',
        path: `wordCards.${galaxy}.collocations`,
        message: 'Word cards must have between two and four collocations',
      },
    ])
  })

  it('reports word cards with more than four collocations', () => {
    const content = createContent()
    content.wordCards[galaxy].collocations = ['one', 'two', 'three', 'four', 'five']

    expect(validateTopicContent(content, topic)).toEqual([
      {
        code: 'invalid-collocation-count',
        path: `wordCards.${galaxy}.collocations`,
        message: 'Word cards must have between two and four collocations',
      },
    ])
  })

  it('reports canonical entries without word cards', () => {
    const content = createContent()
    delete content.wordCards[galaxy]

    expect(validateTopicContent(content, topic)).toEqual([
      {
        code: 'missing-word-card',
        path: `wordCards.${galaxy}`,
        message: 'Canonical entry must have a word card',
      },
    ])
  })

  it('reports duplicate lesson target IDs', () => {
    const content = createContent()
    content.lessons[0].targetEntryIds.push(galaxy)

    expect(validateTopicContent(content, topic)).toEqual([
      {
        code: 'duplicate-target-entry-id',
        path: 'lessons.0.targetEntryIds.2',
        message: 'Lesson target entry IDs must be unique',
      },
    ])
  })

  it('reports passage annotations that are not lesson targets', () => {
    const content = createContent()
    content.lessons[0].targetEntryIds = [galaxy]

    expect(validateTopicContent(content, topic)).toEqual([
      {
        code: 'undeclared-passage-entry-id',
        path: 'lessons.0.passage.0.segments.3.entryId',
        message: 'Passage annotation must be declared in the lesson target entry IDs',
      },
    ])
  })

  it('reports empty translations and required word-card text', () => {
    const content = createContent()
    content.lessons[0].translation[0] = ' '
    content.wordCards[galaxy].example.text = ''
    content.wordCards[galaxy].passageSentence = ' '
    content.wordCards[galaxy].outputPrompt = ''

    expect(validateTopicContent(content, topic)).toEqual([
      {
        code: 'empty-required-text',
        path: 'lessons.0.translation.0',
        message: 'Translation must not be empty',
      },
      {
        code: 'empty-required-text',
        path: `wordCards.${galaxy}.example.text`,
        message: 'Example text must not be empty',
      },
      {
        code: 'empty-required-text',
        path: `wordCards.${galaxy}.passageSentence`,
        message: 'Passage sentence must not be empty',
      },
      {
        code: 'empty-required-text',
        path: `wordCards.${galaxy}.outputPrompt`,
        message: 'Output prompt must not be empty',
      },
    ])
  })

  it('reports a passage sentence absent from the rendered lesson text', () => {
    const content = createContent()
    content.wordCards[galaxy].passageSentence = 'No galaxy is visible.'

    expect(validateTopicContent(content, topic)).toEqual([
      {
        code: 'passage-sentence-not-rendered',
        path: `wordCards.${galaxy}.passageSentence`,
        message: 'Passage sentence must appear in the rendered lesson text',
      },
    ])
  })

  it('reports high-priority entries without annotated uses in two lessons', () => {
    const content = createContent()
    content.wordCards[galaxy].priority = 'high'

    expect(validateTopicContent(content, topic)).toEqual([
      {
        code: 'insufficient-high-priority-coverage',
        path: `wordCards.${galaxy}.priority`,
        message: 'High-priority entries need annotated passage uses in at least two distinct lessons',
      },
    ])
  })
})
