<script setup lang="ts">
import type { CanonicalEntry, CanonicalTopic, EntryId, Lesson, WordCard } from '../../features/vocabulary-learning/types'
import WordCardPanel from './WordCardPanel.vue'

interface AudioPlayer {
  src: string
  currentTime: number
  play: () => void | Promise<void>
  pause: () => void
  addEventListener: (type: string, listener: EventListener) => void
  removeEventListener: (type: string, listener: EventListener) => void
}

type AudioFactory = () => AudioPlayer

const props = defineProps<{
  lesson: Lesson
  topic: CanonicalTopic
  wordCards: Record<EntryId, WordCard>
  audioFactory?: AudioFactory
}>()

const emit = defineEmits(['exposed', 'open-card'])

const selectedEntryId = ref<EntryId | null>(null)
const isTranslationVisible = ref(false)
const exposedLessonKeys = new Set<string>()
const isMounted = ref(false)

function resolvedWord(entryId: EntryId | null): { entry: CanonicalEntry; card: WordCard } | null {
  if (!entryId)
    return null

  const entry = props.topic.entries.find(candidate => candidate.id === entryId)
  const card = props.wordCards[entryId]
  if (!entry || !card || card.entryId !== entryId)
    return null

  return { entry, card }
}

const selectedWord = computed(() => resolvedWord(selectedEntryId.value))

function openCard(entryId: EntryId): void {
  if (!resolvedWord(entryId) || selectedEntryId.value === entryId)
    return

  selectedEntryId.value = entryId
  // eslint-disable-next-line vue/custom-event-name-casing -- Public parent contract uses kebab-case.
  emit('open-card', entryId)
}

function emitExposedTargets(): void {
  const entryIds = [...new Set(props.lesson.targetEntryIds)]
  const key = `${props.lesson.id}:${entryIds.join('|')}`
  if (exposedLessonKeys.has(key))
    return

  exposedLessonKeys.add(key)
  emit('exposed', entryIds)
}

onMounted(() => {
  isMounted.value = true
  emitExposedTargets()
})

watch(() => props.lesson, () => {
  selectedEntryId.value = null
  isTranslationVisible.value = false
  if (isMounted.value)
    emitExposedTargets()
})
</script>

<template>
  <section aria-labelledby="lesson-reader-title" class="space-y-5">
    <div>
      <h2 id="lesson-reader-title" class="text-xl font-semibold text-gray-900 dark:text-white">
        {{ lesson.title }}
      </h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
        阅读短文；点击高亮词查看用法和发音。
      </p>
    </div>

    <article data-passage class="space-y-4 rounded-lg bg-white p-5 leading-7 shadow-sm dark:bg-gray-800 dark:text-gray-100">
      <p v-for="(paragraph, paragraphIndex) in lesson.passage" :key="paragraphIndex">
        <template v-for="segment in paragraph.segments" :key="segment.entryId ?? segment.text">
          <button
            v-if="segment.entryId"
            :data-entry-id="segment.entryId"
            type="button"
            class="rounded px-0.5 font-semibold text-blue-700 underline decoration-blue-300 underline-offset-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-blue-300"
            :aria-label="`查看 ${segment.text} 的词汇卡`"
            @click="openCard(segment.entryId)"
          >{{ segment.text }}</button>
          <span v-else>{{ segment.text }}</span>
        </template>
      </p>
    </article>

    <div>
      <button
        type="button"
        class="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200"
        :aria-expanded="isTranslationVisible"
        aria-controls="lesson-translation"
        @click="isTranslationVisible = !isTranslationVisible"
      >
        {{ isTranslationVisible ? '隐藏中文翻译' : '显示中文翻译' }}
      </button>
      <div v-if="isTranslationVisible" id="lesson-translation" class="mt-3 space-y-2 rounded border border-gray-200 p-4 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-200">
        <p v-for="(paragraph, index) in lesson.translation" :key="index">{{ paragraph }}</p>
      </div>
    </div>

    <WordCardPanel
      v-if="selectedWord"
      :entry="selectedWord.entry"
      :card="selectedWord.card"
      :audio-factory="audioFactory"
    />
  </section>
</template>
