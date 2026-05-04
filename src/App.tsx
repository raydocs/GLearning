import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { MainQuestCatalogResponse, MainQuestOption, PairConfidence, QuestLine, QuestResponse } from './types'

const DEFAULT_EN_URL = 'https://wutheringwaves.fandom.com/wiki/Utterance_of_Marvels:_I'
const DEFAULT_ZH_URL =
  'https://wiki.biligame.com/wutheringwaves/%E4%BB%BB%E5%8A%A1%E5%9B%9E%E9%A1%BE/%E4%B8%87%E8%B1%A1%E6%96%B0%E5%A3%B0%C2%B7%E4%B8%8A'
const THEME_STORAGE_KEY = 'wuwa-study-theme'
const DENSITY_STORAGE_KEY = 'glearning-density'

const THEMES = [
  { id: 'tacet', name: 'Tacet Archive', note: '深绿档案' },
  { id: 'jinzhou', name: 'Jinzhou Lantern', note: '今州暖金' },
  { id: 'abyss', name: 'Abyss Current', note: '深海蓝' },
  { id: 'battle', name: 'Battlefield Ember', note: '战场赤' },
  { id: 'paper', name: 'Study Paper', note: '纸页护眼' },
] as const

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

type ThemeId = (typeof THEMES)[number]['id']
type DensityId = (typeof DENSITIES)[number]['id']
type RightTabId = (typeof RIGHT_TABS)[number]['id']

function App() {
  const [enUrl, setEnUrl] = useState(DEFAULT_EN_URL)
  const [zhUrl, setZhUrl] = useState(DEFAULT_ZH_URL)
  const [questCatalog, setQuestCatalog] = useState<MainQuestOption[]>([])
  const [selectedQuestUrl, setSelectedQuestUrl] = useState(DEFAULT_EN_URL)
  const [catalogError, setCatalogError] = useState('')
  const [theme, setTheme] = useState<ThemeId>(() => getInitialTheme())
  const [density, setDensity] = useState<DensityId>(() => getInitialDensity())
  const [sidePanel, setSidePanel] = useState<RightTabId>('summary')
  const [quest, setQuest] = useState<QuestResponse | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [speaker, setSpeaker] = useState('all')
  const [audioOnly, setAudioOnly] = useState(false)
  const [hideChinese, setHideChinese] = useState(false)

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
    void loadQuest(DEFAULT_EN_URL, DEFAULT_ZH_URL)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

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
    if (!quest) return []
    const labels = new Set<string>()
    quest.lines.forEach((line) => {
      if (line.speakerEn || line.speakerZh) {
        labels.add(`${line.speakerEn || 'Unmatched'} / ${line.speakerZh || '未匹配'}`)
      }
    })
    return [...labels]
  }, [quest])

  const filteredLines = useMemo(() => {
    if (!quest) return []
    const normalizedSearch = search.trim().toLowerCase()

    return quest.lines.filter((line) => {
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
  }, [audioOnly, quest, search, speaker])

  const stats = useMemo(() => {
    if (!quest) {
      return { progress: 0, audioVisible: 0, unmatched: 0, low: 0, visible: 0 }
    }

    return {
      progress: quest.meta.enCount ? quest.meta.pairedCount / quest.meta.enCount : 0,
      audioVisible: filteredLines.filter((line) => line.audioUrl).length,
      unmatched: quest.lines.filter((line) => line.confidence === 'unmatched').length,
      low: quest.lines.filter((line) => line.confidence === 'low').length,
      visible: filteredLines.length,
    }
  }, [filteredLines, quest])

  const activeTab = RIGHT_TABS.find((tab) => tab.id === sidePanel) || RIGHT_TABS[0]

  function exportTsv() {
    if (!quest) return
    const rows = quest.lines.map((line) =>
      [line.speakerEn, line.en, line.speakerZh, line.zh, line.audioSourceUrl || line.audioUrl || '', line.confidence]
        .map(escapeTsv)
        .join('\t'),
    )
    const header = ['speaker_en', 'english', 'speaker_zh', 'chinese', 'audio_url', 'alignment'].join('\t')
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/tab-separated-values;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${quest.meta.enTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-bilingual.tsv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">G</div>
          <div className="brand-text">
            <div className="brand-name">GLearning · 鸣潮</div>
            <div className="brand-sub">Kuro Games · 学英语 · v6 UI</div>
          </div>
        </div>

        <div className="progress-strip" title={quest ? `${quest.meta.enTitle} · ${quest.meta.zhTitle}` : 'Loading quest'}>
          <span className="strip-title">{quest?.meta.enTitle || 'Loading quest archive'}</span>
          <span className="strip-cn">{quest?.meta.zhTitle || '正在同步源站'}</span>
          <span className="strip-track" aria-hidden="true">
            <i style={{ width: `${Math.round(stats.progress * 100)}%` }} />
          </span>
          <span className="strip-counter">
            <b>{quest?.meta.pairedCount || 0}</b> / {quest?.meta.enCount || 0} paired
          </span>
        </div>

        <div className="top-actions">
          <button className="icon-btn" type="button" data-hint="Load current URLs" onClick={() => void loadQuest()} disabled={isLoading}>
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
        <aside className="rail left-rail">
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
            <h4>Theme</h4>
            <div className="theme-grid" aria-label="Reader themes">
              {THEMES.map((option) => (
                <button
                  key={option.id}
                  className={`theme-card ${theme === option.id ? 'is-on' : ''}`}
                  type="button"
                  aria-pressed={theme === option.id}
                  onClick={() => setTheme(option.id)}
                >
                  <span>{option.name}</span>
                  <small>{option.note}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="rail-section quest-index">
            <h4>Quest index <span className="pill">{questCatalog.length || '—'}</span></h4>
            <div className="chapter-list">
              {questCatalog.slice(0, 18).map((option) => (
                <button
                  key={option.enUrl}
                  className={`chapter-card ${selectedQuestUrl === option.enUrl ? 'active' : ''}`}
                  type="button"
                  onClick={() => handleQuestSelect(option.enUrl)}
                >
                  <span className="chap-name">{option.title}</span>
                  <span className="chap-cn">{option.chapter} · {option.act}</span>
                </button>
              ))}
            </div>
          </section>

          <div className="rail-footnote">
            <b>真实数据源</b><br />English from Fandom MediaWiki · Chinese auto pairs from Kuro Wiki · MP3 preferred when bundled.
          </div>
        </aside>

        <section className="reader" aria-label="Bilingual dialogue reader">
          <div className="reader-inner">
            {error && <div className="error-banner">{error}</div>}
            {quest?.warnings?.map((warning) => (
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
              <div className="reader-eyebrow"><span className="dot" />Quest dialogue · 鸣潮</div>
              <h1 className="reader-title">{quest?.meta.enTitle || 'Fandom English audio, Kuro Chinese text'}</h1>
              <span className="reader-cn">{quest?.meta.zhTitle || '选择章节后自动同步中英文台词'}</span>
              <div className="reader-progress-tiny">
                <div className="bar" aria-hidden="true"><i style={{ width: `${Math.round(stats.progress * 100)}%` }} /></div>
                <span><b>{quest?.meta.pairedCount || 0}</b> paired · {stats.audioVisible} audio visible · {stats.unmatched} unmatched</span>
              </div>
            </header>

            {quest && (
              <>
                <section className="quest-context">
                  <div className="label">Quest context · live parse</div>
                  <p>
                    <b>Source:</b> {shortUrl(quest.source.enUrl)}<br />
                    <b>Chinese:</b> {shortUrl(quest.source.zhUrl)}<br />
                    <b>Focus:</b> review official lines after playing; no AI translation is used.
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

                <div className="stream" role="list" aria-label={`${quest.meta.enTitle} dialogue`}>
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

          {quest && sidePanel === 'summary' && <SummaryPanel quest={quest} stats={stats} />}
          {quest && sidePanel === 'study' && (
            <StudyPanel
              quest={quest}
              audioOnly={audioOnly}
              setAudioOnly={setAudioOnly}
              hideChinese={hideChinese}
              setHideChinese={setHideChinese}
            />
          )}
          {sidePanel === 'sources' && (
            <SourcesPanel
              enUrl={enUrl}
              zhUrl={zhUrl}
              setEnUrl={setEnUrl}
              setZhUrl={setZhUrl}
              onSubmit={handleSubmit}
              isLoading={isLoading}
            />
          )}
          {quest && sidePanel === 'export' && <ExportPanel quest={quest} exportTsv={exportTsv} />}
        </aside>
      </main>
    </>
  )
}

function SummaryPanel({ quest, stats }: { quest: QuestResponse; stats: { audioVisible: number; unmatched: number; low: number; visible: number } }) {
  return (
    <>
      <section className="panel today-panel">
        <h4>Today · 当前任务 <span className="pill">live</span></h4>
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
        <h4>World · 游戏世界 <span className="pill">Kuro</span></h4>
        <div className="game-hero-row">
          <div className="game-glyph">W</div>
          <div>
            <div className="game-title">Wuthering Waves</div>
            <div className="game-cn">鸣潮 · resonance archive for language review</div>
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
          <div className="game-meta"><b>v6</b><span>UI shell</span></div>
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

function ExportPanel({ quest, exportTsv }: { quest: QuestResponse; exportTsv: () => void }) {
  return (
    <section className="panel share-card">
      <h4>Export · 分享</h4>
      <div className="share-preview" aria-hidden="true">
        <div className="sp-kicker">GLearning · 鸣潮</div>
        <div className="sp-title">{quest.meta.pairedCount} paired dialogue lines</div>
        <div className="sp-row"><span>{quest.meta.enTitle}</span><span>{quest.meta.audioCount} clips</span></div>
      </div>
      <div className="share-row">
        <button className="mini-btn primary" type="button" onClick={exportTsv}>Export TSV</button>
        <a className="mini-btn" href={quest.source.enUrl} target="_blank" rel="noreferrer">Fandom</a>
        <a className="mini-btn" href={quest.source.zhUrl} target="_blank" rel="noreferrer">Chinese</a>
      </div>
    </section>
  )
}

function getInitialTheme(): ThemeId {
  if (typeof window === 'undefined') return 'tacet'
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  return THEMES.some((theme) => theme.id === savedTheme) ? (savedTheme as ThemeId) : 'tacet'
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
