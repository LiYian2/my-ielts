<script setup lang="ts">
import type { DelayedReviewItem, EntryId, ReviewOutcome } from '../../features/vocabulary-learning/types'

const props = defineProps<{
  items: DelayedReviewItem[]
}>()

const emit = defineEmits(['reviewed'])
const drafts = ref<Record<EntryId, string>>({})
const revealedEntryIds = ref<Set<EntryId>>(new Set())
const completedEntryIds = ref<Set<EntryId>>(new Set())

const currentItem = computed(() => props.items[0] ?? null)
const currentDraft = computed(() => currentItem.value ? drafts.value[currentItem.value.entry.id] ?? '' : '')
const isRevealed = computed(() => currentItem.value ? revealedEntryIds.value.has(currentItem.value.entry.id) : false)
const isCompleted = computed(() => currentItem.value ? completedEntryIds.value.has(currentItem.value.entry.id) : false)
const prompt = computed(() => currentItem.value ? reviewPrompt(currentItem.value) : '')

function reviewPrompt(item: DelayedReviewItem): string {
  if (item.mode === 'meaning')
    return `根据词义“${item.card.meaning}”写出目标英文词，并用它造一个短句。`
  if (item.mode === 'cloze')
    return `根据语境补全目标词：${maskTarget(item.card.passageSentence, item.entry.primaryHeadword)}`
  if (item.mode === 'collocation')
    return `补全并解释这个固定搭配：${maskTarget(item.card.collocations[0], item.entry.primaryHeadword)}`
  return item.card.outputPrompt
}

function maskTarget(text: string, headword: string): string {
  const escaped = headword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const masked = text.replace(new RegExp(escaped, 'iu'), '______')
  return masked === text ? '______（请根据本课内容补全目标表达）' : masked
}

function updateDraft(event: Event): void {
  const item = currentItem.value
  if (!item || isCompleted.value)
    return
  drafts.value = { ...drafts.value, [item.entry.id]: (event.target as HTMLTextAreaElement).value }
}

function revealReference(): void {
  const item = currentItem.value
  if (!item || !currentDraft.value.trim() || isCompleted.value)
    return
  revealedEntryIds.value = new Set([...revealedEntryIds.value, item.entry.id])
}

function recordOutcome(outcome: ReviewOutcome): void {
  const item = currentItem.value
  if (!item || !isRevealed.value || isCompleted.value)
    return
  completedEntryIds.value = new Set([...completedEntryIds.value, item.entry.id])
  emit('reviewed', { entryId: item.entry.id, outcome })
}
</script>

<template>
  <section aria-labelledby="delayed-review-title" class="rounded-lg bg-white p-5 shadow-sm space-y-4 dark:bg-gray-800">
    <div>
      <h2 id="delayed-review-title" class="text-xl font-semibold text-gray-900 dark:text-white">
        延迟复习
      </h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
        先独立作答，再查看静态参考并诚实自评。四种题型会轮换出现。
      </p>
    </div>

    <p v-if="!currentItem" class="rounded bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
      今天没有到期词汇。继续使用已学词汇，下一次复习会按计划出现。
    </p>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600 dark:text-gray-300">
        <span>待复习 {{ items.length }} 个</span>
        <span :data-review-mode="currentItem.mode">
          {{ { meaning: '释义回忆', cloze: '语境填空', collocation: '搭配补全', production: '主动造句' }[currentItem.mode] }}
        </span>
      </div>

      <p class="text-base leading-7 text-gray-900 dark:text-gray-100">
        {{ prompt }}
      </p>

      <label class="block text-sm font-medium text-gray-800 dark:text-gray-100">
        你的回答
        <textarea
          :value="currentDraft"
          :disabled="isCompleted"
          rows="4"
          class="mt-2 w-full border border-gray-300 rounded px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
          @input="updateDraft"
        />
      </label>

      <button data-action="reveal-reference" type="button" class="rounded bg-blue-700 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60" :disabled="!currentDraft.trim() || isCompleted" @click="revealReference">
        查看参考并自评
      </button>

      <div v-if="isRevealed" class="rounded bg-blue-50 p-4 text-sm text-gray-800 space-y-2 dark:bg-blue-950 dark:text-gray-100">
        <p><strong>含义：</strong>{{ currentItem.card.meaning }}</p>
        <p><strong>固定搭配：</strong>{{ currentItem.card.collocations.join('；') }}</p>
        <p><strong>参考例句：</strong>{{ currentItem.card.example.text }}</p>
      </div>

      <div v-if="isRevealed" class="flex flex-wrap gap-2" aria-label="复习自评">
        <button data-outcome="unaided" type="button" class="rounded bg-green-700 px-3 py-2 text-sm text-white disabled:opacity-60" :disabled="isCompleted" @click="recordOutcome('unaided')">
          独立完成
        </button>
        <button data-outcome="prompted" type="button" class="rounded bg-amber-600 px-3 py-2 text-sm text-white disabled:opacity-60" :disabled="isCompleted" @click="recordOutcome('prompted')">
          有提示才完成
        </button>
        <button data-outcome="failed" type="button" class="rounded bg-gray-700 px-3 py-2 text-sm text-white disabled:opacity-60" :disabled="isCompleted" @click="recordOutcome('failed')">
          仍需重学
        </button>
      </div>
    </template>
  </section>
</template>
