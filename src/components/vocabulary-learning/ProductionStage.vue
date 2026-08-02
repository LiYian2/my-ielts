<script setup lang="ts">
import type { EntryId, ProductionTask, SavedAnswer } from '../../features/vocabulary-learning/types'

interface TaskDraft {
  text: string
  selfAssessment: Record<string, boolean>
  baseline: Pick<SavedAnswer, 'text' | 'selfAssessment'> | null
  isDirty: boolean
}

const props = withDefaults(defineProps<{
  tasks: ProductionTask[]
  answers: Record<string, SavedAnswer>
  requiredWords?: Partial<Record<EntryId, string>>
  now?: () => Date
}>(), {
  requiredWords: () => ({}),
  now: () => new Date(),
})

const emit = defineEmits(['answer-saved', 'production-recorded'])
const selfAssessmentDimensions = ['meaning', 'collocation', 'grammar', 'register', 'relevance'] as const
const currentIndex = ref(0)
const drafts = reactive<Record<string, TaskDraft>>({})
const savedAnswers = ref<Record<string, SavedAnswer>>({ ...props.answers })
const referenceVisibleTaskIds = ref(new Set<string>())
const recordedTaskIds = new Set<string>()

const currentTask = computed(() => props.tasks[currentIndex.value] ?? null)
const currentDraft = computed(() => currentTask.value ? draftFor(currentTask.value) : null)
const hasSavedAttempt = computed(() => currentTask.value
  ? Boolean(savedAnswers.value[currentTask.value.id]?.text.trim())
  : false)

function draftFor(task: ProductionTask): TaskDraft {
  const existing = drafts[task.id]
  if (existing)
    return existing

  const saved = savedAnswers.value[task.id] ?? props.answers[task.id]
  const created: TaskDraft = {
    text: saved?.text ?? '',
    selfAssessment: { ...(saved?.selfAssessment ?? {}) },
    baseline: saved ? baselineFor(saved) : null,
    isDirty: false,
  }
  drafts[task.id] = created
  return drafts[task.id]
}

function requiredWord(entryId: EntryId): string {
  return props.requiredWords[entryId] ?? entryId
}

function baselineFor(answer: SavedAnswer): Pick<SavedAnswer, 'text' | 'selfAssessment'> {
  return { text: answer.text, selfAssessment: { ...answer.selfAssessment } }
}

function hydrateDraft(draft: TaskDraft, answer: SavedAnswer): void {
  draft.text = answer.text
  draft.selfAssessment = { ...answer.selfAssessment }
  draft.baseline = baselineFor(answer)
  draft.isDirty = false
}

function updateText(event: Event): void {
  const draft = currentDraft.value
  if (!draft)
    return

  draft.text = (event.target as HTMLTextAreaElement).value
  draft.isDirty = true
}

function saveAnswer(): void {
  const task = currentTask.value
  const draft = currentDraft.value
  if (!task || !draft || !draft.text.trim())
    return

  const answer: SavedAnswer = {
    taskId: task.id,
    text: draft.text,
    selfAssessment: { ...draft.selfAssessment },
    updatedAt: props.now().toISOString(),
  }
  savedAnswers.value = { ...savedAnswers.value, [task.id]: answer }
  hydrateDraft(draft, answer)
  // eslint-disable-next-line vue/custom-event-name-casing -- Public parent contract uses kebab-case.
  emit('answer-saved', answer)
  maybeRecordProduction(task, answer)
}

function updateAssessment(dimension: string, event: Event): void {
  const task = currentTask.value
  const draft = currentDraft.value
  if (!task || !draft)
    return

  draft.selfAssessment[dimension] = (event.target as HTMLInputElement).checked
  draft.isDirty = true
  const saved = savedAnswers.value[task.id]
  if (!saved)
    return

  const answer = {
    ...saved,
    selfAssessment: { ...draft.selfAssessment },
    updatedAt: props.now().toISOString(),
  }
  savedAnswers.value = { ...savedAnswers.value, [task.id]: answer }
  hydrateDraft(draft, answer)
  // eslint-disable-next-line vue/custom-event-name-casing -- Public parent contract uses kebab-case.
  emit('answer-saved', answer)
  maybeRecordProduction(task, answer)
}

function maybeRecordProduction(task: ProductionTask, answer: SavedAnswer): void {
  if (recordedTaskIds.has(task.id) || !answer.text.trim() || !selfAssessmentDimensions.every(dimension => answer.selfAssessment[dimension]))
    return

  recordedTaskIds.add(task.id)
  // eslint-disable-next-line vue/custom-event-name-casing -- Public parent contract uses kebab-case.
  emit('production-recorded', { taskId: task.id, entryIds: [...task.requiredEntryIds] })
}

function toggleReference(): void {
  const task = currentTask.value
  if (!task || !hasSavedAttempt.value)
    return

  const next = new Set(referenceVisibleTaskIds.value)
  if (next.has(task.id))
    next.delete(task.id)
  else
    next.add(task.id)
  referenceVisibleTaskIds.value = next
}

function goTo(index: number): void {
  if (index >= 0 && index < props.tasks.length)
    currentIndex.value = index
}

watch(() => props.answers, (answers) => {
  savedAnswers.value = { ...savedAnswers.value, ...answers }
  for (const task of props.tasks) {
    const saved = answers[task.id]
    const draft = drafts[task.id]
    if (saved && draft && !draft.isDirty)
      hydrateDraft(draft, saved)
  }
}, { deep: true })

watch(() => props.tasks, (tasks) => {
  if (currentIndex.value >= tasks.length)
    currentIndex.value = Math.max(tasks.length - 1, 0)
})
</script>

<template>
  <section v-if="currentTask && currentDraft" :data-mode="currentTask.mode" aria-labelledby="production-stage-title" class="space-y-5">
    <div>
      <h2 id="production-stage-title" class="text-xl font-semibold text-gray-900 dark:text-white">
        主动运用
      </h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
        {{ currentTask.prompt }}
      </p>
    </div>

    <div class="rounded-lg bg-white p-5 shadow-sm space-y-4 dark:bg-gray-800">
      <p class="text-sm font-medium text-gray-800 dark:text-gray-100">
        必须使用：{{ currentTask.requiredEntryIds.map(requiredWord).join('、') }}
      </p>
      <p v-if="currentTask.mode === 'speaking'" class="text-sm text-gray-600 dark:text-gray-300">
        口语笔记：先整理要点，再完成表达。建议限时 2 分钟。
      </p>

      <label class="block text-sm font-medium text-gray-800 dark:text-gray-100">
        {{ currentTask.mode === 'speaking' ? '口语笔记与回答' : '回答' }}
        <textarea :value="currentDraft.text" rows="6" class="mt-2 w-full border border-gray-300 rounded px-3 py-2 dark:border-gray-600 dark:bg-gray-900" :aria-label="currentTask.mode === 'speaking' ? '口语笔记与回答' : '回答'" @input="updateText" />
      </label>

      <button data-action="save-answer" type="button" class="rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60" :disabled="!currentDraft.text.trim()" @click="saveAnswer">
        保存回答
      </button>

      <div class="border-t border-gray-200 pt-4 dark:border-gray-700">
        <p class="text-sm font-medium text-gray-800 dark:text-gray-100">
          自我检查
        </p>
        <label v-for="dimension in selfAssessmentDimensions" :key="dimension" data-rubric class="mt-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <input :checked="Boolean(currentDraft.selfAssessment[dimension])" type="checkbox" @change="updateAssessment(dimension, $event)">
          {{ dimension }}
        </label>
      </div>

      <div v-if="hasSavedAttempt" class="border-t border-gray-200 pt-4 dark:border-gray-700">
        <button data-action="toggle-reference" type="button" class="border border-gray-300 rounded px-4 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200" :aria-expanded="referenceVisibleTaskIds.has(currentTask.id)" @click="toggleReference">
          {{ referenceVisibleTaskIds.has(currentTask.id) ? '隐藏参考答案' : '显示参考答案' }}
        </button>
        <p v-if="referenceVisibleTaskIds.has(currentTask.id)" class="mt-3 text-sm leading-6 text-gray-800 dark:text-gray-100">
          参考答案：{{ currentTask.referenceAnswer }}
        </p>
      </div>
    </div>

    <nav v-if="tasks.length > 1" aria-label="主动运用练习导航" class="flex justify-between gap-3">
      <button data-action="previous" type="button" class="border border-gray-300 rounded px-4 py-2 text-sm disabled:cursor-not-allowed dark:border-gray-600 disabled:opacity-60" :disabled="currentIndex === 0" @click="goTo(currentIndex - 1)">
        上一题
      </button>
      <span class="self-center text-sm text-gray-600 dark:text-gray-300">{{ currentIndex + 1 }} / {{ tasks.length }}</span>
      <button data-action="next" type="button" class="border border-gray-300 rounded px-4 py-2 text-sm disabled:cursor-not-allowed dark:border-gray-600 disabled:opacity-60" :disabled="currentIndex === tasks.length - 1" @click="goTo(currentIndex + 1)">
        下一题
      </button>
    </nav>
  </section>
  <section v-else aria-labelledby="production-stage-title" class="rounded-lg bg-white p-5 text-sm text-gray-600 shadow-sm dark:bg-gray-800 dark:text-gray-300">
    <h2 id="production-stage-title" class="text-xl font-semibold text-gray-900 dark:text-white">
      主动运用
    </h2>
    此课暂无主动运用练习。
  </section>
</template>
