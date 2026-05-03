import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { MainQuestCatalogResponse, MainQuestOption, PairConfidence, QuestLine, QuestResponse } from './types'

const DEFAULT_EN_URL = 'https://wutheringwaves.fandom.com/wiki/Utterance_of_Marvels:_I'
const DEFAULT_ZH_URL =
  'https://wiki.biligame.com/wutheringwaves/%E4%BB%BB%E5%8A%A1%E5%9B%9E%E9%A1%BE/%E4%B8%87%E8%B1%A1%E6%96%B0%E5%A3%B0%C2%B7%E4%B8%8A'
const THEME_STORAGE_KEY = 'wuwa-study-theme'

const THEMES = [
  { id: 'tacet', name: 'Tacet Archive', note: '深绿档案' },
  { id: 'jinzhou', name: 'Jinzhou Lantern', note: '今州暖金' },
  { id: 'abyss', name: 'Abyss Current', note: '深海蓝' },
  { id: 'battle', name: 'Battlefield Ember', note: '战场赤' },
  { id: 'paper', name: 'Study Paper', note: '纸页护眼' },
] as const

type ThemeId = (typeof THEMES)[number]['id']

function App() {
  const [enUrl, setEnUrl] = useState(DEFAULT_EN_URL)
  const [zhUrl, setZhUrl] = useState(DEFAULT_ZH_URL)
  const [questCatalog, setQuestCatalog] = useState<MainQuestOption[]>([])
  const [selectedQuestUrl, setSelectedQuestUrl] = useState(DEFAULT_EN_URL)
  const [catalogError, setCatalogError] = useState('')
  const [theme, setTheme] = useState<ThemeId>(() => getInitialTheme())
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
    <main className="app-shell">
      <section className="hero-panel">
        <div className="signal-beam" />
        <div className="hero-copy">
          <p className="eyebrow">WuWa quest archive / no AI translation</p>
          <h1>Fandom English audio, Kuro Chinese text, one study desk.</h1>
          <p className="hero-text">
            Load a Wuthering Waves Fandom quest page and the matching Kuro Wiki quest dialogue. The site pairs
            official English dialogue and audio with Chinese wiki text so you can review the story after playing.
          </p>
          <div className="theme-strip" aria-label="Reader themes">
            {THEMES.map((option) => (
              <button
                key={option.id}
                className={`theme-option ${theme === option.id ? 'is-active' : ''}`}
                type="button"
                aria-pressed={theme === option.id}
                onClick={() => setTheme(option.id)}
              >
                <span>{option.name}</span>
                <strong>{option.note}</strong>
              </button>
            ))}
          </div>
        </div>

        <form className="source-card" onSubmit={handleSubmit}>
          <label>
            <span>Main quest catalog</span>
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
            <em className="field-hint">
              {catalogError || `${questCatalog.length || 'All'} Fandom main quests; Kuro quest dialogue resolves automatically.`}
            </em>
          </label>
          <label>
            <span>Reader theme</span>
            <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeId)}>
              {THEMES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} — {option.note}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Fandom English quest page</span>
            <input value={enUrl} onChange={(event) => setEnUrl(event.target.value)} spellCheck={false} />
          </label>
          <label>
            <span>Chinese wiki source</span>
            <input value={zhUrl} onChange={(event) => setZhUrl(event.target.value)} spellCheck={false} />
          </label>
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Syncing sources...' : 'Build bilingual reader'}
          </button>
        </form>
      </section>

      {error && <div className="error-banner">{error}</div>}
      {quest?.warnings?.map((warning) => (
        <div className="warning-banner" key={warning}>
          {warning}
        </div>
      ))}

      {quest && (
        <>
          <section className="briefing-grid" aria-label="Quest summary">
            <Metric label="Quest" value={quest.meta.enTitle} detail={quest.meta.zhTitle} />
            <Metric label="Aligned lines" value={String(quest.meta.pairedCount)} detail={`${quest.meta.enCount} EN / ${quest.meta.zhCount} ZH`} />
            <Metric label="Audio clips" value={String(quest.meta.audioCount)} detail="from Fandom file metadata" />
            <Metric label="Updated" value={new Date(quest.meta.fetchedAt).toLocaleTimeString()} detail="cached for 30 minutes" />
          </section>

          <section className="reader-layout">
            <aside className="study-rail">
              <div className="rail-card">
                <h2>Study controls</h2>
                <label className="search-box">
                  <span>Search line, speaker, or term</span>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tacet Field, 无音区..." />
                </label>
                <label className="search-box">
                  <span>Speaker</span>
                  <select value={speaker} onChange={(event) => setSpeaker(event.target.value)}>
                    <option value="all">All speakers</option>
                    {speakers.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="toggle-row">
                  <input type="checkbox" checked={audioOnly} onChange={(event) => setAudioOnly(event.target.checked)} />
                  <span>Audio lines only</span>
                </label>
                <label className="toggle-row">
                  <input type="checkbox" checked={hideChinese} onChange={(event) => setHideChinese(event.target.checked)} />
                  <span>Hide Chinese first</span>
                </label>
                <button className="secondary-button" type="button" onClick={exportTsv}>
                  Export Anki TSV
                </button>
              </div>

              <div className="rail-card term-card">
                <h2>Core glossary</h2>
                <div className="term-list">
                  {quest.terms.map((term) => (
                    <div className="term-row" key={term.en}>
                      <span>{term.en}</span>
                      <strong>{term.zh}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <section className="line-stack" aria-label="Bilingual dialogue lines">
              <div className="stack-header">
                <div>
                  <p className="eyebrow">Reading queue</p>
                  <h2>{filteredLines.length} visible lines</h2>
                </div>
                <a href={quest.source.enUrl} target="_blank" rel="noreferrer">
                  Open Fandom
                </a>
                <a href={quest.source.zhUrl} target="_blank" rel="noreferrer">
                  Open Chinese source
                </a>
              </div>

              {filteredLines.map((line) => (
                <DialogueCard key={line.id} line={line} hideChinese={hideChinese} />
              ))}
            </section>
          </section>
        </>
      )}
    </main>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  )
}

function getInitialTheme(): ThemeId {
  if (typeof window === 'undefined') return 'tacet'
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  return THEMES.some((theme) => theme.id === savedTheme) ? (savedTheme as ThemeId) : 'tacet'
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

  return (
    <article className={`dialogue-card confidence-${line.confidence}`}>
      <header>
        <div className="line-identity">
          <span className="line-number">#{line.id}</span>
          <span className="speaker-chip">{line.speakerEn || 'Unmatched'} / {line.speakerZh || '未匹配'}</span>
          <span className="confidence-chip">{confidenceText(line.confidence)}</span>
        </div>
        {line.audioUrl && <VoicePlayer line={line} />}
      </header>
      {line.en && <p className="english-line">{line.en}</p>}
      {line.zh && (
        <div className={`chinese-wrap ${revealed ? 'is-revealed' : ''}`}>
          {revealed ? (
            <p className="chinese-line">{line.zh}</p>
          ) : (
            <button type="button" className="reveal-button" onClick={() => setRevealed(true)}>
              Reveal Chinese
            </button>
          )}
        </div>
      )}
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
    <div className="audio-block">
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
      <div className="custom-audio" role="group" aria-label="Voice playback controls">
        <button className="play-button" type="button" onClick={() => void togglePlayback()}>
          <span aria-hidden="true">{status === 'playing' ? 'Pause' : status === 'loading' ? 'Loading' : 'Play'}</span>
        </button>
        <div className="audio-meter" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <span className="audio-time">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
      {audioError && (
        <p className="audio-warning">
          {audioError}
          {line.audioSourceUrl && (
            <>
              {' '}
              <a href={line.audioSourceUrl} target="_blank" rel="noreferrer">
                Open source file
              </a>
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
      return 'speaker matched'
    case 'sequence':
      return 'sequence matched'
    case 'low':
      return 'needs review'
    case 'unmatched':
      return 'unmatched'
  }
}

function escapeTsv(value: string) {
  return value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ').trim()
}

export default App
