import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { GAMES } from './gameData'
import type { MainQuestCatalogResponse, MainQuestOption, PairConfidence, QuestLine, QuestResponse } from './types'

const DEFAULT_EN_URL = 'https://wutheringwaves.fandom.com/wiki/Utterance_of_Marvels:_I'
const DEFAULT_ZH_URL =
  'https://wiki.biligame.com/wutheringwaves/%E4%BB%BB%E5%8A%A1%E5%9B%9E%E9%A1%BE/%E4%B8%87%E8%B1%A1%E6%96%B0%E5%A3%B0%C2%B7%E4%B8%8A'
const PALETTE_STORAGE_PREFIX = 'glearning-palette'
const DENSITY_STORAGE_KEY = 'glearning-density'
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

function App() {
  const [routeGameId, setRouteGameId] = useState<GameId | null>(() => getInitialRouteGameId())
  const activeGame = useMemo(() => getGame(routeGameId || LIVE_GAME_ID), [routeGameId])
  const isHome = routeGameId === null
  const isLiveGame = activeGame.id === LIVE_GAME_ID
  const [enUrl, setEnUrl] = useState(DEFAULT_EN_URL)
  const [zhUrl, setZhUrl] = useState(DEFAULT_ZH_URL)
  const [questCatalog, setQuestCatalog] = useState<MainQuestOption[]>([])
  const [selectedQuestUrl, setSelectedQuestUrl] = useState(DEFAULT_EN_URL)
  const [catalogError, setCatalogError] = useState('')
  const [paletteId, setPaletteId] = useState('')
  const [density, setDensity] = useState<DensityId>(() => getInitialDensity())
  const [sidePanel, setSidePanel] = useState<RightTabId>('summary')
  const [quest, setQuest] = useState<QuestResponse | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [speaker, setSpeaker] = useState('all')
  const [audioOnly, setAudioOnly] = useState(false)
  const [hideChinese, setHideChinese] = useState(false)

  const activePalette = activeGame.palettes.find((palette) => palette.id === paletteId) || activeGame.palettes[0]
  const readerData = useMemo(() => (isLiveGame ? quest : createSampleQuest(activeGame)), [activeGame, isLiveGame, quest])

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
      setRouteGameId(getRouteGameId())
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

  const stats = useMemo(() => {
    if (!readerData) {
      return { progress: 0, audioVisible: 0, unmatched: 0, low: 0, visible: 0 }
    }

    return {
      progress: readerData.meta.enCount ? readerData.meta.pairedCount / readerData.meta.enCount : 0,
      audioVisible: filteredLines.filter((line) => line.audioUrl).length,
      unmatched: readerData.lines.filter((line) => line.confidence === 'unmatched').length,
      low: readerData.lines.filter((line) => line.confidence === 'low').length,
      visible: filteredLines.length,
    }
  }, [filteredLines, readerData])

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

  function navigateToGame(gameId: GameId | null) {
    const nextPath = gameId ? `/games/${gameId}` : '/'
    window.history.pushState({}, '', nextPath)
    setRouteGameId(gameId)
    setSearch('')
    setSpeaker('all')
    setAudioOnly(false)
    setHideChinese(false)
  }

  if (isHome) {
    return <HomePage games={GAMES} onOpenGame={navigateToGame} />
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
          <button className="icon-btn" type="button" data-hint="Game library" onClick={() => navigateToGame(null)}>
            ⌂
          </button>
          <button className="icon-btn" type="button" data-hint={isLiveGame ? 'Load current URLs' : 'Sample reader'} onClick={() => void loadQuest()} disabled={!isLiveGame || isLoading}>
            {isLoading ? '…' : '↻'}
          </button>
          <button
            className={`icon-btn ${audioOnly ? 'is-on' : ''}`}
            type="button"
            data-hint="Audio only"
            aria-pressed={audioOnly}
            onClick={() => setAudioOnly((value) => !value)}
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
                This game page is using curated prototype dialogue and glossary data while a live source connector is added.
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
                : activeGame.chapters.map((chapter, index) => (
                    <button key={chapter.id} className={`chapter-card ${index === 0 ? 'active' : ''}`} type="button">
                      <span className="chap-name">{chapter.name}</span>
                      <span className="chap-cn">{chapter.cn} · {Math.round(chapter.progress * 100)}% prototype</span>
                    </button>
                  ))}
            </div>
          </section>

          <div className="rail-footnote">
            <b>{isLiveGame ? '真实数据源' : 'Prototype page'}</b><br />
            {isLiveGame
              ? 'English from Fandom MediaWiki · Chinese auto pairs from Kuro Wiki · MP3 preferred when bundled.'
              : `${activeGame.name} is theme-complete with sample study content; live API integration can be added next.`}
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
                  {filteredLines.map((line) => (
                    <DialogueCard key={line.id} line={line} hideChinese={hideChinese} />
                  ))}
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
              audioOnly={audioOnly}
              setAudioOnly={setAudioOnly}
              hideChinese={hideChinese}
              setHideChinese={setHideChinese}
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
        hideChinese={hideChinese}
        setHideChinese={setHideChinese}
        onHome={() => navigateToGame(null)}
      />
    </>
  )
}

function HomePage({ games, onOpenGame }: { games: readonly Game[]; onOpenGame: (gameId: GameId) => void }) {
  const [selectedGameId, setSelectedGameId] = useState<GameId>('starrail')
  const selectedGame = getGame(selectedGameId)
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
          <button className="icon-btn" type="button" data-hint="Daily timer">
            ◴
          </button>
          <button className="icon-btn is-on" type="button" data-hint="Saved words">
            ★
          </button>
          <button className="icon-btn" type="button" data-hint="Settings">
            ⚙
          </button>
        </div>
      </header>

      <main className={`home-page landing-${selectedGame.motif}`}>
        <LandingBackdrop game={selectedGame} />
        <section className="home-hero">
          <div className="home-copy">
            <div className="home-kicker">● Game dialogue · no AI translation · 100% lore-authentic</div>
            <h1>Learn English <span>from {selectedGame.name}.</span></h1>
            <div className="home-hero-cn">{selectedGame.cnTagline}</div>
            <p>把你最熟的剧情，变成最高效的双语阅读课。原版语音 + 官方中文文本，逐句对齐，逐词查词。先听角色说，再学他们怎么说。</p>
            <div className="home-actions">
              <button className="primary-btn home-primary" type="button" onClick={() => onOpenGame(selectedGame.id)}>
                进入阅读器 → {selectedGame.chapters[0].cn}
              </button>
              <button className="mini-btn home-ghost" type="button" onClick={() => document.querySelector('.game-grid')?.scrollIntoView({ behavior: 'smooth' })}>
                浏览所有章节
              </button>
            </div>
            <div className="landing-stats" aria-label="Study stats">
              <div><b>{selectedGame.sample.length * 19}</b><span>aligned lines</span></div>
              <div><b>{selectedGame.sample.length * 12}</b><span>voice clips</span></div>
              <div><b>{selectedGame.glossary.length}</b><span>core terms</span></div>
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
                  <span className="game-card-meta">{game.chapters.length} chapters · {game.glossary.length} terms · {game.id === LIVE_GAME_ID ? 'live API' : 'sample'}</span>
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
  hideChinese,
  setHideChinese,
  onHome,
}: {
  game: Game
  quest: QuestResponse | null
  stats: { progress: number; audioVisible: number; unmatched: number; low: number; visible: number }
  isLive: boolean
  audioOnly: boolean
  setAudioOnly: (value: boolean) => void
  hideChinese: boolean
  setHideChinese: (value: boolean) => void
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
      <button className={`dock-btn ${audioOnly ? 'is-on' : ''}`} type="button" onClick={() => setAudioOnly(!audioOnly)}>Audio only</button>
      <button className={`dock-btn ${hideChinese ? 'is-on' : ''}`} type="button" onClick={() => setHideChinese(!hideChinese)}>Hide CN</button>
      <span className="dock-stat">{stats.visible} visible · {stats.audioVisible} audio</span>
    </nav>
  )
}

function SummaryPanel({
  quest,
  stats,
  game,
  isLive,
}: {
  quest: QuestResponse
  stats: { audioVisible: number; unmatched: number; low: number; visible: number }
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
  audioOnly,
  setAudioOnly,
  hideChinese,
  setHideChinese,
}: {
  quest: QuestResponse
  audioOnly: boolean
  setAudioOnly: (value: boolean) => void
  hideChinese: boolean
  setHideChinese: (value: boolean) => void
}) {
  return (
    <>
      <section className="panel due">
        <h4><span className="pulse" aria-hidden="true" /> Study loop <span className="pill">reader</span></h4>
        <div className="toggle-line">
          <span>Audio lines only · 只看有语音的句子</span>
          <button className={`toggle ${audioOnly ? 'is-on' : ''}`} type="button" aria-pressed={audioOnly} onClick={() => setAudioOnly(!audioOnly)}><i /></button>
        </div>
        <div className="toggle-line">
          <span>Hide Chinese first · 点击单句显示中文</span>
          <button className={`toggle ${hideChinese ? 'is-on' : ''}`} type="button" aria-pressed={hideChinese} onClick={() => setHideChinese(!hideChinese)}><i /></button>
        </div>
      </section>

      <section className="panel saved">
        <h4>Glossary · 关键词 <span className="pill">{quest.terms.length}</span></h4>
        <div className="gloss-list">
          {quest.terms.map((term) => (
            <div className="gloss-row" key={term.en}>
              <div>
                <div className="gloss-en">{term.en}</div>
                <span className="gloss-meta">source term</span>
              </div>
              <div className="gloss-cn">{term.zh}</div>
            </div>
          ))}
        </div>
      </section>
    </>
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
        This page already has its own route, palettes, chapter rail, glossary, and export flow. The live dialogue connector is intentionally not stubbed as real data.
      </p>
    </section>
  )
}

function ExportPanel({ quest, exportTsv, isLive }: { quest: QuestResponse; exportTsv: () => void; isLive: boolean }) {
  return (
    <section className="panel share-card">
      <h4>Export · 分享</h4>
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
    </section>
  )
}

function getGame(gameId: string) {
  return GAMES.find((game) => game.id === gameId) || GAMES[0]
}

function getInitialRouteGameId(): GameId | null {
  if (typeof window === 'undefined') return LIVE_GAME_ID
  return getRouteGameId()
}

function getRouteGameId(): GameId | null {
  const pathMatch = window.location.pathname.match(/^\/games\/([^/?#]+)/)
  const hashMatch = window.location.hash.match(/^#\/?games\/([^/?#]+)/)
  const candidate = pathMatch?.[1] || hashMatch?.[1]
  if (!candidate) return null
  return GAMES.some((game) => game.id === candidate) ? (candidate as GameId) : null
}

function getInitialPalette(game: Game) {
  if (typeof window === 'undefined') return game.palettes[0].id
  const savedPalette = window.localStorage.getItem(getPaletteStorageKey(game.id))
  return game.palettes.some((palette) => palette.id === savedPalette) ? savedPalette || game.palettes[0].id : game.palettes[0].id
}

function getPaletteStorageKey(gameId: string) {
  return `${PALETTE_STORAGE_PREFIX}-${gameId}`
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

function DialogueCard({ line, hideChinese }: { line: QuestLine; hideChinese: boolean }) {
  const [revealed, setRevealed] = useState(!hideChinese)

  useEffect(() => {
    setRevealed(!hideChinese)
  }, [hideChinese])

  const status = line.confidence === 'unmatched' ? 'unread' : line.confidence === 'low' ? 'heard' : 'mastered'
  const avatarText = (line.speakerEn || line.speakerZh || '?').slice(0, 1).toUpperCase()

  return (
    <article className={`line confidence-${line.confidence}`} data-state={status} role="listitem">
      <span className="spine-glyph" aria-hidden="true">{status === 'mastered' ? '✓' : status === 'heard' ? '▶' : '○'}</span>
      <div className="avatar" data-tone={line.confidence === 'sequence' ? 'gold' : line.confidence === 'unmatched' ? 'muted' : undefined}>{avatarText}</div>
      <div className="line-body">
        <div className="meta">
          <span className="speaker">{line.speakerEn || 'Unmatched'}</span>
          <span className="speaker-cn">· {line.speakerZh || '未匹配'}</span>
          <span className={`state-tag ${status}`}>{confidenceText(line.confidence)}</span>
          <span className="line-id">#{line.id}</span>
        </div>
        {line.en && <p className="en">{line.en}</p>}
        {line.zh && (
          <p
            className={`zh ${revealed ? '' : 'is-hidden'}`}
            onClick={() => setRevealed(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setRevealed(true)
              }
            }}
          >
            {line.zh}
          </p>
        )}
        <div className="actions">
          {line.audioUrl && <VoicePlayer line={line} />}
          {line.zh && (
            <button className={`act-btn ${revealed ? 'is-on' : ''}`} type="button" onClick={() => setRevealed((value) => !value)}>
              {revealed ? '◑ Hide CN' : '👁 Reveal CN'}
            </button>
          )}
          <span className="act-note">{line.type}</span>
        </div>
      </div>
    </article>
  )
}

function VoicePlayer({ line }: { line: QuestLine }) {
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
