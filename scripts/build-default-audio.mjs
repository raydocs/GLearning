import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'

const questJsonPath = process.argv[2] || '/tmp/wuwa-current.json'
const outputDir = new URL('../public/audio/', import.meta.url)
const functionManifestPath = new URL('../functions/audio-manifest.js', import.meta.url)
const publicManifestPath = new URL('../public/audio/manifest.json', import.meta.url)

const quest = JSON.parse(await readFile(questJsonPath, 'utf8'))
const entries = new Map()

for (const line of quest.lines || []) {
  if (line.audioFile && line.audioSourceUrl) {
    entries.set(normalizeFileName(line.audioFile), line.audioSourceUrl)
  }
}

await mkdir(outputDir, { recursive: true })

const manifest = {}
let completed = 0
let skipped = 0

for (const [fileName, sourceUrl] of entries) {
  if (sourceUrl.includes('/Special:Redirect/')) {
    console.warn(`Skipping missing Fandom file metadata: ${fileName}`)
    skipped += 1
    continue
  }

  const slug = audioSlug(fileName)
  const outputPath = new URL(`${slug}.mp3`, outputDir)
  const publicPath = `/audio/${slug}.mp3`

  if (!existsSync(outputPath)) {
    try {
      await run('ffmpeg', [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        sourceUrl,
        '-vn',
        '-codec:a',
        'libmp3lame',
        '-b:a',
        '96k',
        outputPath.pathname,
      ])
    } catch (error) {
      console.warn(`Skipping ${fileName}: ${error.message}`)
      skipped += 1
      continue
    }
  }

  manifest[fileName] = publicPath
  completed += 1
  if (completed % 25 === 0 || completed + skipped === entries.size) {
    console.log(`Converted ${completed}/${entries.size} (${skipped} skipped)`)
  }
}

await writeFile(publicManifestPath, JSON.stringify(manifest, null, 2))
await writeFile(
  functionManifestPath,
  `export const AUDIO_MP3_BY_FILE = ${JSON.stringify(manifest, null, 2)}\n`,
)

function normalizeFileName(file) {
  return String(file || '').trim().replace(/_/g, ' ')
}

function audioSlug(fileName) {
  return normalizeFileName(fileName)
    .replace(/\.ogg$/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with ${code}`))
    })
  })
}
