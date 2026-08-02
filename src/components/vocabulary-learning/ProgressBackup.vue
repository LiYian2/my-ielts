<script setup lang="ts">
const emit = defineEmits({
  export: () => true,
  import: (_json: string) => true,
  reset: () => true,
})

const importError = ref<string | null>(null)
const isResetConfirmationVisible = ref(false)

async function importFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.item(0)
  input.value = ''
  if (!file)
    return

  try {
    emit('import', await file.text())
    importError.value = null
  }
  catch {
    importError.value = '无法读取该备份文件，请选择 JSON 文件后重试。'
  }
}

function confirmReset(): void {
  isResetConfirmationVisible.value = false
  emit('reset')
}
</script>

<template>
  <section aria-labelledby="progress-backup-title" class="rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800">
    <h2 id="progress-backup-title" class="text-lg font-semibold text-gray-900 dark:text-white">
      学习进度备份
    </h2>
    <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
      进度仅保存在当前浏览器；可导出备份后再导入恢复。
    </p>
    <div class="mt-4 flex flex-wrap gap-3">
      <button data-action="export" type="button" class="rounded bg-blue-700 px-4 py-2 text-sm text-white" @click="emit('export')">
        导出进度
      </button>
      <label class="cursor-pointer border border-gray-300 rounded px-4 py-2 text-sm text-gray-700 dark:text-gray-200">
        导入进度
        <input class="sr-only" type="file" accept="application/json,.json" aria-label="选择进度备份 JSON 文件" @change="importFile">
      </label>
      <button data-action="reset" type="button" class="border border-red-300 rounded px-4 py-2 text-sm text-red-700 dark:text-red-300" @click="isResetConfirmationVisible = true">
        重置进度
      </button>
    </div>
    <p v-if="importError" class="mt-3 text-sm text-red-700" role="alert">
      {{ importError }}
    </p>
    <div v-if="isResetConfirmationVisible" class="mt-4 border border-red-200 rounded p-3" role="alertdialog" aria-labelledby="reset-progress-title">
      <p id="reset-progress-title" class="text-sm text-gray-800 dark:text-gray-100">
        确定要清除本浏览器中的所有主动学习进度吗？此操作不可撤销。
      </p>
      <div class="mt-3 flex gap-3">
        <button data-action="confirm-reset" type="button" class="rounded bg-red-700 px-3 py-1.5 text-sm text-white" @click="confirmReset">
          确认重置
        </button>
        <button type="button" class="border rounded px-3 py-1.5 text-sm" @click="isResetConfirmationVisible = false">
          取消
        </button>
      </div>
    </div>
  </section>
</template>
