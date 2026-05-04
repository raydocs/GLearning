import type { QuestLine, QuestResponse, QuestTerm } from './types'

export type LanguageHelpMatchSource = 'english' | 'chinese' | 'both'
export type LanguageHelpWordSource = 'quest-glossary' | 'built-in-rules'
export type LanguageHelpPatternId =
  | 'question'
  | 'modal'
  | 'contraction'
  | 'imperative'
  | 'negative'
  | 'conditional'
  | 'comparison'
  | 'infinitive-purpose'
  | 'quotation'
  | 'player-choice'

export type LanguageHelpTermMatch = QuestTerm & {
  matchedBy: LanguageHelpMatchSource
}

export type LanguageHelpKeyChunk = {
  surface: string
  label: string
  meaningZh: string
  note: string
  source: LanguageHelpWordSource
}

export type LanguageHelpPattern = {
  id: LanguageHelpPatternId
  label: string
  evidence: string
  explanation: string
}

export type LanguageHelp = {
  line: QuestLine
  terms: LanguageHelpTermMatch[]
  keyChunks: LanguageHelpKeyChunk[]
  patterns: LanguageHelpPattern[]
  readingStrategy: string
}

type BuiltInChunk = {
  surface: string
  label: string
  meaningZh: string
  note: string
  pattern: RegExp
}

const BUILT_IN_CHUNKS: BuiltInChunk[] = [
  { surface: 'can', label: 'modal', meaningZh: '能；可以', note: 'Marks ability or permission; check whether the speaker is able, allowed, or offering help.', pattern: /\bcan\b/i },
  { surface: 'could', label: 'modal', meaningZh: '能；可以；可能', note: 'Often softens a request or possibility compared with can.', pattern: /\bcould\b/i },
  { surface: 'will', label: 'modal', meaningZh: '将会；愿意', note: 'Points to future action, promise, or willingness.', pattern: /\bwill\b/i },
  { surface: 'would', label: 'modal', meaningZh: '会；愿意；将', note: 'Often makes intent, guesses, or requests sound less direct.', pattern: /\bwould\b/i },
  { surface: 'should', label: 'modal', meaningZh: '应该', note: 'Signals advice, expectation, or the speaker’s judgement.', pattern: /\bshould\b/i },
  { surface: 'must', label: 'modal', meaningZh: '必须；一定', note: 'Signals duty, strong necessity, or a confident conclusion.', pattern: /\bmust\b/i },
  { surface: 'may / might', label: 'modal', meaningZh: '可能；可以', note: 'Marks possibility or permission; the line is less certain.', pattern: /\b(?:may|might)\b/i },
  { surface: 'but', label: 'connector', meaningZh: '但是', note: 'Shows contrast; compare what changes after this word.', pattern: /\bbut\b/i },
  { surface: 'because', label: 'connector', meaningZh: '因为', note: 'Introduces a reason or cause.', pattern: /\bbecause\b/i },
  { surface: 'so', label: 'connector', meaningZh: '所以；那么', note: 'Often introduces a result, conclusion, or next move.', pattern: /\bso\b/i },
  { surface: 'if', label: 'connector', meaningZh: '如果', note: 'Sets a condition; read the line as condition → result.', pattern: /\bif\b/i },
  { surface: 'when', label: 'time connector', meaningZh: '当……时', note: 'Anchors the action to a time or situation.', pattern: /\bwhen\b/i },
  { surface: "I'm / you're / we're", label: 'contraction', meaningZh: '口语缩写', note: 'A shortened spoken form; expand it when checking meaning.', pattern: /\b(?:I['’]m|you['’]re|we['’]re|they['’]re)\b/i },
  { surface: "don't / can't / won't", label: 'negative contraction', meaningZh: '否定缩写', note: 'The apostrophe hides not; expand it before translating.', pattern: /\b(?:don['’]t|can['’]t|won['’]t|isn['’]t|aren['’]t|wasn['’]t|weren['’]t|haven['’]t|hasn['’]t|hadn['’]t|shouldn['’]t|wouldn['’]t|couldn['’]t|mustn['’]t)\b/i },
  { surface: 'not / never / no', label: 'negative', meaningZh: '不；从不；没有', note: 'Negatives flip the action or expectation; locate exactly what is negated.', pattern: /\b(?:not|never|no|nothing|nobody|nowhere)\b/i },
  { surface: 'let me / let us', label: 'game-dialogue chunk', meaningZh: '让我；让我们', note: 'Often introduces an offer, suggestion, or immediate action.', pattern: /\blet\s+(?:me|us|'s)\b/i },
  { surface: 'we need to', label: 'game-dialogue chunk', meaningZh: '我们需要', note: 'Shows a mission objective or urgent required action.', pattern: /\bwe\s+need\s+to\b/i },
  { surface: 'have to', label: 'necessity chunk', meaningZh: '不得不；必须', note: 'Shows practical necessity rather than just desire.', pattern: /\bhave\s+to\b/i },
  { surface: 'about to', label: 'time chunk', meaningZh: '即将', note: 'Means an action is going to happen very soon.', pattern: /\babout\s+to\b/i },
  { surface: 'there is / there are', label: 'existence chunk', meaningZh: '有；存在', note: 'Introduces something in the scene before describing it.', pattern: /\bthere\s+(?:is|are|was|were|'s)\b/i },
  { surface: 'it seems', label: 'stance chunk', meaningZh: '似乎；看来', note: 'Signals observation or uncertainty, not a confirmed fact.', pattern: /\bit\s+seems\b/i },
  { surface: 'as long as', label: 'condition chunk', meaningZh: '只要', note: 'Sets a required condition for the result.', pattern: /\bas\s+long\s+as\b/i },
  { surface: 'in order to', label: 'purpose chunk', meaningZh: '为了', note: 'Introduces a purpose or goal.', pattern: /\bin\s+order\s+to\b/i },
  { surface: 'rather than', label: 'comparison chunk', meaningZh: '而不是', note: 'Contrasts the chosen idea with the rejected one.', pattern: /\brather\s+than\b/i },
  { surface: 'please', label: 'politeness marker', meaningZh: '请', note: 'Softens a request or command.', pattern: /\bplease\b/i },
]

export function buildLanguageHelp(quest: QuestResponse, selectedLineId: string): LanguageHelp | null {
  if (!selectedLineId) return null
  const line = quest.lines.find((candidate) => candidate.id === selectedLineId)
  if (!line) return null

  const terms = matchLineGlossaryTerms(quest.terms, line)
  const patterns = buildGrammarPatterns(line)

  return {
    line,
    terms,
    keyChunks: buildKeyChunks(terms, line),
    patterns,
    readingStrategy: buildReadingStrategy(line, terms, patterns),
  }
}

function matchLineGlossaryTerms(terms: QuestTerm[], line: QuestLine): LanguageHelpTermMatch[] {
  const normalizedLineEn = normalizeHelpText(line.en)
  const normalizedLineZh = normalizeHelpText(line.zh)
  const matched = new Map<string, LanguageHelpTermMatch>()

  terms.forEach((term) => {
    const normalizedEn = normalizeHelpText(term.en)
    const normalizedZh = normalizeHelpText(term.zh)
    const englishMatch = normalizedEn.length >= 3 && normalizedLineEn.includes(normalizedEn)
    const chineseMatch = Boolean(normalizedZh && normalizedLineZh.includes(normalizedZh))

    if (!englishMatch && !chineseMatch) return
    const matchedBy: LanguageHelpMatchSource = englishMatch && chineseMatch ? 'both' : englishMatch ? 'english' : 'chinese'
    matched.set(`${normalizedEn}|${normalizedZh}`, { ...term, matchedBy })
  })

  return [...matched.values()].sort((left, right) => right.en.length - left.en.length).slice(0, 6)
}

function buildKeyChunks(terms: LanguageHelpTermMatch[], line: QuestLine): LanguageHelpKeyChunk[] {
  const chunks: LanguageHelpKeyChunk[] = []
  const seen = new Set<string>()

  terms.forEach((term) => {
    pushUniqueChunk(chunks, seen, {
      surface: term.en || term.zh,
      label: 'source glossary',
      meaningZh: term.zh || '来源词条',
      note: `Matched by ${matchSourceLabel(term.matchedBy)} in this quest source glossary.`,
      source: 'quest-glossary',
    })
  })

  BUILT_IN_CHUNKS.forEach((chunk) => {
    if (!chunk.pattern.test(line.en)) return
    pushUniqueChunk(chunks, seen, {
      surface: chunk.surface,
      label: chunk.label,
      meaningZh: chunk.meaningZh,
      note: chunk.note,
      source: 'built-in-rules',
    })
  })

  return chunks.slice(0, 8)
}

function pushUniqueChunk(chunks: LanguageHelpKeyChunk[], seen: Set<string>, chunk: LanguageHelpKeyChunk) {
  const key = `${normalizeHelpText(chunk.surface)}|${chunk.source}`
  if (!chunk.surface || seen.has(key)) return
  seen.add(key)
  chunks.push(chunk)
}

function buildGrammarPatterns(line: QuestLine): LanguageHelpPattern[] {
  const text = `${line.en} ${line.zh}`
  const patterns: LanguageHelpPattern[] = []
  const english = line.en || ''

  if (line.type === 'choice') {
    patterns.push({
      id: 'player-choice',
      label: 'Player-choice wording',
      evidence: 'choice line',
      explanation: 'Read this as an option selected by the player, not neutral narration from the scene.',
    })
  }

  if (/[?？]/.test(text) || /^(?:who|what|when|where|why|how|do|does|did|is|are|was|were|can|could|will|would|should|may|might|must)\b/i.test(english.trim())) {
    patterns.push({
      id: 'question',
      label: 'Question / check',
      evidence: findEvidence(text, /[^.!?。！？]*[?？]/) || findEvidence(english, /\b(?:who|what|when|where|why|how|do|does|did|is|are|was|were|can|could|will|would|should|may|might|must)\b[^.!?]*/i),
      explanation: 'Start by identifying what information, permission, or confirmation the speaker wants.',
    })
  }

  const modalEvidence = findEvidence(english, /\b(?:can|could|will|would|should|must|may|might)\b/i)
  if (modalEvidence) {
    patterns.push({
      id: 'modal',
      label: 'Modal attitude',
      evidence: modalEvidence,
      explanation: 'The modal changes the tone: ability, possibility, advice, duty, future intent, or willingness.',
    })
  }

  const contractionEvidence = findEvidence(english, /\b\w+['’](?:m|re|ve|ll|d|s|t)\b/i)
  if (contractionEvidence) {
    patterns.push({
      id: 'contraction',
      label: 'Spoken contraction',
      evidence: contractionEvidence,
      explanation: 'Expand the shortened form first; it usually makes dialogue sound more conversational.',
    })
  }

  const negativeEvidence = findEvidence(text, /\b(?:not|never|no|nothing|nobody|nowhere|don['’]t|can['’]t|won['’]t|isn['’]t|aren['’]t|wasn['’]t|weren['’]t|haven['’]t|hasn['’]t|hadn['’]t|shouldn['’]t|wouldn['’]t|couldn['’]t|mustn['’]t)\b|[不没無勿别]/i)
  if (negativeEvidence) {
    patterns.push({
      id: 'negative',
      label: 'Negative meaning',
      evidence: negativeEvidence,
      explanation: 'Find the verb or idea being negated before translating the rest of the line.',
    })
  }

  const conditionalEvidence = findEvidence(english, /\b(?:if|unless|as long as|provided that)\b/i)
  if (conditionalEvidence) {
    patterns.push({
      id: 'conditional',
      label: 'Condition → result',
      evidence: conditionalEvidence,
      explanation: 'Split the line into condition and outcome; game dialogue often uses this for plans or warnings.',
    })
  }

  const comparisonEvidence = findEvidence(english, /\b(?:more|less|better|worse|rather than|than|as\s+\w+\s+as)\b/i)
  if (comparisonEvidence) {
    patterns.push({
      id: 'comparison',
      label: 'Comparison / contrast',
      evidence: comparisonEvidence,
      explanation: 'Notice what two ideas are being compared or contrasted.',
    })
  }

  const purposeEvidence = findEvidence(english, /\b(?:to|in order to|so as to)\s+[a-z]+\b/i)
  if (purposeEvidence) {
    patterns.push({
      id: 'infinitive-purpose',
      label: 'Purpose with “to”',
      evidence: purposeEvidence,
      explanation: 'A to + verb chunk can show the goal of an action: what someone is trying to do.',
    })
  }

  if (isLikelyImperative(english)) {
    patterns.push({
      id: 'imperative',
      label: 'Command / request',
      evidence: findEvidence(english, /^(?:please\s+)?[a-z]+(?:\s+[^.!?]*)?/i) || english.slice(0, 60),
      explanation: 'The line starts like an instruction or request; identify the action the listener should take.',
    })
  }

  const quotationEvidence = findEvidence(text, /(["“”「」『』《》])|(^|[\s([{])'[^']+'(?=$|[\s,.;:!?)}\]])/)
  if (quotationEvidence) {
    patterns.push({
      id: 'quotation',
      label: 'Quoted words',
      evidence: quotationEvidence,
      explanation: 'Quoted text is being repeated, named, or highlighted inside the dialogue line.',
    })
  }

  return dedupePatterns(patterns).slice(0, 4)
}

function dedupePatterns(patterns: LanguageHelpPattern[]) {
  const seen = new Set<LanguageHelpPatternId>()
  return patterns.filter((pattern) => {
    if (seen.has(pattern.id)) return false
    seen.add(pattern.id)
    return true
  })
}

function isLikelyImperative(english: string) {
  const trimmed = english.trim()
  if (!trimmed || /[?？]$/.test(trimmed)) return false
  return /^(?:please\s+)?(?:go|come|look|listen|take|bring|find|follow|wait|stop|keep|let|remember|tell|give|check|open|stay|leave|watch|hold|help|try|use|head|meet|talk|show)\b/i.test(trimmed)
}

function buildReadingStrategy(line: QuestLine, terms: LanguageHelpTermMatch[], patterns: LanguageHelpPattern[]) {
  if (line.type === 'choice') {
    return 'Read it as a selectable player intent: choose the main action, then compare how the Chinese option frames tone.'
  }

  if (patterns.some((pattern) => pattern.id === 'question')) {
    return 'Find the question target first, then use matched terms and modals to decide whether it asks for facts, permission, or confirmation.'
  }

  if (patterns.some((pattern) => pattern.id === 'conditional')) {
    return 'Split the sentence into condition → result, then map any glossary terms to the mission or scene context.'
  }

  if (terms.length) {
    return 'Anchor on the source glossary term, identify the speaker’s main verb, then compare how the Chinese line carries the same intent.'
  }

  if (patterns.some((pattern) => pattern.id === 'negative')) {
    return 'Locate the negative word first, decide what it cancels, then read the rest as the speaker’s reason or reaction.'
  }

  return 'Identify speaker intent → find the main verb chunk → compare how the Chinese line frames tone or context.'
}

function findEvidence(value: string, pattern: RegExp) {
  const match = value.match(pattern)
  return cleanEvidence(match?.[0] || '')
}

function cleanEvidence(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 96)
}

function matchSourceLabel(source: LanguageHelpMatchSource) {
  switch (source) {
    case 'english':
      return 'English'
    case 'chinese':
      return 'Chinese'
    case 'both':
      return 'English + Chinese'
  }
}

function normalizeHelpText(value: string) {
  return value.normalize('NFKC').replace(/[’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase()
}
