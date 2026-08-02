<script setup lang="ts">
import { getCanonicalTopic } from '../../features/vocabulary-learning/canonical'
import { isDue } from '../../features/vocabulary-learning/review'
import type { TopicManifestEntry } from '../../features/vocabulary-learning/content/manifest'
import type { CanonicalEntry, LearningStateV1, MasteryState } from '../../features/vocabulary-learning/types'

interface ProgressSummary {
  unseen: number
  understood: number
  recallable: number
  active: number
  due: number
}

const props = defineProps<{
  manifest: readonly TopicManifestEntry[]
  progress: LearningStateV1
  now?: Date
}>()

const masteryLabels: Array<{ state: MasteryState; label: string }> = [
  { state: 'unseen', label: '未接触' },
  { state: 'understood', label: '已理解' },
  { state: 'recallable', label: '可回忆' },
  { state: 'active', label: '可主动使用' },
]

const availableEntries = computed(() => props.manifest
  .filter(topic => topic.available)
  .flatMap(topic => getCanonicalTopic(topic.sourceTopicId).entries))

const summary = computed(() => progressSummary(availableEntries.value, props.progress, props.now ?? new Date()))

function topicSummary(topic: TopicManifestEntry): ProgressSummary {
  return progressSummary(getCanonicalTopic(topic.sourceTopicId).entries, props.progress, props.now ?? new Date())
}

function progressSummary(entries: CanonicalEntry[], progress: LearningStateV1, now: Date): ProgressSummary {
  const summary: ProgressSummary = { unseen: 0, understood: 0, recallable: 0, active: 0, due: 0 }

  for (const entry of entries) {
    const wordProgress = progress.words[entry.id]
    summary[wordProgress?.state ?? 'unseen'] += 1
    if (wordProgress && isDue(wordProgress, now))
      summary.due += 1
  }

  return summary
}
</script>

<template>
  <section aria-labelledby="learning-dashboard-title" class="space-y-6">
    <div>
      <h1 id="learning-dashboard-title" class="text-2xl font-bold text-gray-900 dark:text-white">
        主动学习词汇
      </h1>
      <p class="mt-2 text-gray-600 dark:text-gray-300">
        从理解词义到自然、准确地使用词汇。
      </p>
    </div>

    <dl class="grid gap-3 lg:grid-cols-5 sm:grid-cols-2">
      <div v-for="item in masteryLabels" :key="item.state" class="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
        <dt class="text-sm text-gray-500 dark:text-gray-300">
          {{ item.label }}
        </dt>
        <dd class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
          {{ summary[item.state] }}
        </dd>
      </div>
      <div class="rounded-lg bg-blue-50 p-4 shadow-sm dark:bg-blue-950">
        <dt class="text-sm text-blue-700 dark:text-blue-200">
          今日待复习
        </dt>
        <dd class="mt-1 text-2xl font-semibold text-blue-900 dark:text-white">
          {{ summary.due }}
        </dd>
      </div>
    </dl>

    <ul class="grid gap-4 md:grid-cols-2" aria-label="词汇主题">
      <li v-for="topic in manifest" :key="topic.sourceTopicId" class="rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800">
        <RouterLink
          v-if="topic.available"
          :to="`/vocabulary/learn/${topic.slug}`"
          class="block rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <span class="text-lg font-semibold text-gray-900 dark:text-white">{{ topic.title }}</span>
          <span class="mt-2 block text-sm text-blue-700 dark:text-blue-300">开始学习 →</span>
          <span class="mt-3 block text-sm text-gray-500 dark:text-gray-300">
            {{ topicSummary(topic).due }} 个待复习
          </span>
        </RouterLink>
        <div v-else>
          <span class="text-lg font-semibold text-gray-900 dark:text-white">{{ topic.title }}</span>
          <span class="mt-2 block text-sm text-gray-500 dark:text-gray-300">内容生成中</span>
        </div>
      </li>
    </ul>
  </section>
</template>
