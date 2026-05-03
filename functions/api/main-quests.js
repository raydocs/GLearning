const FANDOM_API = 'https://wutheringwaves.fandom.com/api.php'
const MAIN_QUEST_TITLE = 'Main Quest'
const FANDOM_WIKI_BASE = 'https://wutheringwaves.fandom.com/wiki/'

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=3600',
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() })
}

export async function onRequestGet() {
  try {
    const wikitext = await fetchFandomWikitext(MAIN_QUEST_TITLE)
    return json({
      source: `${FANDOM_WIKI_BASE}${encodeURIComponent(MAIN_QUEST_TITLE.replace(/ /g, '_'))}`,
      fetchedAt: new Date().toISOString(),
      quests: parseMainQuestList(wikitext),
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 400)
  }
}

async function fetchFandomWikitext(title) {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'revisions',
    titles: title,
    rvprop: 'content',
    rvslots: 'main',
    format: 'json',
    formatversion: '2',
    origin: '*',
  })
  const response = await fetch(`${FANDOM_API}?${params}`, sourceRequestInit())
  if (!response.ok) throw new Error(`Fandom fetch failed: HTTP ${response.status}`)

  const data = await response.json()
  const page = data?.query?.pages?.[0]
  const content = page?.revisions?.[0]?.slots?.main?.content || page?.revisions?.[0]?.content
  if (!content) throw new Error(`No Fandom wikitext found for ${title}.`)
  return content
}

function parseMainQuestList(wikitext) {
  const section = sectionBetween(wikitext, '==List of Main Quests==', ['==List of Event Main Quests=='])
  const quests = []
  let chapter = 'Main Quests'

  for (const rawLine of section.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const chapterMatch = line.match(/^!\s*colspan="3"\s*\|\s*(.+)$/)
    if (chapterMatch) {
      chapter = cleanMarkup(chapterMatch[1])
      continue
    }

    if (line.startsWith('*')) {
      const linked = firstWikiLink(line)
      if (linked) quests.push(toQuest(linked, chapter, 'Quest'))
      continue
    }

    if (!line.startsWith('|') || !line.includes("'''")) continue

    const boldContent = line.match(/'''(.+?)(?:'''|$)/)?.[1]
    if (!boldContent) continue

    const linked = firstWikiLink(boldContent)
    if (!linked) continue

    const prefix = cleanMarkup(boldContent.slice(0, boldContent.indexOf('[['))).replace(/:$/, '')
    quests.push(toQuest(linked, chapter, prefix || 'Quest'))
  }

  return dedupeQuests(quests)
}

function toQuest(linked, chapter, act) {
  return {
    id: slugify(linked.page),
    chapter,
    act,
    title: linked.label,
    fandomTitle: linked.page,
    enUrl: `${FANDOM_WIKI_BASE}${encodeURI(linked.page.replace(/ /g, '_'))}`,
  }
}

function firstWikiLink(value) {
  const match = value.match(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/)
  if (!match) return null
  const page = cleanMarkup(match[1])
  if (!page || page.startsWith('File:') || page === 'Union Level') return null
  return { page, label: cleanMarkup(match[2] || match[1]) }
}

function dedupeQuests(quests) {
  const seen = new Set()
  return quests.filter((quest) => {
    if (seen.has(quest.enUrl)) return false
    seen.add(quest.enUrl)
    return true
  })
}

function sectionBetween(wikitext, startHeader, endHeaders) {
  const start = wikitext.indexOf(startHeader)
  if (start === -1) return wikitext

  let end = wikitext.length
  for (const header of endHeaders) {
    const index = wikitext.indexOf(header, start + startHeader.length)
    if (index !== -1 && index < end) end = index
  }

  return wikitext.slice(start + startHeader.length, end)
}

function cleanMarkup(value) {
  return decodeEntities(
    String(value || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/'''/g, '')
      .replace(/''/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

function decodeEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function sourceRequestInit() {
  return {
    headers: {
      'user-agent': 'GLearning/0.1 personal learning reader',
      accept: 'application/json,text/x-wiki,text/plain,*/*',
    },
  }
}

function corsHeaders() {
  return {
    ...JSON_HEADERS,
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(),
  })
}
