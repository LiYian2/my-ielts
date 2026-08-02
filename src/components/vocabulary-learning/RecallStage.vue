<script setup lang="ts">
import type { RecallExercise, ReviewOutcome } from '../../features/vocabulary-learning/types'

interface ExerciseState {
  answer: string
  hintDepth: 0 | 1 | 2 | 3
  hasSubmitted: boolean
  outcome: ReviewOutcome | null
  feedback: string | null
}

const props = defineProps<{
  exercises: RecallExercise[]
}>()

const emit = defineEmits(['reviewed'])
const currentIndex = ref(0)
const states = ref<Record<string, ExerciseState>>({})

const currentExercise = computed(() => props.exercises[currentIndex.value] ?? null)
const currentState = computed(() => currentExercise.value ? stateFor(currentExercise.value) : null)
const isComplete = computed(() => currentState.value?.outcome !== null)

function stateFor(exercise: RecallExercise): ExerciseState {
  const existing = states.value[exercise.id]
  if (existing)
    return existing

  const created: ExerciseState = {
    answer: '',
    hintDepth: 0,
    hasSubmitted: false,
    outcome: null,
    feedback: null,
  }
  states.value = { ...states.value, [exercise.id]: created }
  return states.value[exercise.id]
}

function normaliseAnswer(answer: string): string {
  return answer.normalize('NFKC').replace(/[\p{Z}\s]+/gu, ' ').trim().toLocaleLowerCase()
}

function isAcceptedAnswer(exercise: RecallExercise, answer: string): boolean {
  const submitted = normaliseAnswer(answer)
  return submitted.length > 0 && exercise.acceptedAnswers.some(accepted => normaliseAnswer(accepted) === submitted)
}

function updateAnswer(event: Event): void {
  if (!currentState.value || isComplete.value)
    return

  currentState.value.answer = (event.target as HTMLInputElement).value
  currentState.value.feedback = null
}

function submitAnswer(): void {
  const exercise = currentExercise.value
  const state = currentState.value
  if (!exercise || !state || state.outcome)
    return

  const wasFirstSubmission = !state.hasSubmitted
  state.hasSubmitted = true
  if (!isAcceptedAnswer(exercise, state.answer)) {
    state.feedback = '答案不匹配，请再试或使用提示。'
    return
  }

  const outcome: ReviewOutcome = wasFirstSubmission && state.hintDepth === 0 ? 'unaided' : 'prompted'
  completeExercise(exercise, state, outcome, outcome === 'unaided' ? '独立回忆成功。' : '提示后回忆成功。')
}

function revealHint(): void {
  const state = currentState.value
  if (!state || state.outcome || state.hintDepth >= 2)
    return

  state.hintDepth = state.hintDepth === 0 ? 1 : 2
}

function revealAnswer(): void {
  const exercise = currentExercise.value
  const state = currentState.value
  if (!exercise || !state || state.outcome)
    return

  state.hintDepth = 3
  completeExercise(exercise, state, 'failed', '已显示答案；这次将安排尽快复习。')
}

function completeExercise(exercise: RecallExercise, state: ExerciseState, outcome: ReviewOutcome, feedback: string): void {
  if (state.outcome)
    return

  state.outcome = outcome
  state.feedback = feedback
  emit('reviewed', { entryId: exercise.entryId, outcome })
}

function goTo(index: number): void {
  if (index >= 0 && index < props.exercises.length)
    currentIndex.value = index
}

watch(() => props.exercises, (exercises) => {
  if (currentIndex.value >= exercises.length)
    currentIndex.value = Math.max(exercises.length - 1, 0)
})
</script>

<template>
  <section aria-labelledby="recall-stage-title" class="space-y-5">
    <div>
      <h2 id="recall-stage-title" class="text-xl font-semibold text-gray-900 dark:text-white">
        主动回忆
      </h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
        先凭记忆填空；提示会逐步出现。
      </p>
    </div>

    <div v-if="currentExercise && currentState" class="rounded-lg bg-white p-5 shadow-sm space-y-4 dark:bg-gray-800">
      <p class="text-lg leading-7 text-gray-900 dark:text-gray-100">
        <span>{{ currentExercise.before }}</span><span class="mx-1 inline-block min-w-24 border-b border-gray-400 text-center">{{ currentState.answer || '______' }}</span><span>{{ currentExercise.after }}</span>
      </p>

      <label class="block text-sm font-medium text-gray-800 dark:text-gray-100">
        填入单词或短语
        <input
          :value="currentState.answer"
          :disabled="isComplete"
          class="mt-2 w-full border border-gray-300 rounded px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
          autocomplete="off"
          @input="updateAnswer"
          @keyup.enter="submitAnswer"
        >
      </label>

      <div class="flex flex-wrap gap-3">
        <button data-action="submit-answer" type="button" class="rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60" :disabled="isComplete" @click="submitAnswer">
          提交答案
        </button>
        <button data-action="hint" type="button" class="border border-gray-300 rounded px-4 py-2 text-sm text-gray-700 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-200 disabled:opacity-60" :disabled="isComplete || currentState.hintDepth >= 2" @click="revealHint">
          {{ currentState.hintDepth === 0 ? '显示提示' : '显示词义提示' }}
        </button>
        <button data-action="reveal-answer" type="button" class="border border-gray-300 rounded px-4 py-2 text-sm text-gray-700 disabled:cursor-not-allowed dark:border-gray-600 dark:text-gray-200 disabled:opacity-60" :disabled="isComplete" @click="revealAnswer">
          显示答案
        </button>
      </div>

      <p v-if="currentState.hintDepth >= 1" class="text-sm text-blue-800 dark:text-blue-200">
        首字母：{{ currentExercise.acceptedAnswers[0]?.slice(0, 1) }}
      </p>
      <p v-if="currentState.hintDepth >= 2" class="text-sm text-blue-800 dark:text-blue-200">
        词义提示：{{ currentExercise.meaningCue }}
      </p>
      <p v-if="currentState.hintDepth === 3" class="text-sm font-medium text-gray-900 dark:text-white">
        答案：{{ currentExercise.acceptedAnswers[0] }}
      </p>
      <p v-if="currentState.feedback" role="status" class="text-sm text-gray-700 dark:text-gray-200">
        {{ currentState.feedback }}
      </p>
    </div>
    <p v-else class="rounded-lg bg-white p-5 text-sm text-gray-600 shadow-sm dark:bg-gray-800 dark:text-gray-300">
      此课暂无回忆练习。
    </p>

    <nav v-if="exercises.length > 1" aria-label="回忆练习导航" class="flex justify-between gap-3">
      <button data-action="previous" type="button" class="border border-gray-300 rounded px-4 py-2 text-sm disabled:cursor-not-allowed dark:border-gray-600 disabled:opacity-60" :disabled="currentIndex === 0" @click="goTo(currentIndex - 1)">
        上一题
      </button>
      <span class="self-center text-sm text-gray-600 dark:text-gray-300">{{ currentIndex + 1 }} / {{ exercises.length }}</span>
      <button data-action="next" type="button" class="border border-gray-300 rounded px-4 py-2 text-sm disabled:cursor-not-allowed dark:border-gray-600 disabled:opacity-60" :disabled="currentIndex === exercises.length - 1" @click="goTo(currentIndex + 1)">
        下一题
      </button>
    </nav>
  </section>
</template>
