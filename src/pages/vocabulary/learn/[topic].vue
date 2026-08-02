<script setup lang="ts">
import { findTopicBySlug } from '../../../features/vocabulary-learning/content/manifest'
import type { TopicContent } from '../../../features/vocabulary-learning/types'

const route = useRoute()
const content = shallowRef<TopicContent | null>(null)
const isLoading = ref(false)
const unavailableMessage = ref<string | null>(null)
let latestRequest = 0

watch(
  () => route.params.topic,
  async (routeTopic) => {
    const request = ++latestRequest
    const slug = typeof routeTopic === 'string' ? routeTopic : ''
    const topic = findTopicBySlug(slug)
    content.value = null
    unavailableMessage.value = null
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
  <main class="mx-auto max-w-4xl px-4 py-6">
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
    <section v-else-if="content" class="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ content.title }}
      </h1>
      <p class="mt-2 text-gray-600 dark:text-gray-300">
        学习内容已加载，课程界面即将推出。
      </p>
    </section>
  </main>
</template>
