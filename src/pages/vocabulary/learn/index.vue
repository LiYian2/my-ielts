<script setup lang="ts">
import ProgressBackup from '../../../components/vocabulary-learning/ProgressBackup.vue'
import TopicDashboard from '../../../components/vocabulary-learning/TopicDashboard.vue'
import { topicManifest } from '../../../features/vocabulary-learning/content/manifest'
import { useLearningProgress } from '../../../features/vocabulary-learning/useLearningProgress'

const learningProgress = useLearningProgress()
const backupError = ref<string | null>(null)

function downloadProgress(): void {
  const blob = new Blob([learningProgress.exportProgress()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'my-ielts-learning-progress.json'
  link.click()
  URL.revokeObjectURL(url)
}

function importProgress(json: string): void {
  try {
    learningProgress.importProgress(json)
    backupError.value = null
  }
  catch (error) {
    backupError.value = error instanceof Error ? error.message : '无法导入学习进度'
  }
}
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-6">
    <TopicDashboard :manifest="topicManifest" :progress="learningProgress.state.value" />
    <div class="mt-6">
      <ProgressBackup @export="downloadProgress" @import="importProgress" @reset="learningProgress.resetProgress" />
      <p v-if="backupError || learningProgress.persistenceError.value" class="mt-3 text-sm text-red-700" role="alert">
        {{ backupError || learningProgress.persistenceError.value }}
      </p>
    </div>
  </main>
</template>
