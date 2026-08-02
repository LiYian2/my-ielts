import { readdirSync, statSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PAGES_MAX_ASSET_BYTES = 25 * 1024 * 1024

export function findOversizedFiles(directory, maxBytes = PAGES_MAX_ASSET_BYTES) {
  const files = []
  const visit = (currentDirectory) => {
    for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
      const path = resolve(currentDirectory, entry.name)
      if (entry.isDirectory())
        visit(path)
      else if (entry.isFile()) {
        const size = statSync(path).size
        if (size > maxBytes)
          files.push({ path: relative(directory, path).split(sep).join('/'), size })
      }
    }
  }

  visit(directory)
  return files.sort((a, b) => a.path.localeCompare(b.path))
}

const currentFile = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  const directory = resolve(process.argv[2] || 'dist')
  const oversizedFiles = findOversizedFiles(directory)
  if (oversizedFiles.length > 0) {
    console.error(`Cloudflare Pages assets must not exceed ${PAGES_MAX_ASSET_BYTES} bytes:`)
    for (const file of oversizedFiles)
      console.error(`${file.path}: ${file.size} bytes`)
    process.exitCode = 1
  }
}
