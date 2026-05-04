import type { QuestLine, QuestResponse, QuestTerm } from './types'

export const PALETTE_STORAGE_PREFIX = 'glearning-palette'
export const DENSITY_STORAGE_KEY = 'glearning-density'
export const STUDY_STORAGE_VERSION = 1
export const STUDY_STORAGE_PREFIX = `glearning-study-v${STUDY_STORAGE_VERSION}`
export const SAVES_STORAGE_KEY = 'glearning-saves-v1'
export const SAVES_STORAGE_VERSION = 1
export const REVIEW_STORAGE_KEY = 'glearning-review-v1'
export const REVIEW_STORAGE_VERSION = 1
export const REVIEW_AGAIN_MINUTES = 10
export const REVIEW_FIRST_KNOW_MINUTES = 60 * 24
export const REVIEW_MAX_KNOW_MINUTES = 60 * 24 * 30
export const LOCAL_SNAPSHOT_VERSION = 1

export type DensityId = 'compact' | 'standard' | 'spacious'

const DENSITY_IDS: readonly DensityId[] = ['compact', 'standard', 'spacious']

export type LineStudyState = {
  revealedAt?: string
  firstPlayedAt?: string
  lastPlayedAt?: string
  playCount?: number
  masteredAt?: string
}

export type StoredQuestStudyState = {
  version: typeof STUDY_STORAGE_VERSION
  gameId: string
  questKey: string
  updatedAt: string
  lines: Record<string, LineStudyState>
}

export type SavedLineItem = {
  type: 'line'
  id: string
  gameId: string
  questKey: string
  lineKey: string
  lineId: string
  speakerEn: string
  speakerZh: string
  en: string
  zh: string
  questTitle?: string
  questZhTitle?: string
  sourceEnUrl?: string
  sourceZhUrl?: string
  savedAt: string
  updatedAt: string
}

export type SavedTermItem = {
  type: 'term'
  id: string
  gameId: string
  questKey: string
  en: string
  zh: string
  questTitle?: string
  questZhTitle?: string
  sourceEnUrl?: string
  sourceZhUrl?: string
  savedAt: string
  updatedAt: string
}

export type SavedItem = SavedLineItem | SavedTermItem

export type StoredSavedItems = {
  version: typeof SAVES_STORAGE_VERSION
  updatedAt: string
  items: Record<string, SavedItem>
}

export type ReviewGrade = 'again' | 'know'

export type ReviewItemState = {
  dueAt: string
  intervalMinutes: number
  reviewedAt?: string
  lastGrade?: ReviewGrade
}

export type StoredReviewItems = {
  version: typeof REVIEW_STORAGE_VERSION
  updatedAt: string
  items: Record<string, ReviewItemState>
}

export type LocalSnapshotPreferenceExport = {
  density?: {
    key: typeof DENSITY_STORAGE_KEY
    value: DensityId
  }
  palettes: Array<{
    key: string
    gameId: string
    value: string
  }>
}

export type LocalDataSnapshot = {
  app: 'GLearning'
  version: typeof LOCAL_SNAPSHOT_VERSION
  exportedAt: string
  exportType: 'browser-local-json-snapshot'
  claims: {
    account: false
    cloudSync: false
    publicProfile: false
    shareCards: false
    restoreImport: false
  }
  counts: {
    savedItems: number
    savedLines: number
    savedTerms: number
    reviewItems: number
    studyStates: number
    studyLines: number
    preferences: number
  }
  data: {
    saves: StoredSavedItems
    reviews: StoredReviewItems
    studyStates: StoredQuestStudyState[]
    preferences: LocalSnapshotPreferenceExport
  }
}

export type QuestStudyIdentity = {
  questKey: string
  storageKey: string
}

export function getPaletteStorageKey(gameId: string) {
  return `${PALETTE_STORAGE_PREFIX}-${gameId}`
}

export function getInitialDensity(): DensityId {
  if (typeof window === 'undefined') return 'standard'
  const savedDensity = window.localStorage.getItem(DENSITY_STORAGE_KEY)
  return DENSITY_IDS.some((density) => density === savedDensity) ? (savedDensity as DensityId) : 'standard'
}

export function getQuestStudyIdentity(gameId: string, quest: QuestResponse): QuestStudyIdentity {
  const questKey = hashString([gameId, quest.source.enUrl, quest.source.zhUrl, quest.meta.enTitle].join('|'))
  return {
    questKey,
    storageKey: `${STUDY_STORAGE_PREFIX}:${gameId}:${questKey}`,
  }
}

export function buildLineStudyKeys(lines: QuestLine[]) {
  const seen = new Map<string, number>()
  const keys: Record<string, string> = {}

  lines.forEach((line) => {
    const speaker = line.speakerEn || line.speakerZh || ''
    const text = line.en || line.zh || ''
    const baseKey = hashString([line.type, speaker, text].join('|'))
    const occurrence = seen.get(baseKey) || 0
    seen.set(baseKey, occurrence + 1)
    keys[line.id] = `${baseKey}:${occurrence}`
  })

  return keys
}

export function readStoredStudyState(storageKey: string): StoredQuestStudyState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredQuestStudyState>
    if (parsed.version !== STUDY_STORAGE_VERSION || !parsed.lines || typeof parsed.lines !== 'object') {
      return null
    }

    return {
      version: STUDY_STORAGE_VERSION,
      gameId: typeof parsed.gameId === 'string' ? parsed.gameId : '',
      questKey: typeof parsed.questKey === 'string' ? parsed.questKey : '',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
      lines: sanitizeStudyLines(parsed.lines),
    }
  } catch (caught) {
    console.warn('Unable to read GLearning study state.', caught)
    return null
  }
}

export function writeStoredStudyState(storageKey: string, gameId: string, questKey: string, lines: Record<string, LineStudyState>) {
  if (typeof window === 'undefined') return

  try {
    const payload: StoredQuestStudyState = {
      version: STUDY_STORAGE_VERSION,
      gameId,
      questKey,
      updatedAt: new Date().toISOString(),
      lines,
    }
    window.localStorage.setItem(storageKey, JSON.stringify(payload))
  } catch (caught) {
    console.warn('Unable to persist GLearning study state.', caught)
  }
}

export function readStoredSaves(): StoredSavedItems | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(SAVES_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredSavedItems>
    if (parsed.version !== SAVES_STORAGE_VERSION || !parsed.items || typeof parsed.items !== 'object') {
      return null
    }

    return {
      version: SAVES_STORAGE_VERSION,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
      items: sanitizeSavedItems(parsed.items),
    }
  } catch (caught) {
    console.warn('Unable to read GLearning saved items.', caught)
    return null
  }
}

export function writeStoredSaves(items: Record<string, SavedItem>) {
  if (typeof window === 'undefined') return

  try {
    const payload: StoredSavedItems = {
      version: SAVES_STORAGE_VERSION,
      updatedAt: new Date().toISOString(),
      items,
    }
    window.localStorage.setItem(SAVES_STORAGE_KEY, JSON.stringify(payload))
  } catch (caught) {
    console.warn('Unable to persist GLearning saved items.', caught)
  }
}

export function readStoredReviewItems(): StoredReviewItems | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(REVIEW_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredReviewItems>
    if (parsed.version !== REVIEW_STORAGE_VERSION || !parsed.items || typeof parsed.items !== 'object') {
      return null
    }

    return {
      version: REVIEW_STORAGE_VERSION,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
      items: sanitizeReviewItems(parsed.items),
    }
  } catch (caught) {
    console.warn('Unable to read GLearning review state.', caught)
    return null
  }
}

export function writeStoredReviewItems(items: Record<string, ReviewItemState>) {
  if (typeof window === 'undefined') return

  try {
    const payload: StoredReviewItems = {
      version: REVIEW_STORAGE_VERSION,
      updatedAt: new Date().toISOString(),
      items,
    }
    window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(payload))
  } catch (caught) {
    console.warn('Unable to persist GLearning review state.', caught)
  }
}

export function buildLocalDataSnapshot(savedItems: Record<string, SavedItem>, reviewItems: Record<string, ReviewItemState>): LocalDataSnapshot {
  const exportedAt = new Date().toISOString()
  const sanitizedSavedItems = sanitizeSavedItems(savedItems)
  const sanitizedReviewItems = sanitizeReviewItems(reviewItems)
  const savedValues = Object.values(sanitizedSavedItems)
  const studyStates = readAllStoredStudyStates()
  const preferences = readLocalSnapshotPreferences()

  return {
    app: 'GLearning',
    version: LOCAL_SNAPSHOT_VERSION,
    exportedAt,
    exportType: 'browser-local-json-snapshot',
    claims: {
      account: false,
      cloudSync: false,
      publicProfile: false,
      shareCards: false,
      restoreImport: false,
    },
    counts: {
      savedItems: savedValues.length,
      savedLines: savedValues.filter((item) => item.type === 'line').length,
      savedTerms: savedValues.filter((item) => item.type === 'term').length,
      reviewItems: Object.keys(sanitizedReviewItems).length,
      studyStates: studyStates.length,
      studyLines: studyStates.reduce((total, state) => total + Object.keys(state.lines).length, 0),
      preferences: (preferences.density ? 1 : 0) + preferences.palettes.length,
    },
    data: {
      saves: {
        version: SAVES_STORAGE_VERSION,
        updatedAt: exportedAt,
        items: sanitizedSavedItems,
      },
      reviews: {
        version: REVIEW_STORAGE_VERSION,
        updatedAt: exportedAt,
        items: sanitizedReviewItems,
      },
      studyStates,
      preferences,
    },
  }
}

function readAllStoredStudyStates() {
  if (typeof window === 'undefined') return []

  const studyStates: StoredQuestStudyState[] = []
  getLocalStorageKeys()
    .filter((key) => key.startsWith(`${STUDY_STORAGE_PREFIX}:`))
    .sort()
    .forEach((storageKey) => {
      const state = readStoredStudyState(storageKey)
      if (state) studyStates.push(state)
    })

  return studyStates
}

function readLocalSnapshotPreferences(): LocalSnapshotPreferenceExport {
  if (typeof window === 'undefined') return { palettes: [] }

  const savedDensity = safeLocalStorageGet(DENSITY_STORAGE_KEY)
  const palettePrefix = `${PALETTE_STORAGE_PREFIX}-`
  const palettes = getLocalStorageKeys()
    .filter((key) => key.startsWith(palettePrefix))
    .sort()
    .map((key) => ({ key, gameId: key.slice(palettePrefix.length), value: safeLocalStorageGet(key) || '' }))
    .filter((entry) => entry.value)

  return {
    ...(DENSITY_IDS.some((density) => density === savedDensity) ? { density: { key: DENSITY_STORAGE_KEY, value: savedDensity as DensityId } } : {}),
    palettes,
  }
}

function getLocalStorageKeys() {
  if (typeof window === 'undefined') return []

  try {
    return Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index)).filter(
      (key): key is string => typeof key === 'string',
    )
  } catch (caught) {
    console.warn('Unable to scan GLearning local storage keys.', caught)
    return []
  }
}

function safeLocalStorageGet(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch (caught) {
    console.warn(`Unable to read GLearning local storage key: ${key}`, caught)
    return null
  }
}

function sanitizeReviewItems(value: Record<string, ReviewItemState>) {
  const items: Record<string, ReviewItemState> = {}

  Object.entries(value).forEach(([id, state]) => {
    if (!state || typeof state !== 'object' || typeof state.dueAt !== 'string') return
    items[id] = {
      dueAt: state.dueAt,
      intervalMinutes: typeof state.intervalMinutes === 'number' && state.intervalMinutes > 0 ? state.intervalMinutes : REVIEW_AGAIN_MINUTES,
      ...(typeof state.reviewedAt === 'string' ? { reviewedAt: state.reviewedAt } : {}),
      ...(state.lastGrade === 'again' || state.lastGrade === 'know' ? { lastGrade: state.lastGrade } : {}),
    }
  })

  return items
}

export function getDueReviewItems(savedItems: SavedItem[], reviewItems: Record<string, ReviewItemState>, nowMs: number) {
  return savedItems
    .filter((item) => isReviewDue(item.id, reviewItems, nowMs))
    .sort((left, right) => getReviewDueMs(left.id, reviewItems) - getReviewDueMs(right.id, reviewItems) || right.updatedAt.localeCompare(left.updatedAt))
}

export function countDueReviewItems(savedItems: SavedItem[], reviewItems: Record<string, ReviewItemState>, nowMs: number) {
  return savedItems.filter((item) => isReviewDue(item.id, reviewItems, nowMs)).length
}

export function isReviewDue(itemId: string, reviewItems: Record<string, ReviewItemState>, nowMs: number) {
  return getReviewDueMs(itemId, reviewItems) <= nowMs
}

export function getReviewDueMs(itemId: string, reviewItems: Record<string, ReviewItemState>) {
  const dueAt = reviewItems[itemId]?.dueAt
  if (!dueAt) return 0
  const dueMs = Date.parse(dueAt)
  return Number.isFinite(dueMs) ? dueMs : 0
}

function optionalSavedString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function sanitizeSavedItems(value: Record<string, SavedItem>) {
  const items: Record<string, SavedItem> = {}

  Object.entries(value).forEach(([id, item]) => {
    if (!item || typeof item !== 'object' || (item.type !== 'line' && item.type !== 'term')) return
    if (typeof item.gameId !== 'string' || typeof item.questKey !== 'string') return

    if (item.type === 'line') {
      items[id] = {
        type: 'line',
        id: typeof item.id === 'string' ? item.id : id,
        gameId: item.gameId,
        questKey: item.questKey,
        lineKey: typeof item.lineKey === 'string' ? item.lineKey : '',
        lineId: typeof item.lineId === 'string' ? item.lineId : '',
        speakerEn: typeof item.speakerEn === 'string' ? item.speakerEn : '',
        speakerZh: typeof item.speakerZh === 'string' ? item.speakerZh : '',
        en: typeof item.en === 'string' ? item.en : '',
        zh: typeof item.zh === 'string' ? item.zh : '',
        ...(optionalSavedString(item.questTitle) ? { questTitle: optionalSavedString(item.questTitle) } : {}),
        ...(optionalSavedString(item.questZhTitle) ? { questZhTitle: optionalSavedString(item.questZhTitle) } : {}),
        ...(optionalSavedString(item.sourceEnUrl) ? { sourceEnUrl: optionalSavedString(item.sourceEnUrl) } : {}),
        ...(optionalSavedString(item.sourceZhUrl) ? { sourceZhUrl: optionalSavedString(item.sourceZhUrl) } : {}),
        savedAt: typeof item.savedAt === 'string' ? item.savedAt : '',
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : typeof item.savedAt === 'string' ? item.savedAt : '',
      }
      return
    }

    items[id] = {
      type: 'term',
      id: typeof item.id === 'string' ? item.id : id,
      gameId: item.gameId,
      questKey: item.questKey,
      en: typeof item.en === 'string' ? item.en : '',
      zh: typeof item.zh === 'string' ? item.zh : '',
      ...(optionalSavedString(item.questTitle) ? { questTitle: optionalSavedString(item.questTitle) } : {}),
      ...(optionalSavedString(item.questZhTitle) ? { questZhTitle: optionalSavedString(item.questZhTitle) } : {}),
      ...(optionalSavedString(item.sourceEnUrl) ? { sourceEnUrl: optionalSavedString(item.sourceEnUrl) } : {}),
      ...(optionalSavedString(item.sourceZhUrl) ? { sourceZhUrl: optionalSavedString(item.sourceZhUrl) } : {}),
      savedAt: typeof item.savedAt === 'string' ? item.savedAt : '',
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : typeof item.savedAt === 'string' ? item.savedAt : '',
    }
  })

  return items
}

export function getLineSaveId(gameId: string, questKey: string, lineKey: string | undefined) {
  return `${gameId}:${questKey}:line:${lineKey || ''}`
}

export function getTermSaveId(gameId: string, questKey: string, term: QuestTerm) {
  return `${gameId}:${questKey}:term:${hashString([term.en, term.zh].join('|'))}`
}

function sanitizeStudyLines(value: Record<string, LineStudyState>) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, state]) => state && typeof state === 'object')
      .map(([key, state]) => [
        key,
        {
          ...(typeof state.revealedAt === 'string' ? { revealedAt: state.revealedAt } : {}),
          ...(typeof state.firstPlayedAt === 'string' ? { firstPlayedAt: state.firstPlayedAt } : {}),
          ...(typeof state.lastPlayedAt === 'string' ? { lastPlayedAt: state.lastPlayedAt } : {}),
          ...(typeof state.playCount === 'number' ? { playCount: state.playCount } : {}),
          ...(typeof state.masteredAt === 'string' ? { masteredAt: state.masteredAt } : {}),
        },
      ]),
  )
}

function hashString(value: string) {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index)
  }
  return (hash >>> 0).toString(36)
}
