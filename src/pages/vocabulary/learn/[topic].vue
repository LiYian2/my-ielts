<script setup lang="ts">
import LessonReader from '../../../components/vocabulary-learning/LessonReader.vue'
import ProductionStage from '../../../components/vocabulary-learning/ProductionStage.vue'
import RecallStage from '../../../components/vocabulary-learning/RecallStage.vue'
import { getCanonicalTopic } from '../../../features/vocabulary-learning/canonical'
import { findTopicBySlug } from '../../../features/vocabulary-learning/content/manifest'
import { isDue, localDateKey } from '../../../features/vocabulary-learning/review'
import { useLearningProgress } from '../../../features/vocabulary-learning/useLearningProgress'
import type { EntryId, Lesson, MasteryState, ProductionTask, ReviewOutcome, SavedAnswer, TopicContent } from '../../../features/vocabulary-learning/types'

type StageId = 'warmup' | 'input' | 'recall' | 'production' | 'review'

interface Stage {
  id: StageId
  label: string
}

interface TopicStats {
  unseen: number
  understood: number
  recallable: number
  active: number
  due: number
}

const stages: Stage[] = [
  { id: 'warmup', label: '预热' },
  { id: 'input', label: '语境输入' },
  { id: 'recall', label: '主动回忆' },
  { id: 'production', label: '主动使用' },
  { id: 'review', label: '延迟复习' },
]
const masteryLabels: Array<{ state: MasteryState; label: string }> = [
  { state: 'unseen', label: '未接触' },
  { state: 'understood', label: '已理解' },
  { state: 'recallable', label: '可回忆' },
  { state: 'active', label: '可主动使用' },
]
const selfAssessmentDimensions = ['meaning', 'collocation', 'grammar', 'register', 'relevance'] as const

const route = useRoute()
const learningProgress = useLearningProgress()
const content = shallowRef<TopicContent | null>(null)
const isLoading = ref(false)
const unavailableMessage = ref<string | null>(null)
const currentLessonIndex = ref(0)
const currentStage = ref<StageId>('warmup')
const exposedLessonIds = new Set<string>()
const reviewedExerciseIds = new Set<string>()
const recordedProductionTaskIds = new Set<string>()
let latestRequest = 0

const currentLesson = computed<Lesson | null>(() => content.value?.lessons?.[currentLessonIndex.value] ?? null)
const canonicalTopic = computed(() => content.value?.topicId ? getCanonicalTopic(content.value.topicId) : null)
const completedLessonIds = computed(() => new Set(learningProgress.state.value.completedLessons))
const completedLessonsCount = computed(() => content.value?.lessons.filter(lesson => completedLessonIds.value.has(lesson.id)).length ?? 0)
const allLessonsComplete = computed(() => Boolean(content.value?.lessons.length) && completedLessonsCount.value === content.value!.lessons.length)
const isCurrentLessonComplete = computed(() => currentLesson.value ? completedLessonIds.value.has(currentLesson.value.id) : false)
const requiredWords = computed(() => {
  const words: Partial<Record<EntryId, string>> = {}
  for (const entry of canonicalTopic.value?.entries ?? [])
    words[entry.id] = entry.primaryHeadword
  return words
})
const topicStats = computed<TopicStats>(() => {
  const stats: TopicStats = { unseen: 0, understood: 0, recallable: 0, active: 0, due: 0 }
  const now = new Date()
  for (const entry of canonicalTopic.value?.entries ?? []) {
    const progress = learningProgress.state.value.words[entry.id]
    stats[progress?.state ?? 'unseen'] += 1
    if (progress && isDue(progress, now))
      stats.due += 1
  }
  return stats
})

function selectStage(stage: StageId): void {
  currentStage.value = stage
}

function navigateLesson(offset: number): void {
  const nextIndex = currentLessonIndex.value + offset
  if (!content.value || nextIndex < 0 || nextIndex >= content.value.lessons.length)
    return

  currentLessonIndex.value = nextIndex
  currentStage.value = 'warmup'
}

function recordExposure(entryIds: EntryId[]): void {
  const lesson = currentLesson.value
  if (!lesson || exposedLessonIds.has(lesson.id))
    return

  exposedLessonIds.add(lesson.id)
  for (const entryId of new Set(entryIds))
    learningProgress.recordWordExposure(entryId)
}

function recordReview(event: { entryId: EntryId; outcome: ReviewOutcome }): void {
  const lesson = currentLesson.value
  if (!lesson)
    return

  const exercise = lesson.recallExercises.find(candidate => candidate.entryId === event.entryId)
  if (!exercise || reviewedExerciseIds.has(exercise.id))
    return

  reviewedExerciseIds.add(exercise.id)
  learningProgress.recordWordReview(event.entryId, event.outcome)
  completeLessonWhenReady(lesson)
}

function saveAnswer(answer: SavedAnswer): void {
  learningProgress.saveAnswer(answer)
  const lesson = currentLesson.value
  if (lesson)
    completeLessonWhenReady(lesson)
}

function recordProduction(event: { taskId: string; entryIds: EntryId[] }): void {
  const lesson = currentLesson.value
  const lessonTask = lesson?.productionTasks.find(candidate => candidate.id === event.taskId)
  const finalTask = content.value && [content.value.finalSpeaking, content.value.finalWriting].find(candidate => candidate.id === event.taskId)
  const task = lessonTask ?? finalTask
  if (!task || recordedProductionTaskIds.has(task.id) || !isSubmittedProductionTask(task))
    return

  const today = localDateKey(new Date())
  recordedProductionTaskIds.add(task.id)
  for (const entryId of new Set(event.entryIds)) {
    if (!learningProgress.state.value.words[entryId]?.productionDates.includes(today))
      learningProgress.recordWordProduction(entryId)
  }
  if (lessonTask && lesson)
    completeLessonWhenReady(lesson)
}

function isSubmittedProductionTask(task: ProductionTask): boolean {
  const answer = learningProgress.state.value.answers[task.id]
  return Boolean(answer?.text.trim()) && selfAssessmentDimensions.every(dimension => answer!.selfAssessment[dimension])
}

function isRecallComplete(lesson: Lesson): boolean {
  return lesson.recallExercises.every(exercise => learningProgress.state.value.words[exercise.entryId]?.lastOutcome !== null)
}

function isProductionComplete(lesson: Lesson): boolean {
  return lesson.productionTasks.every(isSubmittedProductionTask)
}

function completeLessonWhenReady(lesson: Lesson): void {
  if (completedLessonIds.value.has(lesson.id) || !isRecallComplete(lesson) || !isProductionComplete(lesson))
    return

  learningProgress.completeLesson(lesson.id)
}

watch(
  () => route.params.topic,
  async (routeTopic) => {
    const request = ++latestRequest
    const slug = typeof routeTopic === 'string' ? routeTopic : ''
    const topic = findTopicBySlug(slug)
    content.value = null
    unavailableMessage.value = null
    currentLessonIndex.value = 0
    currentStage.value = 'warmup'
    isLoading.value = true

    if (!topic || !topic.available || !topic.load) {
      unavailableMessage.value = '该主题的主动学习内容正在生成中。'
      isLoading.value = false
      return
    }

    try {
      const loadedContent = (await topic.load()).default
      if (request !== latestRequest)
        return
      content.value = loadedContent
    }
    catch {
      if (request !== latestRequest)
        return
      unavailableMessage.value = '该主题的主动学习内容正在生成中。'
    }
    finally {
      if (request === latestRequest)
        isLoading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <main class="mx-auto max-w-5xl px-4 py-6 space-y-6">
    <p v-if="isLoading" class="text-gray-600 dark:text-gray-300">
      正在加载学习内容…
    </p>
    <section v-else-if="unavailableMessage" class="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800" aria-live="polite">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        内容生成中
      </h1>
      <p class="mt-2 text-gray-600 dark:text-gray-300">
        {{ unavailableMessage }}
      </p>
      <RouterLink to="/vocabulary/learn" class="mt-4 inline-block text-blue-700 underline dark:text-blue-300">
        返回主题列表
      </RouterLink>
    </section>
    <section v-else-if="content && !currentLesson" class="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ content.title }}
      </h1>
      <p class="mt-2 text-gray-600 dark:text-gray-300">
        学习内容已加载。
      </p>
    </section>
    <template v-else-if="content && currentLesson && canonicalTopic">
      <header class="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ content.title }}
        </h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          完成 {{ completedLessonsCount }} / {{ content.lessons.length }} 课
        </p>
        <p v-if="learningProgress.persistenceError.value" class="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">
          {{ learningProgress.persistenceError.value }}
        </p>
      </header>

      <dl data-topic-stats class="grid gap-3 sm:grid-cols-5">
        <div v-for="item in masteryLabels" :key="item.state" class="rounded-lg bg-white p-3 shadow-sm dark:bg-gray-800">
          <dt class="text-xs text-gray-500 dark:text-gray-300">
            {{ item.label }}
          </dt>
          <dd class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
            {{ topicStats[item.state] }}
          </dd>
        </div>
        <div class="rounded-lg bg-blue-50 p-3 shadow-sm dark:bg-blue-950">
          <dt class="text-xs text-blue-700 dark:text-blue-200">
            今日待复习
          </dt>
          <dd class="mt-1 text-xl font-semibold text-blue-900 dark:text-white">
            {{ topicStats.due }}
          </dd>
        </div>
      </dl>

      <section class="rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ currentLesson.title }}
            </h2>
            <p v-if="isCurrentLessonComplete" class="mt-1 text-sm text-green-700 dark:text-green-300">
              本课已完成
            </p>
          </div>
          <nav aria-label="课程导航" class="flex gap-2">
            <button data-action="previous-lesson" type="button" class="border border-gray-300 rounded px-3 py-2 text-sm disabled:cursor-not-allowed dark:border-gray-600 disabled:opacity-60" :disabled="currentLessonIndex === 0" @click="navigateLesson(-1)">
              上一课
            </button>
            <button data-action="next-lesson" type="button" class="border border-gray-300 rounded px-3 py-2 text-sm disabled:cursor-not-allowed dark:border-gray-600 disabled:opacity-60" :disabled="currentLessonIndex === content.lessons.length - 1" @click="navigateLesson(1)">
              下一课
            </button>
          </nav>
        </div>

        <nav aria-label="学习阶段" class="mt-5 flex flex-wrap gap-2">
          <button v-for="stage in stages" :key="stage.id" :data-stage="stage.id" type="button" class="rounded px-3 py-2 text-sm" :class="currentStage === stage.id ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'" :aria-current="currentStage === stage.id ? 'step' : undefined" @click="selectStage(stage.id)">
            {{ stage.label }}
          </button>
        </nav>
      </section>

      <section v-if="currentStage === 'warmup'" class="rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
          预热
        </h2>
        <p class="mt-3 leading-7 text-gray-800 dark:text-gray-100">
          {{ currentLesson.warmupPrompt }}
        </p>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          先用自己已有的语言回答；这一阶段不计入完成度。
        </p>
      </section>
      <LessonReader v-else-if="currentStage === 'input'" :lesson="currentLesson" :topic="canonicalTopic" :word-cards="content.wordCards" @exposed="recordExposure" />
      <RecallStage v-else-if="currentStage === 'recall'" :exercises="currentLesson.recallExercises" @reviewed="recordReview" />
      <ProductionStage v-else-if="currentStage === 'production'" :tasks="currentLesson.productionTasks" :answers="learningProgress.state.value.answers" :required-words="requiredWords" @answer-saved="saveAnswer" @production-recorded="recordProduction" />
      <section v-else class="rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
          延迟复习
        </h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          已提交的回忆会按间隔进入本地复习队列；今日待复习 {{ topicStats.due }} 个。
        </p>
      </section>

      <section class="rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
          Final challenges
        </h2>
        <template v-if="allLessonsComplete">
          <ProductionStage :tasks="[content.finalSpeaking, content.finalWriting]" :answers="learningProgress.state.value.answers" :required-words="requiredWords" @answer-saved="saveAnswer" @production-recorded="recordProduction" />
        </template>
        <p v-else class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          完成所有课程后解锁 IELTS Speaking 和 IELTS Task 2 段落挑战。
        </p>
      </section>
    </template>
  </main>
</template>
