import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { GAMES } from './gameData'
import { buildLanguageHelp, type LanguageHelp } from './languageHelp'
import type { MainQuestCatalogResponse, MainQuestOption, PairConfidence, QuestLine, QuestResponse } from './types'

const DEFAULT_EN_URL = 'https://wutheringwaves.fandom.com/wiki/Utterance_of_Marvels:_I'
const DEFAULT_ZH_URL =
  'https://wiki.biligame.com/wutheringwaves/%E4%BB%BB%E5%8A%A1%E5%9B%9E%E9%A1%BE/%E4%B8%87%E8%B1%A1%E6%96%B0%E5%A3%B0%C2%B7%E4%B8%8A'
const PALETTE_STORAGE_PREFIX = 'glearning-palette'
const DENSITY_STORAGE_KEY = 'glearning-density'
const STUDY_STORAGE_VERSION = 1
const STUDY_STORAGE_PREFIX = `glearning-study-v${STUDY_STORAGE_VERSION}`
const SAVES_STORAGE_KEY = 'glearning-saves-v1'
const SAVES_STORAGE_VERSION = 1
const REVIEW_STORAGE_KEY = 'glearning-review-v1'
const REVIEW_STORAGE_VERSION = 1
const REVIEW_AGAIN_MINUTES = 10
const REVIEW_FIRST_KNOW_MINUTES = 60 * 24
const REVIEW_MAX_KNOW_MINUTES = 60 * 24 * 30
const LIVE_GAME_ID = 'wuwa'

const RIGHT_TABS = [
  { id: 'summary', label: 'Summary', note: 'Quest progress and source health.' },
  { id: 'study', label: 'Study', note: 'Search, speaker filter, glossary, and reveal mode.' },
  { id: 'sources', label: 'Sources', note: 'Swap English and Chinese wiki sources.' },
  { id: 'export', label: 'Export', note: 'Download Anki TSV and open source pages.' },
] as const

const DENSITIES = [
  { id: 'compact', label: '紧凑' },
  { id: 'standard', label: '标准' },
  { id: 'spacious', label: '宽松' },
] as const

type Game = (typeof GAMES)[number]
type GameId = Game['id']
type DensityId = (typeof DENSITIES)[number]['id']
type RightTabId = (typeof RIGHT_TABS)[number]['id']
type LineStudyStatus = 'unread' | 'heard' | 'mastered'
type AppRoute =
  | { page: 'home' }
  | { page: 'game'; gameId: GameId }
  | { page: 'saved' }

type LineStudyState = {
  revealedAt?: string
  firstPlayedAt?: string
  lastPlayedAt?: string
  playCount?: number
  masteredAt?: string
}

type StoredQuestStudyState = {
  version: typeof STUDY_STORAGE_VERSION
  gameId: string
  questKey: string
  updatedAt: string
  lines: Record<string, LineStudyState>
}

type SavedLineItem = {
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

type SavedTermItem = {
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

type SavedItem = SavedLineItem | SavedTermItem

type StoredSavedItems = {
  version: typeof SAVES_STORAGE_VERSION
  updatedAt: string
  items: Record<string, SavedItem>
}

type ReviewGrade = 'again' | 'know'

type ReviewItemState = {
  dueAt: string
  intervalMinutes: number
  reviewedAt?: string
  lastGrade?: ReviewGrade
}

type StoredReviewItems = {
  version: typeof REVIEW_STORAGE_VERSION
  updatedAt: string
  items: Record<string, ReviewItemState>
}

type GlossaryTerm = QuestResponse['terms'][number]

type QuestStudyIdentity = {
  questKey: string
  storageKey: string
}

type ReaderStats = {
  progress: number
  audioVisible: number
  unmatched: number
  low: number
  visible: number
  total: number
  played: number
  revealed: number
  mastered: number
  studyProgress: number
}

function App() {
  const [route, setRoute] = useState<AppRoute>(() => getInitialRoute())
  const isReaderRoute = route.page === 'game'
  const activeGame = useMemo(() => getGame(isReaderRoute ? route.gameId : LIVE_GAME_ID), [isReaderRoute, route])
  const isHome = route.page === 'home'
  const isSavedRoute = route.page === 'saved'
  const isLiveGame = isReaderRoute && activeGame.id === LIVE_GAME_ID
  const [enUrl, setEnUrl] = useState(DEFAULT_EN_URL)
  const [zhUrl, setZhUrl] = useState(DEFAULT_ZH_URL)
  const [questCatalog, setQuestCatalog] = useState<MainQuestOption[]>([])
  const [selectedQuestUrl, setSelectedQuestUrl] = useState(DEFAULT_EN_URL)
  const [catalogError, setCatalogError] = useState('')
  const [paletteId, setPaletteId] = useState('')
  const [density, setDensity] = useState<DensityId>(() => getInitialDensity())
  const [sidePanel, setSidePanel] = useState<RightTabId>('summary')
  const [selectedHelpLineId, setSelectedHelpLineId] = useState('')
  const [quest, setQuest] = useState<QuestResponse | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [speaker, setSpeaker] = useState('all')
  const [audioOnly, setAudioOnly] = useState(false)
  const [hideChinese, setHideChinese] = useState(false)
  const [lineStudyByKey, setLineStudyByKey] = useState<Record<string, LineStudyState>>({})
  const [loadedStudyStorageKey, setLoadedStudyStorageKey] = useState('')
  const [savedItemsById, setSavedItemsById] = useState<Record<string, SavedItem>>(() => readStoredSaves()?.items || {})
  const [reviewItemsById, setReviewItemsById] = useState<Record<string, ReviewItemState>>(() => readStoredReviewItems()?.items || {})
  const [reviewNowMs, setReviewNowMs] = useState(() => Date.now())

  const activePalette = activeGame.palettes.find((palette) => palette.id === paletteId) || activeGame.palettes[0]
  const readerData = useMemo(() => (isReaderRoute ? (isLiveGame ? quest : createSampleQuest(activeGame)) : null), [activeGame, isLiveGame, isReaderRoute, quest])
  const hasQuestAudio = Boolean(readerData?.meta.audioCount)
  const audioAvailabilityLabel = hasQuestAudio ? `${readerData?.meta.audioCount || 0} playable clips` : 'No playable clips yet'
  const audioAvailabilityHint = hasQuestAudio ? `Audio only · ${audioAvailabilityLabel}` : 'Audio-only unavailable · this sample has no playable clips yet.'
  const questStudyIdentity = useMemo(() => (readerData ? getQuestStudyIdentity(activeGame.id, readerData) : null), [activeGame.id, readerData])
  const lineStudyKeys = useMemo(() => (readerData ? buildLineStudyKeys(readerData.lines) : {}), [readerData])
  const activeQuestSavedItems = useMemo(
    () =>
      questStudyIdentity
        ? Object.values(savedItemsById)
            .filter((item) => item.gameId === activeGame.id && item.questKey === questStudyIdentity.questKey)
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        : [],
    [activeGame.id, questStudyIdentity, savedItemsById],
  )
  const activeGameSavedCount = useMemo(
    () => Object.values(savedItemsById).filter((item) => item.gameId === activeGame.id).length,
    [activeGame.id, savedItemsById],
  )
  const activeGameDueReviewCount = useMemo(
    () => countDueReviewItems(Object.values(savedItemsById).filter((item) => item.gameId === activeGame.id), reviewItemsById, reviewNowMs),
    [activeGame.id, reviewItemsById, reviewNowMs, savedItemsById],
  )
  const activeQuestDueReviewItems = useMemo(
    () => getDueReviewItems(activeQuestSavedItems, reviewItemsById, reviewNowMs),
    [activeQuestSavedItems, reviewItemsById, reviewNowMs],
  )
  const savedTermIds = useMemo(() => new Set(activeQuestSavedItems.filter((item) => item.type === 'term').map((item) => item.id)), [activeQuestSavedItems])
  const selectedLanguageHelp = useMemo(() => (readerData ? buildLanguageHelp(readerData, selectedHelpLineId) : null), [readerData, selectedHelpLineId])

  async function loadQuest(nextEnUrl = enUrl, nextZhUrl = zhUrl) {
    setIsLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({ enUrl: nextEnUrl, zhUrl: nextZhUrl })
      const response = await fetch(`/api/quest?${params}`)
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load quest pages.')
      }

      setQuest(payload)
      setEnUrl(payload.source.enUrl)
      setZhUrl(payload.source.zhUrl)
      setSelectedQuestUrl(payload.source.enUrl)
      setSearch('')
      setSpeaker('all')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unknown loading error')
      setQuest(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    function handleRouteChange() {
      setRoute(getRoute())
    }

    window.addEventListener('popstate', handleRouteChange)
    return () => window.removeEventListener('popstate', handleRouteChange)
  }, [])

  useEffect(() => {
    if (isLiveGame && !quest && !isLoading) {
      void loadQuest(DEFAULT_EN_URL, DEFAULT_ZH_URL)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLiveGame])

  useEffect(() => {
    async function loadCatalog() {
      try {
        const response = await fetch('/api/main-quests')
        const payload = (await response.json()) as MainQuestCatalogResponse & { error?: string }
        if (!response.ok) throw new Error(payload.error || 'Failed to load main quest list.')
        setQuestCatalog(payload.quests)
      } catch (caught) {
        setCatalogError(caught instanceof Error ? caught.message : 'Failed to load main quest list.')
      }
    }

    void loadCatalog()
  }, [])

  useEffect(() => {
    setPaletteId(getInitialPalette(activeGame))
  }, [activeGame])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.game = activeGame.id
    root.dataset.theme = activePalette.id
    document.body.dataset.game = activeGame.id
    root.style.setProperty('--bg', activePalette.bg)
    root.style.setProperty('--surface', activePalette.surface)
    root.style.setProperty('--surface-2', activePalette.surface)
    root.style.setProperty('--ink', activePalette.ink)
    root.style.setProperty('--muted', activePalette.muted)
    root.style.setProperty('--faint', activePalette.muted)
    root.style.setProperty('--accent', activePalette.accent)
    root.style.setProperty('--accent-2', activePalette.accent2)
    root.style.setProperty('--progress', activePalette.accent)
    root.style.setProperty('--due', activePalette.accent2)
    root.style.setProperty('--spine-heard', activePalette.accent2)
    root.style.setProperty('--spine-mastered', activePalette.accent)
    root.style.setProperty('--serif', activeGame.serif)
    root.style.setProperty('--sans', activeGame.sans)
    window.localStorage.setItem(getPaletteStorageKey(activeGame.id), activePalette.id)
  }, [activeGame, activePalette])

  useEffect(() => {
    document.documentElement.dataset.density = density
    window.localStorage.setItem(DENSITY_STORAGE_KEY, density)
  }, [density])

  useEffect(() => {
    setLoadedStudyStorageKey('')

    if (!questStudyIdentity) {
      setLineStudyByKey({})
      return
    }

    setLineStudyByKey(readStoredStudyState(questStudyIdentity.storageKey)?.lines || {})
    setLoadedStudyStorageKey(questStudyIdentity.storageKey)
  }, [questStudyIdentity])

  useEffect(() => {
    if (!questStudyIdentity || loadedStudyStorageKey !== questStudyIdentity.storageKey) return
    writeStoredStudyState(questStudyIdentity.storageKey, activeGame.id, questStudyIdentity.questKey, lineStudyByKey)
  }, [activeGame.id, lineStudyByKey, loadedStudyStorageKey, questStudyIdentity])

  useEffect(() => {
    writeStoredSaves(savedItemsById)
  }, [savedItemsById])

  useEffect(() => {
    writeStoredReviewItems(reviewItemsById)
  }, [reviewItemsById])

  useEffect(() => {
    const timer = window.setInterval(() => setReviewNowMs(Date.now()), 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    setReviewItemsById((current) => {
      const savedIds = new Set(Object.keys(savedItemsById))
      const next = Object.fromEntries(Object.entries(current).filter(([id]) => savedIds.has(id)))
      return Object.keys(next).length === Object.keys(current).length ? current : next
    })
  }, [savedItemsById])

  useEffect(() => {
    setSelectedHelpLineId('')
  }, [activeGame.id, questStudyIdentity?.questKey])

  useEffect(() => {
    if (!selectedHelpLineId || !readerData) return
    if (!readerData.lines.some((line) => line.id === selectedHelpLineId)) {
      setSelectedHelpLineId('')
    }
  }, [readerData, selectedHelpLineId])

  useEffect(() => {
    if (readerData && audioOnly && !hasQuestAudio) {
      setAudioOnly(false)
    }
  }, [audioOnly, hasQuestAudio, readerData])

  function updateLineStudy(lineKey: string | undefined, updater: (current: LineStudyState, now: string) => LineStudyState) {
    if (!lineKey) return
    setLineStudyByKey((current) => ({
      ...current,
      [lineKey]: updater(current[lineKey] || {}, new Date().toISOString()),
    }))
  }

  function markLineRevealed(lineKey: string | undefined) {
    updateLineStudy(lineKey, (current, now) => ({ ...current, revealedAt: current.revealedAt || now }))
  }

  function markLinePlayed(lineKey: string | undefined) {
    updateLineStudy(lineKey, (current, now) => ({
      ...current,
      firstPlayedAt: current.firstPlayedAt || now,
      lastPlayedAt: now,
      playCount: (current.playCount || 0) + 1,
    }))
  }

  function toggleLineMastered(lineKey: string | undefined) {
    updateLineStudy(lineKey, (current, now) => {
      const { masteredAt, ...rest } = current
      return masteredAt ? rest : { ...current, masteredAt: now }
    })
  }

  function toggleSavedLine(line: QuestLine, lineKey: string | undefined) {
    if (!questStudyIdentity || !lineKey) return
    const id = getLineSaveId(activeGame.id, questStudyIdentity.questKey, lineKey)
    if (savedItemsById[id]) removeReviewState(id)
    setSavedItemsById((current) => {
      if (current[id]) {
        const { [id]: removed, ...rest } = current
        void removed
        return rest
      }

      const now = new Date().toISOString()
      return {
        ...current,
        [id]: {
          type: 'line',
          id,
          gameId: activeGame.id,
          questKey: questStudyIdentity.questKey,
          lineKey,
          lineId: line.id,
          speakerEn: line.speakerEn || '',
          speakerZh: line.speakerZh || '',
          en: line.en,
          zh: line.zh,
          ...getSavedSourceMetadata(readerData),
          savedAt: now,
          updatedAt: now,
        },
      }
    })
  }

  function toggleSavedTerm(term: GlossaryTerm) {
    if (!questStudyIdentity) return
    const id = getTermSaveId(activeGame.id, questStudyIdentity.questKey, term)
    if (savedItemsById[id]) removeReviewState(id)
    setSavedItemsById((current) => {
      if (current[id]) {
        const { [id]: removed, ...rest } = current
        void removed
        return rest
      }

      const now = new Date().toISOString()
      return {
        ...current,
        [id]: {
          type: 'term',
          id,
          gameId: activeGame.id,
          questKey: questStudyIdentity.questKey,
          en: term.en,
          zh: term.zh,
          ...getSavedSourceMetadata(readerData),
          savedAt: now,
          updatedAt: now,
        },
      }
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadQuest()
  }

  function handleQuestSelect(nextEnUrl: string) {
    setSelectedQuestUrl(nextEnUrl)
    if (!nextEnUrl) return
    setEnUrl(nextEnUrl)
    setZhUrl('auto')
    void loadQuest(nextEnUrl, 'auto')
  }

  function removeReviewState(itemId: string) {
    setReviewItemsById((current) => {
      if (!current[itemId]) return current
      const { [itemId]: removed, ...rest } = current
      void removed
      return rest
    })
  }

  function removeSavedItem(itemId: string) {
    removeReviewState(itemId)
    setSavedItemsById((current) => {
      if (!current[itemId]) return current
      const { [itemId]: removed, ...rest } = current
      void removed
      return rest
    })
  }

  function gradeSavedReview(itemId: string, grade: ReviewGrade) {
    const now = new Date()
    const nowMs = now.getTime()
    setReviewNowMs(nowMs)
    setReviewItemsById((current) => {
      const currentInterval = current[itemId]?.intervalMinutes || 0
      const intervalMinutes =
        grade === 'again'
          ? REVIEW_AGAIN_MINUTES
          : currentInterval > REVIEW_AGAIN_MINUTES
            ? Math.min(currentInterval * 2, REVIEW_MAX_KNOW_MINUTES)
            : REVIEW_FIRST_KNOW_MINUTES

      return {
        ...current,
        [itemId]: {
          dueAt: new Date(nowMs + intervalMinutes * 60 * 1000).toISOString(),
          intervalMinutes,
          reviewedAt: now.toISOString(),
          lastGrade: grade,
        },
      }
    })
  }

  const speakers = useMemo(() => {
    if (!readerData) return []
    const labels = new Set<string>()
    readerData.lines.forEach((line) => {
      if (line.speakerEn || line.speakerZh) {
        labels.add(`${line.speakerEn || 'Unmatched'} / ${line.speakerZh || '未匹配'}`)
      }
    })
    return [...labels]
  }, [readerData])

  const filteredLines = useMemo(() => {
    if (!readerData) return []
    const normalizedSearch = search.trim().toLowerCase()

    return readerData.lines.filter((line) => {
      if (audioOnly && !line.audioUrl) return false
      if (speaker !== 'all' && `${line.speakerEn || 'Unmatched'} / ${line.speakerZh || '未匹配'}` !== speaker) {
        return false
      }
      if (!normalizedSearch) return true

      return [line.en, line.zh, line.speakerEn, line.speakerZh]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    })
  }, [audioOnly, readerData, search, speaker])

  const stats = useMemo((): ReaderStats => {
    if (!readerData) {
      return { progress: 0, audioVisible: 0, unmatched: 0, low: 0, visible: 0, total: 0, played: 0, revealed: 0, mastered: 0, studyProgress: 0 }
    }

    const played = readerData.lines.filter((line) => lineStudyByKey[lineStudyKeys[line.id]]?.firstPlayedAt).length
    const revealed = readerData.lines.filter((line) => lineStudyByKey[lineStudyKeys[line.id]]?.revealedAt).length
    const mastered = readerData.lines.filter((line) => lineStudyByKey[lineStudyKeys[line.id]]?.masteredAt).length

    return {
      progress: readerData.meta.enCount ? readerData.meta.pairedCount / readerData.meta.enCount : 0,
      audioVisible: filteredLines.filter((line) => line.audioUrl).length,
      unmatched: readerData.lines.filter((line) => line.confidence === 'unmatched').length,
      low: readerData.lines.filter((line) => line.confidence === 'low').length,
      visible: filteredLines.length,
      total: readerData.lines.length,
      played,
      revealed,
      mastered,
      studyProgress: readerData.lines.length ? mastered / readerData.lines.length : 0,
    }
  }, [filteredLines, lineStudyByKey, lineStudyKeys, readerData])

  const activeTab = RIGHT_TABS.find((tab) => tab.id === sidePanel) || RIGHT_TABS[0]

  function exportTsv() {
    if (!readerData) return
    const rows = readerData.lines.map((line) =>
      [line.speakerEn, line.en, line.speakerZh, line.zh, line.audioSourceUrl || line.audioUrl || '', line.confidence]
        .map(escapeTsv)
        .join('\t'),
    )
    const header = ['speaker_en', 'english', 'speaker_zh', 'chinese', 'audio_url', 'alignment'].join('\t')
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/tab-separated-values;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${readerData.meta.enTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-bilingual.tsv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  function navigateToGame(gameId: GameId) {
    window.history.pushState({}, '', `/games/${gameId}`)
    setRoute({ page: 'game', gameId })
    resetReaderControls()
  }

  function navigateHome() {
    window.history.pushState({}, '', '/')
    setRoute({ page: 'home' })
    resetReaderControls()
  }

  function navigateToSaved() {
    window.history.pushState({}, '', '/saved')
    setRoute({ page: 'saved' })
    resetReaderControls()
  }

  function resetReaderControls() {
    setSearch('')
    setSpeaker('all')
    setAudioOnly(false)
    setHideChinese(false)
  }

  if (isHome) {
    return <HomePage games={GAMES} onOpenGame={navigateToGame} onOpenSaved={navigateToSaved} />
  }

  if (isSavedRoute) {
    return (
      <GlobalSavedPage
        games={GAMES}
        savedItems={Object.values(savedItemsById)}
        reviewItemsById={reviewItemsById}
        reviewNowMs={reviewNowMs}
        onHome={navigateHome}
        onOpenGame={navigateToGame}
        onGradeReview={gradeSavedReview}
        onRemoveSavedItem={removeSavedItem}
      />
    )
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">G</div>
          <div className="brand-text">
            <div className="brand-name">GLearning · {activeGame.name}</div>
            <div className="brand-sub">{activeGame.studio} · {activeGame.cn} · game English</div>
          </div>
        </div>

        <GameTabs activeGame={activeGame} onPick={navigateToGame} />

        <div className="top-actions">
          <button className="icon-btn" type="button" data-hint="Game library" onClick={navigateHome}>
            ⌂
          </button>
          <button className="icon-btn" type="button" data-hint="Global saved library" onClick={navigateToSaved}>
            ★
          </button>
          <button className="icon-btn" type="button" data-hint={isLiveGame ? 'Load current URLs' : 'Sample reader'} onClick={() => void loadQuest()} disabled={!isLiveGame || isLoading}>
            {isLoading ? '…' : '↻'}
          </button>
          <button
            className={`icon-btn ${audioOnly && hasQuestAudio ? 'is-on' : ''}`}
            type="button"
            data-hint={audioAvailabilityHint}
            {...(hasQuestAudio ? { 'aria-pressed': audioOnly } : {})}
            disabled={!hasQuestAudio}
            onClick={() => {
              if (!hasQuestAudio) return
              setAudioOnly((value) => !value)
            }}
          >
            ♪
          </button>
          <button
            className={`icon-btn ${hideChinese ? 'is-on' : ''}`}
            type="button"
            data-hint="Hide Chinese"
            aria-pressed={hideChinese}
            onClick={() => setHideChinese((value) => !value)}
          >
            中
          </button>
        </div>
      </header>

      <main className="shell">
        <ReaderBackdrop game={activeGame} />
        <ReaderChrome game={activeGame} />
        <aside className="rail left-rail">
          <section className="source-panel game-switcher">
            <h4>Games <span className="pill">{GAMES.length}</span></h4>
            <div className="game-switch-list">
              {GAMES.map((game) => (
                <button
                  key={game.id}
                  className={`game-switch ${game.id === activeGame.id ? 'active' : ''}`}
                  type="button"
                  onClick={() => navigateToGame(game.id)}
                >
                  <span className="mini-glyph">{game.glyph}</span>
                  <span><b>{game.name}</b><small>{game.cn}</small></span>
                </button>
              ))}
            </div>
          </section>

          {isLiveGame ? (
            <form className="source-panel" onSubmit={handleSubmit}>
              <h4>Sources <span className="pill">live</span></h4>
              <label className="field">
                <span>Main quest</span>
                <select value={selectedQuestUrl} onChange={(event) => handleQuestSelect(event.target.value)}>
                  <option value="" disabled>
                    {questCatalog.length ? 'Choose a main quest...' : 'Loading main quests...'}
                  </option>
                  {groupQuestsByChapter(questCatalog).map(([chapter, options]) => (
                    <optgroup key={chapter} label={chapter}>
                      {options.map((option) => (
                        <option key={option.enUrl} value={option.enUrl}>
                          {option.act}: {option.title}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <em>{catalogError || `${questCatalog.length || 'All'} Fandom quests · Kuro auto match`}</em>
              </label>
              <button className="primary-btn" type="submit" disabled={isLoading}>
                {isLoading ? 'Syncing…' : 'Build reader'}
              </button>
            </form>
          ) : (
            <section className="source-panel">
              <h4>Sources <span className="pill">sample</span></h4>
              <p className="sample-note">
                This game page uses curated sample dialogue and glossary data. Reader/save/review/export/language-help flows are real; live source and playable-audio connectors are planned.
              </p>
            </section>
          )}

          <section className="rail-section">
            <h4>Reader density</h4>
            <div className="seg-row" role="radiogroup" aria-label="Reader density">
              {DENSITIES.map((option) => (
                <button
                  key={option.id}
                  className={`seg-pill ${density === option.id ? 'is-on' : ''}`}
                  type="button"
                  role="radio"
                  aria-checked={density === option.id}
                  onClick={() => setDensity(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="rail-section">
            <h4>Theme <span className="pill">{activeGame.cn}</span></h4>
            <div className="theme-grid" aria-label="Reader themes">
              {activeGame.palettes.map((option) => (
                <button
                  key={option.id}
                  className={`theme-card ${activePalette.id === option.id ? 'is-on' : ''}`}
                  type="button"
                  aria-pressed={activePalette.id === option.id}
                  onClick={() => setPaletteId(option.id)}
                >
                  <span>{option.name}</span>
                  <small>{option.cn}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="rail-section quest-index">
            <h4>Quest index <span className="pill">{isLiveGame ? questCatalog.length || '—' : activeGame.chapters.length}</span></h4>
            <div className="chapter-list">
              {isLiveGame
                ? questCatalog.slice(0, 18).map((option) => (
                    <button
                      key={option.enUrl}
                      className={`chapter-card ${selectedQuestUrl === option.enUrl ? 'active' : ''}`}
                      type="button"
                      onClick={() => handleQuestSelect(option.enUrl)}
                    >
                      <span className="chap-name">{option.title}</span>
                      <span className="chap-cn">{option.chapter} · {option.act}</span>
                    </button>
                  ))
                : activeGame.chapters.map((chapter, index) => {
                    const isCurrentSample = index === 0
                    return (
                      <button
                        key={chapter.id}
                        className={`chapter-card ${isCurrentSample ? 'active current-sample' : 'planned'}`}
                        type="button"
                        data-hint={isCurrentSample ? 'Current sample chapter' : 'Chapter routing planned'}
                        disabled
                      >
                        <span className="chap-name">{chapter.name}</span>
                        <span className="chap-cn">
                          {isCurrentSample
                            ? `${chapter.cn} · ${Math.round(chapter.progress * 100)}% prototype (sample)`
                            : `${chapter.cn} · planned`}
                        </span>
                      </button>
                    )
                  })}
            </div>
          </section>

          <div className="rail-footnote">
            <b>{isLiveGame ? '真实数据源' : 'Prototype page'}</b><br />
            {isLiveGame
              ? 'English from Fandom MediaWiki · Chinese auto pairs from Kuro Wiki · MP3 preferred when bundled.'
              : `${activeGame.name} uses curated sample study content today; live source and playable audio connectors are planned.`}
          </div>
        </aside>

        <section className="reader" aria-label="Bilingual dialogue reader">
          <div className="reader-inner">
            {error && <div className="error-banner">{error}</div>}
            {readerData?.warnings?.map((warning) => (
              <div className="warning-banner" key={warning}>
                {warning}
              </div>
            ))}

            <header className="reader-head">
              <div className="reader-deco" aria-hidden="true">
                <svg viewBox="0 0 320 320">
                  <circle cx="160" cy="160" r="104" />
                  <circle cx="160" cy="160" r="58" />
                  <path d="M160 34v252M34 160h252M72 72l176 176M248 72 72 248" />
                </svg>
              </div>
              <div className="reader-eyebrow"><span className="dot" />{isLiveGame ? 'Live quest dialogue' : 'Prototype reader'} · {activeGame.cn}</div>
              <h1 className="reader-title">{readerData?.meta.enTitle || `${activeGame.name} reader`}</h1>
              <span className="reader-cn">{readerData?.meta.zhTitle || activeGame.cnTagline}</span>
              <div className="reader-progress-tiny">
                <div className="bar" aria-hidden="true"><i style={{ width: `${Math.round(stats.progress * 100)}%` }} /></div>
                <span><b>{readerData?.meta.pairedCount || 0}</b> paired · {stats.audioVisible} audio visible · {stats.unmatched} unmatched</span>
              </div>
            </header>

            {readerData && (
              <>
                <section className="quest-context">
                  <div className="label">Quest context · {isLiveGame ? 'live parse' : 'sample set'}</div>
                  <p>
                    <b>Source:</b> {isLiveGame ? shortUrl(readerData.source.enUrl) : activeGame.studio}<br />
                    <b>Chinese:</b> {isLiveGame ? shortUrl(readerData.source.zhUrl) : activeGame.cn}<br />
                    <b>Audio:</b> {audioAvailabilityLabel}<br />
                    <b>Focus:</b> {isLiveGame ? 'review official lines after playing; no AI translation is used.' : 'practice with theme-matched sample lines until a live connector exists.'}
                  </p>
                </section>

                <section className="reader-tools" aria-label="Reader filters">
                  <label className="search-field">
                    <span>Search</span>
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tacet Field, 无音区..." />
                  </label>
                  <label className="search-field speaker-filter">
                    <span>Speaker</span>
                    <select value={speaker} onChange={(event) => setSpeaker(event.target.value)}>
                      <option value="all">All speakers</option>
                      {speakers.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </label>
                </section>

                <div className="stream" role="list" aria-label={`${readerData.meta.enTitle} dialogue`}>
                  {filteredLines.length ? (
                    filteredLines.map((line) => {
                      const lineStudyKey = lineStudyKeys[line.id]
                      return (
                        <DialogueCard
                          key={line.id}
                          line={line}
                          hideChinese={hideChinese}
                          studyState={lineStudyByKey[lineStudyKey] || {}}
                          isSaved={Boolean(questStudyIdentity && savedItemsById[getLineSaveId(activeGame.id, questStudyIdentity.questKey, lineStudyKey)])}
                          onReveal={() => markLineRevealed(lineStudyKey)}
                          onPlayed={() => markLinePlayed(lineStudyKey)}
                          onToggleMastered={() => toggleLineMastered(lineStudyKey)}
                          onToggleSaved={() => toggleSavedLine(line, lineStudyKey)}
                          isHelpOpen={selectedHelpLineId === line.id}
                          onOpenLanguageHelp={() => {
                            setSelectedHelpLineId(line.id)
                            setSidePanel('study')
                          }}
                        />
                      )
                    })
                  ) : (
                    <EmptyReaderState
                      audioOnly={audioOnly}
                      hasQuestAudio={hasQuestAudio}
                      hasActiveFilters={Boolean(search.trim()) || speaker !== 'all'}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        <aside className="rail right-rail">
          <div className="right-tabs">
            <div className="right-tab-row" role="tablist" aria-label="Study panels">
              {RIGHT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`right-tab ${sidePanel === tab.id ? 'is-on' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={sidePanel === tab.id}
                  onClick={() => setSidePanel(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="right-tab-note">{activeTab.note}</div>
          </div>

          {readerData && sidePanel === 'summary' && <SummaryPanel quest={readerData} stats={stats} game={activeGame} isLive={isLiveGame} />}
          {readerData && sidePanel === 'study' && (
            <StudyPanel
              quest={readerData}
              stats={stats}
              audioOnly={audioOnly}
              setAudioOnly={setAudioOnly}
              hasQuestAudio={hasQuestAudio}
              audioAvailabilityLabel={audioAvailabilityLabel}
              hideChinese={hideChinese}
              setHideChinese={setHideChinese}
              savedItems={activeQuestSavedItems}
              dueReviewItems={activeQuestDueReviewItems}
              savedTermIds={savedTermIds}
              gameId={activeGame.id}
              questKey={questStudyIdentity?.questKey || ''}
              languageHelp={selectedLanguageHelp}
              onToggleTerm={toggleSavedTerm}
              onGradeReview={gradeSavedReview}
              onClearLanguageHelp={() => setSelectedHelpLineId('')}
            />
          )}
          {sidePanel === 'sources' && isLiveGame && (
            <SourcesPanel
              enUrl={enUrl}
              zhUrl={zhUrl}
              setEnUrl={setEnUrl}
              setZhUrl={setZhUrl}
              onSubmit={handleSubmit}
              isLoading={isLoading}
            />
          )}
          {sidePanel === 'sources' && !isLiveGame && <SampleSourcesPanel game={activeGame} />}
          {readerData && sidePanel === 'export' && <ExportPanel quest={readerData} exportTsv={exportTsv} isLive={isLiveGame} />}
        </aside>
      </main>
      <ReaderDock
        game={activeGame}
        quest={readerData}
        stats={stats}
        isLive={isLiveGame}
        audioOnly={audioOnly}
        setAudioOnly={setAudioOnly}
        hasQuestAudio={hasQuestAudio}
        audioAvailabilityLabel={audioAvailabilityLabel}
        audioAvailabilityHint={audioAvailabilityHint}
        hideChinese={hideChinese}
        setHideChinese={setHideChinese}
        savedCount={activeGameSavedCount}
        dueReviewCount={activeGameDueReviewCount}
        onHome={navigateHome}
      />
    </>
  )
}

function HomePage({
  games,
  onOpenGame,
  onOpenSaved,
}: {
  games: readonly Game[]
  onOpenGame: (gameId: GameId) => void
  onOpenSaved: () => void
}) {
  const [selectedGameId, setSelectedGameId] = useState<GameId>('starrail')
  const selectedGame = getGame(selectedGameId)
  const isSelectedLiveGame = selectedGame.id === LIVE_GAME_ID
  const selectedPalette = selectedGame.palettes[0]

  useEffect(() => {
    const root = document.documentElement
    root.dataset.game = selectedGame.id
    document.body.dataset.game = selectedGame.id
    root.style.setProperty('--bg', selectedPalette.bg)
    root.style.setProperty('--surface', selectedPalette.surface)
    root.style.setProperty('--surface-2', selectedPalette.surface)
    root.style.setProperty('--ink', selectedPalette.ink)
    root.style.setProperty('--muted', selectedPalette.muted)
    root.style.setProperty('--faint', selectedPalette.muted)
    root.style.setProperty('--accent', selectedPalette.accent)
    root.style.setProperty('--accent-2', selectedPalette.accent2)
    root.style.setProperty('--serif', selectedGame.serif)
    root.style.setProperty('--sans', selectedGame.sans)
  }, [selectedGame, selectedPalette])

  return (
    <>
      <header className="topbar home-topbar">
        <div className="brand">
          <div className="brand-mark">{selectedGame.glyph}</div>
          <div className="brand-text">
            <div className="brand-name">GLearning · {selectedGame.cn}</div>
            <div className="brand-sub">{selectedGame.studio} · 学英语</div>
          </div>
        </div>
        <GameTabs activeGame={selectedGame} onPick={setSelectedGameId} />
        <div className="top-actions">
          <button className="icon-btn" type="button" data-hint="Daily timer planned" disabled>
            ◴
          </button>
          <button className="icon-btn" type="button" data-hint="Open local saved library" onClick={onOpenSaved}>
            ★
          </button>
          <button className="icon-btn" type="button" data-hint="Settings/profile planned" disabled>
            ⚙
          </button>
        </div>
      </header>

      <main className={`home-page landing-${selectedGame.motif}`}>
        <LandingBackdrop game={selectedGame} />
        <section className="home-hero">
          <div className="home-copy">
            <div className="home-kicker">● {isSelectedLiveGame ? 'Live game dialogue · source-aware pairing · no AI translation' : 'Prototype sample reader · curated study lines · live connector planned'}</div>
            <h1>Learn English <span>from {selectedGame.name}.</span></h1>
            <div className="home-hero-cn">{selectedGame.cnTagline}</div>
            <p>{isSelectedLiveGame ? '把你最熟的剧情，变成最高效的双语阅读课。官方/社区来源文本逐句对齐，尽量保留来源语音片段，不做 AI 翻译。' : '这是按游戏主题策划的 sample reader：双语阅读、保存、复习、导出、language help 都可用；真实来源连接器和语音覆盖会在后续迭代接入。'}</p>
            <div className="home-actions">
              <button className="primary-btn home-primary" type="button" onClick={() => onOpenGame(selectedGame.id)}>
                进入阅读器 → {selectedGame.chapters[0].cn}
              </button>
              <button className="mini-btn home-ghost" type="button" onClick={() => document.querySelector('.game-grid')?.scrollIntoView({ behavior: 'smooth' })}>
                浏览所有章节
              </button>
            </div>
            <div className="landing-stats" aria-label="Study stats">
              {isSelectedLiveGame ? (
                <>
                  <div><b>Live</b><span>connector</span></div>
                  <div><b>Bundled</b><span>source clips</span></div>
                  <div><b>{selectedGame.glossary.length}</b><span>core terms</span></div>
                </>
              ) : (
                <>
                  <div><b>{selectedGame.sample.length}</b><span>sample lines</span></div>
                  <div><b>0</b><span>playable clips</span></div>
                  <div><b>{selectedGame.glossary.length}</b><span>sample terms</span></div>
                </>
              )}
            </div>
          </div>
          <button className="home-poster" type="button" onClick={() => onOpenGame(selectedGame.id)}>
            <span className="poster-badge">{selectedGame.id === LIVE_GAME_ID ? 'live API' : selectedGame.palettes[0].name}</span>
            <span className="poster-glyph">{selectedGame.glyph}</span>
            <span className="poster-frame" />
            <span className="poster-ornaments" aria-hidden="true">
              <i>✦</i><i>♪</i><i>✧</i><i>♫</i><i>★</i>
            </span>
            <span className="poster-object" aria-hidden="true" />
            <span className="poster-meta">
              <small>Now reading · 当前章节 · {selectedGame.studio}</small>
              <b>{selectedGame.chapters[0].name}</b>
              <em>{selectedGame.chapters[0].cn}</em>
            </span>
          </button>
        </section>

        <section className="game-grid" aria-label="Game pages">
          {games.map((game, index) => (
            <article className="game-card" key={game.id} style={{ animationDelay: `${index * 55}ms` }}>
              <button className="game-card-link" type="button" data-glyph={game.glyph} onClick={() => onOpenGame(game.id)}>
                <span className="game-card-glyph">{game.glyph}</span>
                <span className="game-card-body">
                  <span className="game-card-kicker">{game.studio}</span>
                  <span className="game-card-title">{game.name}</span>
                  <span className="game-card-cn">{game.cn} · {game.cnTagline}</span>
                  <span className="game-card-progress">
                    <i style={{ width: `${Math.round(game.chapters[0].progress * 100)}%` }} />
                  </span>
                  <span className="game-card-meta">{game.chapters.length} chapters · {game.glossary.length} terms · {game.id === LIVE_GAME_ID ? 'live Wuwa connector' : 'sample reader · connector planned'}</span>
                </span>
              </button>
            </article>
          ))}
        </section>

        <section className="home-features" aria-label="Reader features">
          <div className="home-features-head">
            <h2>A reader that keeps the world on-screen.</h2>
            <p>Borrowed from the Glearning2 prototype: atmospheric backdrops, strong game motifs, and study controls that stay close to the dialogue.</p>
          </div>
          <div className="feature-grid">
            {[
              ['01', 'World-specific pages', 'Every game has its own route, palette set, chapter rail, and glossary mood.'],
              ['02', 'Official-first study', 'Wuthering Waves keeps live Fandom + Kuro pairing, local MP3 preference, and export.'],
              ['03', 'Prototype-ready expansion', 'Other games use curated sample lines now without pretending to be live connectors.'],
            ].map(([num, title, body]) => (
              <article className="feature-card" key={num} data-index={num}>
                <span>{num}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  )
}

function GameTabs({ activeGame, onPick }: { activeGame: Game; onPick: (gameId: GameId) => void }) {
  return (
    <nav className="game-tabs" aria-label="Game pages">
      {GAMES.map((game) => (
        <button key={game.id} className={`game-tab ${game.id === activeGame.id ? 'is-active' : ''}`} type="button" onClick={() => onPick(game.id)}>
          <span>{game.glyph}</span>
          <b>{game.cn}</b>
        </button>
      ))}
    </nav>
  )
}

function GlobalSavedPage({
  games,
  savedItems,
  reviewItemsById,
  reviewNowMs,
  onHome,
  onOpenGame,
  onGradeReview,
  onRemoveSavedItem,
}: {
  games: readonly Game[]
  savedItems: SavedItem[]
  reviewItemsById: Record<string, ReviewItemState>
  reviewNowMs: number
  onHome: () => void
  onOpenGame: (gameId: GameId) => void
  onGradeReview: (itemId: string, grade: ReviewGrade) => void
  onRemoveSavedItem: (itemId: string) => void
}) {
  const [gameFilter, setGameFilter] = useState<'all' | GameId>('all')
  const [kindFilter, setKindFilter] = useState<'all' | SavedItem['type']>('all')
  const [dueFilter, setDueFilter] = useState<'all' | 'due'>('all')
  const [search, setSearch] = useState('')
  const [showReviewAnswer, setShowReviewAnswer] = useState(false)
  const gameById = useMemo(() => new Map<string, Game>(games.map((game) => [game.id, game])), [games])
  const dueItems = useMemo(() => getDueReviewItems(savedItems, reviewItemsById, reviewNowMs), [reviewItemsById, reviewNowMs, savedItems])
  const activeReviewItem = dueItems[0]
  const savedLines = savedItems.filter((item) => item.type === 'line').length
  const savedTerms = savedItems.length - savedLines
  const representedGames = new Set(savedItems.map((item) => item.gameId)).size
  const normalizedSearch = search.trim().toLowerCase()

  const filteredItems = useMemo(() => {
    return savedItems
      .filter((item) => {
        const game = gameById.get(item.gameId)
        if (gameFilter !== 'all' && item.gameId !== gameFilter) return false
        if (kindFilter !== 'all' && item.type !== kindFilter) return false
        if (dueFilter === 'due' && !isReviewDue(item.id, reviewItemsById, reviewNowMs)) return false
        if (!normalizedSearch) return true
        return getSavedItemSearchText(item, game).includes(normalizedSearch)
      })
      .sort((left, right) => sortSavedItemsForLibrary(left, right, reviewItemsById, reviewNowMs))
  }, [dueFilter, gameById, gameFilter, kindFilter, normalizedSearch, reviewItemsById, reviewNowMs, savedItems])

  useEffect(() => {
    setShowReviewAnswer(false)
  }, [activeReviewItem?.id])

  function gradeReview(grade: ReviewGrade) {
    if (!activeReviewItem) return
    onGradeReview(activeReviewItem.id, grade)
    setShowReviewAnswer(false)
  }

  return (
    <>
      <header className="topbar saved-topbar">
        <div className="brand">
          <div className="brand-mark">★</div>
          <div className="brand-text">
            <div className="brand-name">GLearning · Saved</div>
            <div className="brand-sub">Local saved lines, terms, and reviews</div>
          </div>
        </div>
        <GameTabs activeGame={getGame(LIVE_GAME_ID)} onPick={onOpenGame} />
        <div className="top-actions">
          <button className="icon-btn" type="button" data-hint="Game library" onClick={onHome}>
            ⌂
          </button>
        </div>
      </header>

      <main className="saved-page">
        <LandingBackdrop game={getGame(LIVE_GAME_ID)} />
        <section className="saved-hero">
          <div>
            <div className="home-kicker">● Local-only library · no account or cloud sync</div>
            <h1>Saved lines & review queue.</h1>
            <p>
              Browse saved dialogue lines and glossary terms across game pages in this browser. Quest restore is planned; this MVP opens the game reader and keeps saved/review data local.
            </p>
          </div>
          <div className="saved-summary-grid" aria-label="Saved library totals">
            <div><b>{savedItems.length}</b><span>Total saved</span></div>
            <div><b>{dueItems.length}</b><span>Due now</span></div>
            <div><b>{savedLines}</b><span>Lines</span></div>
            <div><b>{savedTerms}</b><span>Terms</span></div>
            <div><b>{representedGames}</b><span>Games</span></div>
          </div>
        </section>

        <section className="saved-library-grid">
          <section className="panel review-panel saved-review-spotlight">
            <h4>First due review · 复习 <span className="pill">{dueItems.length} due</span></h4>
            {activeReviewItem ? (
              <div className="review-card" aria-live="polite">
                <div className="review-kicker">
                  <span className={`saved-type ${activeReviewItem.type}`}>{activeReviewItem.type === 'line' ? 'Line' : 'Term'}</span>
                  <small>{getSavedItemGameLabel(activeReviewItem, gameById.get(activeReviewItem.gameId))} · {getSavedItemQuestLabel(activeReviewItem)}</small>
                </div>
                <p className="review-prompt">{getSavedItemPrompt(activeReviewItem)}</p>
                {showReviewAnswer ? (
                  <>
                    <div className="review-answer">
                      <span>Answer</span>
                      <b>{getSavedItemAnswer(activeReviewItem)}</b>
                    </div>
                    <div className="review-actions">
                      <button className="act-btn again-btn" type="button" onClick={() => gradeReview('again')}>Again · 10m</button>
                      <button className="act-btn know-btn" type="button" onClick={() => gradeReview('know')}>Know · later</button>
                    </div>
                  </>
                ) : (
                  <button className="primary-btn review-show" type="button" onClick={() => setShowReviewAnswer(true)}>Show answer</button>
                )}
              </div>
            ) : (
              <p className="saved-empty">No saved lines or terms are due right now. New saved items appear here until reviewed.</p>
            )}
            <p className="review-note">Uses the existing local schedule: Again is about 10 minutes; Know starts at 1 day and grows later.</p>
          </section>

          <section className="panel saved-filter-panel">
            <h4>Browse saved · 筛选 <span className="pill">{filteredItems.length}</span></h4>
            <div className="saved-filter-row">
              <label className="search-field">
                <span>Search</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="speaker, quest, English, 中文..." />
              </label>
              <label className="search-field">
                <span>Game</span>
                <select value={gameFilter} onChange={(event) => setGameFilter(event.target.value as 'all' | GameId)}>
                  <option value="all">All games</option>
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>{game.name} · {game.cn}</option>
                  ))}
                </select>
              </label>
              <label className="search-field">
                <span>Type</span>
                <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as 'all' | SavedItem['type'])}>
                  <option value="all">All</option>
                  <option value="line">Lines</option>
                  <option value="term">Terms</option>
                </select>
              </label>
              <label className="search-field">
                <span>Due</span>
                <select value={dueFilter} onChange={(event) => setDueFilter(event.target.value as 'all' | 'due')}>
                  <option value="all">All saved</option>
                  <option value="due">Due now</option>
                </select>
              </label>
            </div>
          </section>
        </section>

        <section className="global-saved-list" aria-label="Global saved items">
          {filteredItems.length ? (
            filteredItems.map((item) => {
              const game = gameById.get(item.gameId)
              const dueStatus = getSavedItemDueStatus(item, reviewItemsById, reviewNowMs)
              return (
                <article className="global-saved-card" key={item.id}>
                  <div className="global-saved-card-header">
                    <div className="saved-game-chip">
                      <span>{game?.glyph || 'G'}</span>
                      <b>{getSavedItemGameLabel(item, game)}</b>
                      <small>{game?.cn || item.gameId}</small>
                    </div>
                    <span className={`saved-type ${item.type}`}>{item.type === 'line' ? 'Line' : 'Term'}</span>
                    <span className={`saved-due-pill ${dueStatus.tone}`}>{dueStatus.label}</span>
                  </div>
                  <div className="global-saved-card-body">
                    <small>{getSavedItemQuestLabel(item)}{dueStatus.detail ? ` · ${dueStatus.detail}` : ''}</small>
                    <h3>{getSavedItemPrompt(item)}</h3>
                    <p>{getSavedItemAnswer(item)}</p>
                    {item.type === 'line' && (item.speakerEn || item.speakerZh) && <em>{item.speakerEn || item.speakerZh}</em>}
                    {(isWebUrl(item.sourceEnUrl) || isWebUrl(item.sourceZhUrl)) && (
                      <div className="saved-source-links">
                        {isWebUrl(item.sourceEnUrl) && <a href={item.sourceEnUrl} target="_blank" rel="noreferrer">EN source</a>}
                        {isWebUrl(item.sourceZhUrl) && <a href={item.sourceZhUrl} target="_blank" rel="noreferrer">ZH source</a>}
                      </div>
                    )}
                  </div>
                  <div className="global-saved-card-actions">
                    <button className="mini-btn primary" type="button" onClick={() => onOpenGame((game?.id || LIVE_GAME_ID) as GameId)}>Open game</button>
                    <button className="mini-btn danger" type="button" onClick={() => onRemoveSavedItem(item.id)}>Remove</button>
                  </div>
                </article>
              )
            })
          ) : (
            <div className="saved-empty-state">
              <div className="empty-glyph" aria-hidden="true">★</div>
              <div>
                <h3>No saved items match.</h3>
                <p>Save a dialogue line or glossary term in any reader, or relax the current filters. Data stays in this browser only.</p>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  )
}

function LandingBackdrop({ game }: { game: Game }) {
  return (
    <div className={`landing-backdrop motif-${game.motif}`} aria-hidden="true">
      <span className="landing-label a">{game.motif === 'zzz' ? '[ NEW ERIDU // SECTOR-7 ]' : 'ASTRAL EXPRESS // CAR-03 //. PATH OF TRAILBLAZE'}</span>
      <span className="landing-label b">{game.motif === 'zzz' ? 'CAUTION · 注意 · CAUTION' : '△ STELLARON · DETECTED'}</span>
      <span className="landing-line l1" />
      <span className="landing-line l2" />
      <span className="landing-star s1">✦</span>
      <span className="landing-star s2">✧</span>
      <span className="landing-star s3">★</span>
      <span className="landing-note n1">♪</span>
      <span className="landing-note n2">♫</span>
      <span className="landing-horizon" />
    </div>
  )
}

function ReaderBackdrop({ game }: { game: Game }) {
  return (
    <div className={`reader-backdrop motif-${game.motif}`} aria-hidden="true">
      <div className="backdrop-orb orb-a" />
      <div className="backdrop-orb orb-b" />
      <div className="backdrop-grid" />
      <div className="backdrop-glyph">{game.glyph}</div>
      <span className="reader-float f1">✦</span>
      <span className="reader-float f2">♪</span>
      <span className="reader-float f3">♫</span>
      <span className="reader-float f4">✧</span>
      <span className="reader-status-copy">{game.motif === 'zzz' ? 'CAUTION · 注意 · HOLLOW ZONE' : 'NOW READING · 当前章节 · GAME DIALOGUE'}</span>
    </div>
  )
}

function ReaderChrome({ game }: { game: Game }) {
  return (
    <div className={`reader-chrome chrome-${game.motif}`} aria-hidden="true">
      <span className="chrome-corner tl" />
      <span className="chrome-corner tr" />
      <span className="chrome-corner bl" />
      <span className="chrome-corner br" />
      <span className="chrome-tag tl">{game.cn}</span>
      <span className="chrome-tag tr">{game.studio}</span>
      <span className="chrome-rule" />
    </div>
  )
}

function ReaderDock({
  game,
  quest,
  stats,
  isLive,
  audioOnly,
  setAudioOnly,
  hasQuestAudio,
  audioAvailabilityLabel,
  audioAvailabilityHint,
  hideChinese,
  setHideChinese,
  savedCount,
  dueReviewCount,
  onHome,
}: {
  game: Game
  quest: QuestResponse | null
  stats: ReaderStats
  isLive: boolean
  audioOnly: boolean
  setAudioOnly: (value: boolean) => void
  hasQuestAudio: boolean
  audioAvailabilityLabel: string
  audioAvailabilityHint: string
  hideChinese: boolean
  setHideChinese: (value: boolean) => void
  savedCount: number
  dueReviewCount: number
  onHome: () => void
}) {
  return (
    <nav className="reader-dock" aria-label="Reader quick controls">
      <button className="dock-btn ghost" type="button" onClick={onHome}>Library</button>
      <div className="dock-meter" aria-label="Reading progress">
        <span>{game.glyph}</span>
        <i><b style={{ width: `${Math.round(stats.progress * 100)}%` }} /></i>
        <small>{quest?.meta.pairedCount || 0}/{quest?.meta.enCount || 0} · {isLive ? 'live' : 'sample'}</small>
      </div>
      <button
        className={`dock-btn ${audioOnly && hasQuestAudio ? 'is-on' : ''}`}
        type="button"
        title={audioAvailabilityHint}
        {...(hasQuestAudio ? { 'aria-pressed': audioOnly } : {})}
        disabled={!hasQuestAudio}
        onClick={() => {
          if (!hasQuestAudio) return
          setAudioOnly(!audioOnly)
        }}
      >
        {hasQuestAudio ? 'Audio only' : 'No audio'}
      </button>
      <button className={`dock-btn ${hideChinese ? 'is-on' : ''}`} type="button" onClick={() => setHideChinese(!hideChinese)}>Hide CN</button>
      <span className={`dock-review ${dueReviewCount ? 'is-due' : ''}`}>{dueReviewCount} due</span>
      <span className="dock-stat">{stats.visible} visible · {stats.played} played · {stats.mastered} mastered · {savedCount} saved · {audioAvailabilityLabel}</span>
    </nav>
  )
}

function EmptyReaderState({
  audioOnly,
  hasQuestAudio,
  hasActiveFilters,
}: {
  audioOnly: boolean
  hasQuestAudio: boolean
  hasActiveFilters: boolean
}) {
  const copy = (() => {
    if (audioOnly && !hasQuestAudio) {
      return {
        title: 'No audio clips are available yet.',
        body: 'This quest or sample does not currently include playable source clips, so audio-only mode cannot show dialogue lines.',
      }
    }

    if (audioOnly && hasQuestAudio) {
      return {
        title: 'No audio lines match current filters.',
        body: 'Try clearing search or speaker filters, or turn off Audio only to see every dialogue line.',
      }
    }

    if (hasActiveFilters) {
      return {
        title: 'No dialogue lines match filters.',
        body: 'Try a different search term or choose All speakers.',
      }
    }

    return {
      title: 'No dialogue lines loaded.',
      body: 'Load a quest source or switch to a sample game page with dialogue content.',
    }
  })()

  return (
    <div className="reader-empty-state" role="status">
      <div className="empty-glyph" aria-hidden="true">♪</div>
      <div>
        <h3>{copy.title}</h3>
        <p>{copy.body}</p>
      </div>
    </div>
  )
}

function SummaryPanel({
  quest,
  stats,
  game,
  isLive,
}: {
  quest: QuestResponse
  stats: ReaderStats
  game: Game
  isLive: boolean
}) {
  return (
    <>
      <section className="panel today-panel">
        <h4>Today · 当前任务 <span className="pill">{isLive ? 'live' : 'sample'}</span></h4>
        <div className="today-score">
          <div className="today-main"><small>Paired lines</small>{quest.meta.pairedCount}/{quest.meta.enCount}</div>
          <div className="streak-badge">♪ {quest.meta.audioCount} audio</div>
        </div>
        <div className="goal-bar" aria-hidden="true"><i style={{ width: `${Math.round((quest.meta.pairedCount / quest.meta.enCount) * 100)}%` }} /></div>
        <div className="goal-grid">
          <div className="goal-tile"><b>{stats.visible}</b><span>visible</span></div>
          <div className="goal-tile"><b>{stats.audioVisible}</b><span>audio shown</span></div>
          <div className="goal-tile"><b>{stats.unmatched}</b><span>unmatched</span></div>
          <div className="goal-tile study-tile"><b>{stats.played}</b><span>played</span></div>
          <div className="goal-tile study-tile"><b>{stats.revealed}</b><span>revealed</span></div>
          <div className="goal-tile study-tile"><b>{stats.mastered}</b><span>mastered</span></div>
        </div>
      </section>

      <section className="panel game-dossier">
        <h4>World · 游戏世界 <span className="pill">{game.studio}</span></h4>
        <div className="game-hero-row">
          <div className="game-glyph">{game.glyph}</div>
          <div>
            <div className="game-title">{game.name}</div>
            <div className="game-cn">{game.cn} · {game.tagline}</div>
          </div>
        </div>
        <div className="palette-row" aria-hidden="true">
          <i className="swatch swatch-1" />
          <i className="swatch swatch-2" />
          <i className="swatch swatch-3" />
          <i className="swatch swatch-4" />
        </div>
        <div className="game-meta-grid">
          <div className="game-meta"><b>{quest.meta.zhCount}</b><span>Chinese</span></div>
          <div className="game-meta"><b>{quest.terms.length}</b><span>terms</span></div>
          <div className="game-meta"><b>{isLive ? 'live' : 'mock'}</b><span>source</span></div>
        </div>
      </section>
    </>
  )
}

function StudyPanel({
  quest,
  stats,
  audioOnly,
  setAudioOnly,
  hasQuestAudio,
  audioAvailabilityLabel,
  hideChinese,
  setHideChinese,
  savedItems,
  dueReviewItems,
  savedTermIds,
  onToggleTerm,
  onGradeReview,
  gameId,
  questKey,
  languageHelp,
  onClearLanguageHelp,
}: {
  quest: QuestResponse
  stats: ReaderStats
  audioOnly: boolean
  setAudioOnly: (value: boolean) => void
  hasQuestAudio: boolean
  audioAvailabilityLabel: string
  hideChinese: boolean
  setHideChinese: (value: boolean) => void
  savedItems: SavedItem[]
  dueReviewItems: SavedItem[]
  savedTermIds: Set<string>
  onToggleTerm: (term: GlossaryTerm) => void
  onGradeReview: (itemId: string, grade: ReviewGrade) => void
  gameId: string
  questKey: string
  languageHelp: LanguageHelp | null
  onClearLanguageHelp: () => void
}) {
  const recentSavedItems = savedItems.slice(0, 5)
  const activeReviewItem = dueReviewItems[0]
  const [showReviewAnswer, setShowReviewAnswer] = useState(false)

  useEffect(() => {
    setShowReviewAnswer(false)
  }, [activeReviewItem?.id])

  function gradeReview(grade: ReviewGrade) {
    if (!activeReviewItem) return
    onGradeReview(activeReviewItem.id, grade)
    setShowReviewAnswer(false)
  }

  return (
    <>
      <section className="panel due">
        <h4><span className="pulse" aria-hidden="true" /> Study loop <span className="pill">local</span></h4>
        <div className="study-progress-card" aria-label="Local study progress">
          <div className="study-progress-top">
            <span>Study progress</span>
            <b>{stats.mastered}/{stats.total}</b>
          </div>
          <div className="goal-bar" aria-hidden="true"><i style={{ width: `${Math.round(stats.studyProgress * 100)}%` }} /></div>
          <div className="study-count-row">
            <span>{stats.played} played</span>
            <span>{stats.revealed} revealed</span>
            <span>{stats.mastered} mastered</span>
          </div>
        </div>
        <div className="toggle-line">
          <span>Audio lines only · 只看有语音的句子</span>
          <button
            className={`toggle ${audioOnly && hasQuestAudio ? 'is-on' : ''}`}
            type="button"
            aria-pressed={audioOnly && hasQuestAudio}
            aria-describedby="audio-availability-note"
            disabled={!hasQuestAudio}
            onClick={() => {
              if (!hasQuestAudio) return
              setAudioOnly(!audioOnly)
            }}
          >
            <i />
          </button>
        </div>
        <p className="audio-availability-note" id="audio-availability-note">
          {hasQuestAudio
            ? `${audioAvailabilityLabel} · audio-only filters to dialogue lines with playable source clips.`
            : 'Audio-only unavailable · this sample has no playable clips yet.'}
        </p>
        <p className="voice-honesty-note">
          Voice practice is deferred for launch; current MVP is listening playback from available source clips.
        </p>
        <div className="toggle-line">
          <span>Hide Chinese first · 点击单句显示中文</span>
          <button className={`toggle ${hideChinese ? 'is-on' : ''}`} type="button" aria-pressed={hideChinese} onClick={() => setHideChinese(!hideChinese)}><i /></button>
        </div>
      </section>

      <LanguageHelpPanel help={languageHelp} onClear={onClearLanguageHelp} />

      <section className="panel saved-summary">
        <h4>Saved · 收藏 <span className="pill">{savedItems.length}</span></h4>
        <p className="saved-copy">
          Saved lines and terms stay in this browser for this game quest. Items with no review history are due now.
        </p>
        {recentSavedItems.length ? (
          <div className="saved-list" aria-label="Recent saved items">
            {recentSavedItems.map((item) => (
              <div className="saved-item" key={item.id}>
                <span className={`saved-type ${item.type}`}>{item.type === 'line' ? 'Line' : 'Term'}</span>
                <div>
                  <b>{item.type === 'line' ? item.en || item.zh : item.en}</b>
                  <small>{item.type === 'line' ? item.speakerEn || item.speakerZh || 'Saved dialogue' : item.zh}</small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="saved-empty">Use ★ on dialogue or glossary terms to build a local save list.</p>
        )}
      </section>

      <section className="panel review-panel">
        <h4>Review queue · 复习 <span className="pill">{dueReviewItems.length} due</span></h4>
        {activeReviewItem ? (
          <div className="review-card" aria-live="polite">
            <div className="review-kicker">
              <span className={`saved-type ${activeReviewItem.type}`}>{activeReviewItem.type === 'line' ? 'Line' : 'Term'}</span>
              <small>{activeReviewItem.type === 'line' ? activeReviewItem.speakerEn || activeReviewItem.speakerZh || 'Saved dialogue' : 'Saved glossary'}</small>
            </div>
            <p className="review-prompt">{activeReviewItem.type === 'line' ? activeReviewItem.en || activeReviewItem.zh : activeReviewItem.en}</p>
            {showReviewAnswer ? (
              <>
                <div className="review-answer">
                  <span>Answer</span>
                  <b>{activeReviewItem.type === 'line' ? activeReviewItem.zh || activeReviewItem.en : activeReviewItem.zh}</b>
                </div>
                <div className="review-actions">
                  <button className="act-btn again-btn" type="button" onClick={() => gradeReview('again')}>Again · 10m</button>
                  <button className="act-btn know-btn" type="button" onClick={() => gradeReview('know')}>Know · later</button>
                </div>
              </>
            ) : (
              <button className="primary-btn review-show" type="button" onClick={() => setShowReviewAnswer(true)}>Show answer</button>
            )}
          </div>
        ) : (
          <p className="saved-empty">No due saved lines or terms right now. Save another item, or come back when scheduled reviews mature.</p>
        )}
        <p className="review-note">Local MVP: Again schedules about 10 minutes out; Know starts at 1 day and grows with each correct review.</p>
      </section>

      <section className="panel saved">
        <h4>Glossary · 关键词 <span className="pill">{quest.terms.length}</span></h4>
        <div className="gloss-list">
          {quest.terms.map((term) => {
            const termSaveId = getTermSaveId(gameId, questKey, term)
            const isSaved = savedTermIds.has(termSaveId)
            return (
              <div className="gloss-row" key={term.en}>
                <div>
                  <div className="gloss-en">{term.en}</div>
                  <span className="gloss-meta">source term</span>
                </div>
                <div className="gloss-actions">
                  <div className="gloss-cn">{term.zh}</div>
                  <button className={`term-save ${isSaved ? 'is-on' : ''}`} type="button" aria-pressed={isSaved} onClick={() => onToggleTerm(term)}>
                    {isSaved ? '★ Saved' : '☆ Save'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}

function LanguageHelpPanel({ help, onClear }: { help: LanguageHelp | null; onClear: () => void }) {
  if (!help) {
    return (
      <section className="panel language-help-panel">
        <h4>Language help · 句子提示 <span className="pill">local</span></h4>
        <p className="saved-empty">Pick <b>Language help</b> on any dialogue line to see deterministic source terms, key chunks, grammar pattern cards, and one reading strategy here.</p>
        <p className="help-disclaimer">Fully local rules only — no fetch, AI grammar parser, external dictionary lookup, or saved/review state changes.</p>
      </section>
    )
  }

  const { line, terms, keyChunks, patterns, readingStrategy } = help

  return (
    <section className="panel language-help-panel has-help" aria-live="polite">
      <h4>Language help · 句子提示 <span className="pill">local rules</span></h4>
      <div className="help-context">
        <span>{line.speakerEn || line.speakerZh || 'Narration'}</span>
        <small>{line.speakerZh ? `${line.speakerZh} · ` : ''}{line.type === 'choice' ? 'player choice' : 'dialogue line'} · {confidenceText(line.confidence)}</small>
      </div>
      <div className="help-snippet">
        {line.en && <p><span>EN</span>{line.en}</p>}
        {line.zh && <p><span>ZH</span>{line.zh}</p>}
      </div>
      <div className="help-block">
        <h5>Source terms</h5>
        {terms.length ? (
          <div className="help-term-list">
            {terms.map((term) => (
              <span className="help-term" key={`${term.en}:${term.zh}`}>
                <b>{term.en}</b>
                <small>{term.zh}</small>
                <em>{term.matchedBy}</em>
              </span>
            ))}
          </div>
        ) : (
          <p className="help-empty">No source glossary terms matched this line.</p>
        )}
      </div>
      <div className="help-block">
        <h5>Key words & chunks</h5>
        {keyChunks.length ? (
          <div className="help-chunk-list">
            {keyChunks.map((chunk) => (
              <article className="help-chunk-card" key={`${chunk.source}:${chunk.surface}`}>
                <div>
                  <b>{chunk.surface}</b>
                  <span>{chunk.label} · {chunk.source === 'quest-glossary' ? 'quest glossary' : 'built-in local list'}</span>
                </div>
                <strong>{chunk.meaningZh}</strong>
                <p>{chunk.note}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="help-empty">No local chunk rules matched beyond the sentence itself.</p>
        )}
      </div>
      <div className="help-block">
        <h5>Grammar pattern cards</h5>
        {patterns.length ? (
          <div className="help-pattern-list">
            {patterns.map((pattern) => (
              <article className="help-pattern-card" key={pattern.id}>
                <div>
                  <b>{pattern.label}</b>
                  <span>{pattern.id}</span>
                </div>
                {pattern.evidence && <code>{pattern.evidence}</code>}
                <p>{pattern.explanation}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="help-empty">No grammar pattern rule fired; use the reading strategy as a fallback.</p>
        )}
      </div>
      <div className="help-strategy">
        <h5>Reading strategy</h5>
        <p>{readingStrategy}</p>
      </div>
      <p className="help-disclaimer">Honest MVP: deterministic local rules from the selected quest text and a small built-in list. This is not a full dictionary, AI grammar parser, or external lookup.</p>
      <button className="mini-btn help-clear" type="button" onClick={onClear}>Clear language help</button>
    </section>
  )
}

function SourcesPanel({
  enUrl,
  zhUrl,
  setEnUrl,
  setZhUrl,
  onSubmit,
  isLoading,
}: {
  enUrl: string
  zhUrl: string
  setEnUrl: (value: string) => void
  setZhUrl: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  isLoading: boolean
}) {
  return (
    <form className="panel source-editor" onSubmit={onSubmit}>
      <h4>Manual source swap</h4>
      <label className="field">
        <span>Fandom English page</span>
        <input value={enUrl} onChange={(event) => setEnUrl(event.target.value)} spellCheck={false} />
      </label>
      <label className="field">
        <span>Chinese source</span>
        <input value={zhUrl} onChange={(event) => setZhUrl(event.target.value)} spellCheck={false} />
        <em>Use `auto` for Kuro Wiki auto pairing, or paste BWIKI / Kuro item URLs.</em>
      </label>
      <button className="primary-btn" type="submit" disabled={isLoading}>{isLoading ? 'Syncing…' : 'Load sources'}</button>
    </form>
  )
}

function SampleSourcesPanel({ game }: { game: Game }) {
  return (
    <section className="panel source-editor">
      <h4>Sample source status</h4>
      <div className="share-preview sample-source-card" aria-hidden="true">
        <div className="sp-kicker">{game.studio}</div>
        <div className="sp-title">{game.name}</div>
        <div className="sp-row"><span>{game.cn}</span><span>{game.sample.length} lines</span></div>
      </div>
      <p className="sample-note">
        This page is a curated sample reader with real route/palette/chapter, save/review/export, and language-help flows. It does not have a live source connector or playable source clips yet.
      </p>
    </section>
  )
}

function ExportPanel({ quest, exportTsv, isLive }: { quest: QuestResponse; exportTsv: () => void; isLive: boolean }) {
  return (
    <section className="panel share-card">
      <h4>Export · 导出</h4>
      <div className="share-preview" aria-hidden="true">
        <div className="sp-kicker">GLearning · {isLive ? 'live' : 'sample'}</div>
        <div className="sp-title">{quest.meta.pairedCount} paired dialogue lines</div>
        <div className="sp-row"><span>{quest.meta.enTitle}</span><span>{quest.meta.audioCount} clips</span></div>
      </div>
      <div className="share-row">
        <button className="mini-btn primary" type="button" onClick={exportTsv}>Export TSV</button>
        {isLive && <a className="mini-btn" href={quest.source.enUrl} target="_blank" rel="noreferrer">Fandom</a>}
        {isLive && <a className="mini-btn" href={quest.source.zhUrl} target="_blank" rel="noreferrer">Chinese</a>}
      </div>
      <p className="sample-note">
        Launch export/share MVP is TSV only. Share cards, profiles, accounts, cloud sync, and public progress pages are deferred. Saved and review data stay local to this browser.
      </p>
    </section>
  )
}

function getGame(gameId: string) {
  return GAMES.find((game) => game.id === gameId) || GAMES[0]
}

function getInitialRoute(): AppRoute {
  if (typeof window === 'undefined') return { page: 'game', gameId: LIVE_GAME_ID }
  return getRoute()
}

function getRoute(): AppRoute {
  const path = window.location.pathname
  const hash = window.location.hash
  if (/^\/saved\/?$/.test(path) || /^#\/?saved\/?$/.test(hash)) return { page: 'saved' }

  const pathMatch = path.match(/^\/games\/([^/?#]+)/)
  const hashMatch = hash.match(/^#\/?games\/([^/?#]+)/)
  const candidate = pathMatch?.[1] || hashMatch?.[1]
  if (candidate && GAMES.some((game) => game.id === candidate)) return { page: 'game', gameId: candidate as GameId }

  return { page: 'home' }
}

function getInitialPalette(game: Game) {
  if (typeof window === 'undefined') return game.palettes[0].id
  const savedPalette = window.localStorage.getItem(getPaletteStorageKey(game.id))
  return game.palettes.some((palette) => palette.id === savedPalette) ? savedPalette || game.palettes[0].id : game.palettes[0].id
}

function getPaletteStorageKey(gameId: string) {
  return `${PALETTE_STORAGE_PREFIX}-${gameId}`
}

function getQuestStudyIdentity(gameId: string, quest: QuestResponse): QuestStudyIdentity {
  const questKey = hashString([gameId, quest.source.enUrl, quest.source.zhUrl, quest.meta.enTitle].join('|'))
  return {
    questKey,
    storageKey: `${STUDY_STORAGE_PREFIX}:${gameId}:${questKey}`,
  }
}

function buildLineStudyKeys(lines: QuestLine[]) {
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

function readStoredStudyState(storageKey: string): StoredQuestStudyState | null {
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

function writeStoredStudyState(storageKey: string, gameId: string, questKey: string, lines: Record<string, LineStudyState>) {
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

function readStoredSaves(): StoredSavedItems | null {
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

function writeStoredSaves(items: Record<string, SavedItem>) {
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

function readStoredReviewItems(): StoredReviewItems | null {
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

function writeStoredReviewItems(items: Record<string, ReviewItemState>) {
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

function getDueReviewItems(savedItems: SavedItem[], reviewItems: Record<string, ReviewItemState>, nowMs: number) {
  return savedItems
    .filter((item) => isReviewDue(item.id, reviewItems, nowMs))
    .sort((left, right) => getReviewDueMs(left.id, reviewItems) - getReviewDueMs(right.id, reviewItems) || right.updatedAt.localeCompare(left.updatedAt))
}

function countDueReviewItems(savedItems: SavedItem[], reviewItems: Record<string, ReviewItemState>, nowMs: number) {
  return savedItems.filter((item) => isReviewDue(item.id, reviewItems, nowMs)).length
}

function isReviewDue(itemId: string, reviewItems: Record<string, ReviewItemState>, nowMs: number) {
  return getReviewDueMs(itemId, reviewItems) <= nowMs
}

function getReviewDueMs(itemId: string, reviewItems: Record<string, ReviewItemState>) {
  const dueAt = reviewItems[itemId]?.dueAt
  if (!dueAt) return 0
  const dueMs = Date.parse(dueAt)
  return Number.isFinite(dueMs) ? dueMs : 0
}

function getSavedSourceMetadata(quest: QuestResponse | null) {
  if (!quest) return {}
  return {
    ...(quest.meta.enTitle ? { questTitle: quest.meta.enTitle } : {}),
    ...(quest.meta.zhTitle ? { questZhTitle: quest.meta.zhTitle } : {}),
    ...(quest.source.enUrl ? { sourceEnUrl: quest.source.enUrl } : {}),
    ...(quest.source.zhUrl ? { sourceZhUrl: quest.source.zhUrl } : {}),
  }
}

function optionalSavedString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function isWebUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

function getSavedItemQuestLabel(item: SavedItem) {
  return item.questTitle || item.questZhTitle || (item.questKey ? `Quest ${item.questKey.slice(0, 6)}` : 'Saved quest')
}

function getSavedItemGameLabel(item: SavedItem, game: Game | undefined) {
  return game ? game.name : item.gameId || 'Unknown game'
}

function getSavedItemPrompt(item: SavedItem) {
  return item.type === 'line' ? item.en || item.zh || 'Saved dialogue' : item.en || item.zh || 'Saved term'
}

function getSavedItemAnswer(item: SavedItem) {
  return item.type === 'line' ? item.zh || item.en || 'No answer text saved' : item.zh || item.en || 'No translation saved'
}

function getSavedItemSearchText(item: SavedItem, game: Game | undefined) {
  return [
    getSavedItemGameLabel(item, game),
    game?.cn,
    item.questTitle,
    item.questZhTitle,
    item.type,
    item.en,
    item.zh,
    item.type === 'line' ? item.speakerEn : '',
    item.type === 'line' ? item.speakerZh : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function getSavedItemDueStatus(item: SavedItem, reviewItems: Record<string, ReviewItemState>, nowMs: number) {
  const reviewState = reviewItems[item.id]
  const dueMs = getReviewDueMs(item.id, reviewItems)
  if (!reviewState) return { label: 'Due now', detail: 'No review yet', tone: 'due' }
  if (dueMs <= nowMs) return { label: 'Due now', detail: reviewState.lastGrade ? `Last: ${reviewState.lastGrade}` : '', tone: 'due' }
  return { label: 'Scheduled', detail: formatReviewDue(dueMs, nowMs), tone: 'scheduled' }
}

function sortSavedItemsForLibrary(left: SavedItem, right: SavedItem, reviewItems: Record<string, ReviewItemState>, nowMs: number) {
  const leftDue = isReviewDue(left.id, reviewItems, nowMs)
  const rightDue = isReviewDue(right.id, reviewItems, nowMs)
  if (leftDue !== rightDue) return leftDue ? -1 : 1
  return getReviewDueMs(left.id, reviewItems) - getReviewDueMs(right.id, reviewItems) || right.updatedAt.localeCompare(left.updatedAt)
}

function formatReviewDue(dueMs: number, nowMs: number) {
  const minutes = Math.max(1, Math.round((dueMs - nowMs) / 60000))
  if (minutes < 60) return `Due in ${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `Due in ${hours}h`
  return `Due in ${Math.round(hours / 24)}d`
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

function getLineSaveId(gameId: string, questKey: string, lineKey: string | undefined) {
  return `${gameId}:${questKey}:line:${lineKey || ''}`
}

function getTermSaveId(gameId: string, questKey: string, term: GlossaryTerm) {
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

function createSampleQuest(game: Game): QuestResponse {
  const chapter = game.chapters[0]
  const lines: QuestLine[] = game.sample.map((line) => ({
    id: String(line.id),
    type: 'dialogue',
    speakerEn: line.speaker,
    speakerZh: line.cn,
    en: line.en,
    zh: line.zh,
    confidence: line.confidence as PairConfidence,
  }))

  return {
    meta: {
      enTitle: chapter.name,
      zhTitle: chapter.cn,
      fetchedAt: new Date(0).toISOString(),
      enCount: lines.length,
      zhCount: lines.length,
      pairedCount: lines.length,
      audioCount: 0,
    },
    source: {
      enUrl: `sample://${game.id}/en`,
      zhUrl: `sample://${game.id}/zh`,
    },
    terms: game.glossary.map((term) => ({ en: term.en, zh: term.cn })),
    warnings: ['Prototype sample content: not a live game wiki/API parse yet.'],
    lines,
  }
}

function getInitialDensity(): DensityId {
  if (typeof window === 'undefined') return 'standard'
  const savedDensity = window.localStorage.getItem(DENSITY_STORAGE_KEY)
  return DENSITIES.some((density) => density.id === savedDensity) ? (savedDensity as DensityId) : 'standard'
}

function groupQuestsByChapter(quests: MainQuestOption[]) {
  const groups = new Map<string, MainQuestOption[]>()
  quests.forEach((quest) => {
    const current = groups.get(quest.chapter) || []
    current.push(quest)
    groups.set(quest.chapter, current)
  })
  return [...groups.entries()]
}

function DialogueCard({
  line,
  hideChinese,
  studyState,
  onReveal,
  onPlayed,
  onToggleMastered,
  isSaved,
  onToggleSaved,
  isHelpOpen,
  onOpenLanguageHelp,
}: {
  line: QuestLine
  hideChinese: boolean
  studyState: LineStudyState
  onReveal: () => void
  onPlayed: () => void
  onToggleMastered: () => void
  isSaved: boolean
  onToggleSaved: () => void
  isHelpOpen: boolean
  onOpenLanguageHelp: () => void
}) {
  const [revealed, setRevealed] = useState(Boolean(studyState.revealedAt) || !hideChinese)

  useEffect(() => {
    setRevealed(Boolean(studyState.revealedAt) || !hideChinese)
  }, [hideChinese, studyState.revealedAt])

  function revealChinese() {
    setRevealed(true)
    if (!studyState.revealedAt) onReveal()
  }

  const status = getLineStudyStatus(studyState)
  const avatarText = (line.speakerEn || line.speakerZh || '?').slice(0, 1).toUpperCase()

  return (
    <article className={`line confidence-${line.confidence}`} data-state={status} role="listitem">
      <span className="spine-glyph" aria-hidden="true">{status === 'mastered' ? '✓' : status === 'heard' ? '▶' : '○'}</span>
      <div className="avatar" data-tone={line.confidence === 'sequence' ? 'gold' : line.confidence === 'unmatched' ? 'muted' : undefined}>{avatarText}</div>
      <div className="line-body">
        <div className="meta">
          <span className="speaker">{line.speakerEn || 'Unmatched'}</span>
          <span className="speaker-cn">· {line.speakerZh || '未匹配'}</span>
          <span className={`state-tag learner-state ${status}`}>{studyStatusText(status)}</span>
          <span className={`confidence-tag alignment-${line.confidence}`}>align: {confidenceText(line.confidence)}</span>
          <span className="line-id">#{line.id}</span>
        </div>
        {line.en && <p className="en">{line.en}</p>}
        {line.zh && (
          <p
            className={`zh ${revealed ? '' : 'is-hidden'}`}
            onClick={revealChinese}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                revealChinese()
              }
            }}
          >
            {line.zh}
          </p>
        )}
        <div className="actions">
          {line.audioUrl && <VoicePlayer line={line} onPlayed={onPlayed} />}
          {line.zh && (
            <button className={`act-btn ${revealed ? 'is-on' : ''}`} type="button" onClick={() => (revealed ? setRevealed(false) : revealChinese())}>
              {revealed ? '◑ Hide CN' : '👁 Reveal CN'}
            </button>
          )}
          <button className={`act-btn master-btn ${studyState.masteredAt ? 'is-on' : ''}`} type="button" aria-pressed={Boolean(studyState.masteredAt)} onClick={onToggleMastered}>
            {studyState.masteredAt ? '✓ Mastered' : '✓ Mark mastered'}
          </button>
          <button className={`act-btn save-btn ${isSaved ? 'is-on' : ''}`} type="button" aria-pressed={isSaved} onClick={onToggleSaved}>
            {isSaved ? '★ Saved' : '☆ Save line'}
          </button>
          <button className={`act-btn help-btn ${isHelpOpen ? 'is-on' : ''}`} type="button" aria-pressed={isHelpOpen} onClick={onOpenLanguageHelp}>
            {isHelpOpen ? 'Help open' : 'Language help'}
          </button>
          <span className="act-note">{line.type}</span>
        </div>
      </div>
    </article>
  )
}

function VoicePlayer({ line, onPlayed }: { line: QuestLine; onPlayed: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle')
  const [audioError, setAudioError] = useState('')
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  async function togglePlayback() {
    const audio = audioRef.current
    if (!audio) return

    if (status === 'playing') {
      audio.pause()
      setStatus('idle')
      return
    }

    try {
      setStatus('loading')
      setAudioError('')
      await audio.play()
      setStatus('playing')
      onPlayed()
    } catch {
      setStatus('error')
      setAudioError(audioSupportMessage(Boolean(line.audioMp3Url)))
    }
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  return (
    <div className="listen-player">
      <audio
        ref={audioRef}
        preload="metadata"
        src={line.audioUrl}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
        onEnded={() => setStatus('idle')}
        onError={() => {
          setStatus('error')
          setAudioError(audioSupportMessage(Boolean(line.audioMp3Url)))
        }}
      />
      <button className={`act-btn listen ${status === 'playing' ? 'is-on' : ''}`} type="button" onClick={() => void togglePlayback()}>
        ▶ {status === 'playing' ? 'Playing' : status === 'loading' ? 'Loading' : 'Listen'}
      </button>
      <div className="mini-wave" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
      <span className="audio-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
      {audioError && (
        <p className="audio-warning">
          {audioError}
          {line.audioSourceUrl && (
            <>
              {' '}
              <a href={line.audioSourceUrl} target="_blank" rel="noreferrer">Open source</a>
            </>
          )}
        </p>
      )}
    </div>
  )
}

function audioSupportMessage(hasMp3: boolean) {
  const audio = document.createElement('audio')
  const canPlayMp3 = audio.canPlayType('audio/mpeg')
  if (hasMp3 && !canPlayMp3) {
    return 'This browser reports that it cannot play MP3 audio.'
  }

  return hasMp3
    ? 'MP3 audio failed to load. Try again, or open the source file.'
    : 'This line only has Fandom OGG/Vorbis audio. This browser may not support it.'
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0:00'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function confidenceText(confidence: PairConfidence) {
  switch (confidence) {
    case 'speaker':
      return 'speaker'
    case 'sequence':
      return 'sequence'
    case 'low':
      return 'review'
    case 'unmatched':
      return 'unmatched'
  }
}

function getLineStudyStatus(studyState: LineStudyState): LineStudyStatus {
  if (studyState.masteredAt) return 'mastered'
  if (studyState.firstPlayedAt || studyState.revealedAt) return 'heard'
  return 'unread'
}

function studyStatusText(status: LineStudyStatus) {
  switch (status) {
    case 'mastered':
      return 'Mastered'
    case 'heard':
      return 'Seen'
    case 'unread':
      return 'New'
  }
}

function escapeTsv(value: string) {
  return value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ').trim()
}

function shortUrl(value: string) {
  try {
    const url = new URL(value)
    return `${url.hostname}${decodeURIComponent(url.pathname).slice(0, 42)}${url.pathname.length > 42 ? '…' : ''}`
  } catch {
    return value
  }
}

export default App
