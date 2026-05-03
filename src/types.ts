export type PairConfidence = 'speaker' | 'sequence' | 'low' | 'unmatched'

export type QuestLine = {
  id: string
  type: 'dialogue' | 'choice'
  speakerEn: string
  speakerZh: string
  en: string
  zh: string
  audioFile?: string
  audioUrl?: string
  audioOggUrl?: string
  audioMp3Url?: string
  audioSourceUrl?: string
  confidence: PairConfidence
}

export type QuestTerm = {
  en: string
  zh: string
}

export type MainQuestOption = {
  id: string
  chapter: string
  act: string
  title: string
  fandomTitle: string
  enUrl: string
}

export type MainQuestCatalogResponse = {
  source: string
  fetchedAt: string
  quests: MainQuestOption[]
}

export type QuestResponse = {
  meta: {
    enTitle: string
    zhTitle: string
    fetchedAt: string
    enCount: number
    zhCount: number
    pairedCount: number
    audioCount: number
  }
  source: {
    enUrl: string
    zhUrl: string
  }
  terms: QuestTerm[]
  warnings?: string[]
  lines: QuestLine[]
}
