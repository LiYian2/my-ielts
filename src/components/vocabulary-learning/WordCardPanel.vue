<script setup lang="ts">
import type { CanonicalEntry, EntryId, WordCard } from '../../features/vocabulary-learning/types'

interface AudioPlayer {
  src: string
  currentTime: number
  play: () => void | Promise<void>
  pause: () => void
  addEventListener: (type: string, listener: EventListener) => void
  removeEventListener: (type: string, listener: EventListener) => void
}

type AudioFactory = () => AudioPlayer

const props = withDefaults(defineProps<{
  entry: CanonicalEntry
  card: WordCard
  audioFactory?: AudioFactory
}>(), {
  audioFactory: () => new Audio(),
})

const unavailableEntryIds = ref(new Set<EntryId>())
const audio = shallowRef<AudioPlayer | null>(null)
let isPanelMounted = true
let nextPlaybackToken = 0
let activePlayback: { token: number; entryId: EntryId; player: AudioPlayer } | null = null

function isActivePlayback(token: number, entryId: EntryId, player: AudioPlayer): boolean {
  return isPanelMounted
    && activePlayback?.token === token
    && activePlayback.entryId === entryId
    && activePlayback.player === player
    && audio.value === player
}

function stopAudio(): void {
  nextPlaybackToken += 1
  activePlayback = null
  if (!audio.value)
    return

  audio.value.pause()
  audio.value.currentTime = 0
}

function markAudioUnavailable(entryId: EntryId): void {
  unavailableEntryIds.value = new Set(unavailableEntryIds.value).add(entryId)
  if (activePlayback?.entryId === entryId)
    stopAudio()
}

function onAudioError(): void {
  // Native media errors do not identify a superseded source on a reusable player.
  // Treat an error as current only while a mounted, matching playback remains active.
  const playback = activePlayback
  if (playback && isActivePlayback(playback.token, playback.entryId, playback.player))
    markAudioUnavailable(playback.entryId)
}

function getAudio(): AudioPlayer | null {
  if (audio.value)
    return audio.value

  try {
    const createdAudio = props.audioFactory()
    createdAudio.addEventListener('error', onAudioError)
    audio.value = createdAudio
    return createdAudio
  }
  catch {
    markAudioUnavailable(props.entry.id)
    return null
  }
}

function playAudio(): void {
  const entryId = props.entry.id
  if (unavailableEntryIds.value.has(entryId))
    return

  const player = getAudio()
  if (!player)
    return

  stopAudio()
  const token = ++nextPlaybackToken
  activePlayback = { token, entryId, player }

  try {
    player.src = props.entry.audioPath
    Promise.resolve(player.play()).catch(() => {
      if (isActivePlayback(token, entryId, player))
        markAudioUnavailable(entryId)
    })
  }
  catch {
    if (isActivePlayback(token, entryId, player))
      markAudioUnavailable(entryId)
  }
}

const isAudioUnavailable = computed(() => unavailableEntryIds.value.has(props.entry.id))

watch(() => props.entry.id, stopAudio)

onBeforeUnmount(() => {
  isPanelMounted = false
  if (!audio.value)
    return

  stopAudio()
  audio.value.removeEventListener('error', onAudioError)
  audio.value = null
})
</script>

<template>
  <aside class="border border-blue-100 rounded-lg bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950" aria-live="polite" aria-labelledby="word-card-title">
    <header class="flex flex-wrap items-center gap-3">
      <h2 id="word-card-title" class="text-xl font-semibold text-gray-900 dark:text-white">
        {{ entry.primaryHeadword }}
      </h2>
      <span class="text-sm text-gray-600 dark:text-gray-300">{{ entry.pos }}</span>
      <span class="text-sm font-mono text-gray-700 dark:text-gray-200">{{ card.ipa }}</span>
      <button
        data-action="play-audio"
        type="button"
        class="border border-blue-300 rounded px-2 py-1 text-sm text-blue-800 disabled:cursor-not-allowed dark:border-blue-700 dark:text-blue-200 disabled:opacity-60"
        :aria-label="`播放 ${entry.primaryHeadword} 的英式发音`"
        :disabled="isAudioUnavailable"
        @click="playAudio"
      >
        播放发音
      </button>
      <span v-if="isAudioUnavailable" class="text-sm text-red-700 dark:text-red-300" role="status">音频不可用</span>
    </header>

    <dl class="mt-4 text-sm text-gray-800 space-y-4 dark:text-gray-100">
      <div>
        <dt class="font-medium text-gray-600 dark:text-gray-300">
          释义
        </dt>
        <dd class="mt-1">
          {{ card.meaning }}
        </dd>
      </div>
      <div>
        <dt class="font-medium text-gray-600 dark:text-gray-300">
          常用搭配
        </dt>
        <dd class="mt-1">
          <ul class="list-disc pl-5">
            <li v-for="collocation in card.collocations" :key="collocation">
              {{ collocation }}
            </li>
          </ul>
        </dd>
      </div>
      <div>
        <dt class="font-medium text-gray-600 dark:text-gray-300">
          示例（{{ card.example.use === 'speaking' ? '适合口语' : card.example.use === 'writing' ? '适合写作' : '适合口语和写作' }}）
        </dt>
        <dd class="mt-1">
          {{ card.example.text }}
        </dd>
      </div>
      <div>
        <dt class="font-medium text-gray-600 dark:text-gray-300">
          课文原句
        </dt>
        <dd class="mt-1">
          {{ card.passageSentence }}
        </dd>
      </div>
      <div>
        <dt class="font-medium text-gray-600 dark:text-gray-300">
          主动输出提示
        </dt>
        <dd class="mt-1">
          {{ card.outputPrompt }}
        </dd>
      </div>
      <div v-if="card.wordFamily?.length">
        <dt class="font-medium text-gray-600 dark:text-gray-300">
          词族
        </dt>
        <dd class="mt-1">
          {{ card.wordFamily.join('；') }}
        </dd>
      </div>
      <div v-if="card.synonyms?.length">
        <dt class="font-medium text-gray-600 dark:text-gray-300">
          近义词
        </dt>
        <dd class="mt-1 space-y-1">
          <p v-for="synonym in card.synonyms" :key="synonym.word">
            <span class="font-medium">{{ synonym.word }}</span>：{{ synonym.distinction }}
          </p>
        </dd>
      </div>
      <div v-if="card.usageNotes?.length">
        <dt class="font-medium text-gray-600 dark:text-gray-300">
          用法提示
        </dt>
        <dd class="mt-1">
          <ul class="list-disc pl-5">
            <li v-for="note in card.usageNotes" :key="note">
              {{ note }}
            </li>
          </ul>
        </dd>
      </div>
    </dl>
  </aside>
</template>
