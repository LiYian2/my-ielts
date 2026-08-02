import type { CanonicalTopic, EntryId, ProductionTask, TopicContent, ValidationIssue, WordCard } from './types'

function addIssue(issues: ValidationIssue[], code: string, path: string, message: string) {
  issues.push({ code, path, message })
}

function isEmpty(text: string) {
  return !text.trim()
}

function validateEntryId(
  entryId: EntryId,
  path: string,
  canonicalEntryIds: Set<EntryId>,
  issues: ValidationIssue[],
) {
  if (!canonicalEntryIds.has(entryId)) {
    addIssue(
      issues,
      'unknown-entry-id',
      path,
      'Entry ID is not part of the canonical topic',
    )
    return false
  }

  return true
}

function validateTaskEntryIds(
  task: ProductionTask,
  path: string,
  canonicalEntryIds: Set<EntryId>,
  issues: ValidationIssue[],
) {
  task.requiredEntryIds.forEach((entryId, index) => {
    validateEntryId(
      entryId,
      `${path}.requiredEntryIds.${index}`,
      canonicalEntryIds,
      issues,
    )
  })
}

function validateWordCard(
  card: WordCard,
  entryId: EntryId,
  renderedLessonText: string[],
  issues: ValidationIssue[],
) {
  const path = `wordCards.${entryId}`

  if (card.collocations.length < 2 || card.collocations.length > 4)
    addIssue(issues, 'invalid-collocation-count', `${path}.collocations`, 'Word cards must have between two and four collocations')

  if (isEmpty(card.example.text))
    addIssue(issues, 'empty-required-text', `${path}.example.text`, 'Example text must not be empty')

  if (isEmpty(card.passageSentence))
    addIssue(issues, 'empty-required-text', `${path}.passageSentence`, 'Passage sentence must not be empty')
  else if (!renderedLessonText.some(text => text.includes(card.passageSentence)))
    addIssue(issues, 'passage-sentence-not-rendered', `${path}.passageSentence`, 'Passage sentence must appear in the rendered lesson text')

  if (isEmpty(card.outputPrompt))
    addIssue(issues, 'empty-required-text', `${path}.outputPrompt`, 'Output prompt must not be empty')
}

export function validateTopicContent(content: TopicContent, topic: CanonicalTopic): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const canonicalEntryIds = new Set(topic.entries.map(entry => entry.id))
  const annotatedLessonIndexes = new Map<EntryId, Set<number>>()
  const renderedLessonText: string[] = []

  content.lessons.forEach((lesson, lessonIndex) => {
    const lessonPath = `lessons.${lessonIndex}`
    const targetEntryIds = new Set<EntryId>()

    lesson.targetEntryIds.forEach((entryId, targetIndex) => {
      const targetPath = `${lessonPath}.targetEntryIds.${targetIndex}`
      validateEntryId(entryId, targetPath, canonicalEntryIds, issues)

      if (targetEntryIds.has(entryId)) {
        addIssue(
          issues,
          'duplicate-target-entry-id',
          targetPath,
          'Lesson target entry IDs must be unique',
        )
      }
      targetEntryIds.add(entryId)
    })

    lesson.translation.forEach((translation, translationIndex) => {
      if (isEmpty(translation)) {
        addIssue(
          issues,
          'empty-required-text',
          `${lessonPath}.translation.${translationIndex}`,
          'Translation must not be empty',
        )
      }
    })

    lesson.recallExercises.forEach((exercise, exerciseIndex) => {
      validateEntryId(
        exercise.entryId,
        `${lessonPath}.recallExercises.${exerciseIndex}.entryId`,
        canonicalEntryIds,
        issues,
      )
    })

    lesson.productionTasks.forEach((task, taskIndex) => {
      validateTaskEntryIds(task, `${lessonPath}.productionTasks.${taskIndex}`, canonicalEntryIds, issues)
    })

    renderedLessonText.push(
      lesson.passage
        .map(paragraph => paragraph.segments.map(segment => segment.text).join(''))
        .join('\n'),
    )

    lesson.passage.forEach((paragraph, paragraphIndex) => {
      paragraph.segments.forEach((segment, segmentIndex) => {
        if (!segment.entryId)
          return

        const segmentPath = `${lessonPath}.passage.${paragraphIndex}.segments.${segmentIndex}.entryId`
        if (!validateEntryId(segment.entryId, segmentPath, canonicalEntryIds, issues))
          return

        if (!targetEntryIds.has(segment.entryId)) {
          addIssue(
            issues,
            'undeclared-passage-entry-id',
            segmentPath,
            'Passage annotation must be declared in the lesson target entry IDs',
          )
        }

        const lessonIndexes = annotatedLessonIndexes.get(segment.entryId) ?? new Set<number>()
        lessonIndexes.add(lessonIndex)
        annotatedLessonIndexes.set(segment.entryId, lessonIndexes)
      })
    })
  })

  Object.entries(content.wordCards).forEach(([key, card]) => {
    const entryId = card.entryId
    if (!validateEntryId(entryId, `wordCards.${key}.entryId`, canonicalEntryIds, issues))
      return

    validateWordCard(card, entryId, renderedLessonText, issues)
  })

  canonicalEntryIds.forEach((entryId) => {
    const card = content.wordCards[entryId]
    if (!card)
      addIssue(issues, 'missing-word-card', `wordCards.${entryId}`, 'Canonical entry must have a word card')

    const lessonIndexes = annotatedLessonIndexes.get(entryId)
    if (!lessonIndexes?.size) {
      addIssue(
        issues,
        'missing-passage-coverage',
        `wordCards.${entryId}`,
        'Canonical entry must have at least one annotated passage use',
      )
    }

    if (card?.priority === 'high' && (lessonIndexes?.size ?? 0) < 2) {
      addIssue(
        issues,
        'insufficient-high-priority-coverage',
        `wordCards.${entryId}.priority`,
        'High-priority entries need annotated passage uses in at least two distinct lessons',
      )
    }
  })

  validateTaskEntryIds(content.finalSpeaking, 'finalSpeaking', canonicalEntryIds, issues)
  validateTaskEntryIds(content.finalWriting, 'finalWriting', canonicalEntryIds, issues)

  return issues
}

export function assertValidTopicContent(content: TopicContent, topic: CanonicalTopic): void {
  const issues = validateTopicContent(content, topic)
  if (issues.length)
    throw new Error(issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'))
}
