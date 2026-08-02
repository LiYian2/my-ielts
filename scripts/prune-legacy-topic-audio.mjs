import { readdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function findLegacyTopicAudioFiles(audioDirectory) {
  return readdirSync(audioDirectory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.mp3'))
    .map(entry => resolve(audioDirectory, entry.name))
}

export function pruneLegacyTopicAudio(audioDirectory) {
  const files = findLegacyTopicAudioFiles(audioDirectory)
  for (const file of files)
    rmSync(file)
  return files
}

const currentFile = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  const distDirectory = resolve(dirname(currentFile), '..', 'dist', 'vocabulary', 'audio')
  const removed = pruneLegacyTopicAudio(distDirectory)
  console.log(`Pruned ${removed.length} legacy topic audio file(s) from dist.`)
}
