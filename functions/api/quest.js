import { AUDIO_MP3_BY_FILE } from '../audio-manifest.js'

const DEFAULT_EN_URL = 'https://wutheringwaves.fandom.com/wiki/Utterance_of_Marvels:_I'
const DEFAULT_ZH_URL =
  'https://wiki.biligame.com/wutheringwaves/%E4%BB%BB%E5%8A%A1%E5%9B%9E%E9%A1%BE/%E4%B8%87%E8%B1%A1%E6%96%B0%E5%A3%B0%C2%B7%E4%B8%8A'

const FANDOM_API = 'https://wutheringwaves.fandom.com/api.php'
const BWIKI_RAW = 'https://wiki.biligame.com/wutheringwaves/index.php'
const KURO_API = 'https://api.kurobbs.com'
const KURO_QUEST_CATALOGUE_ID = '1249'
const KURO_WIKI_TYPE = '9'
const KURO_DEV_CODE = '0123456789abcdef0123456789abcdef'

const TERMS = [
  { en: 'Rover', zh: '漂泊者' },
  { en: 'Chixia', zh: '炽霞' },
  { en: 'Yangyang', zh: '秧秧' },
  { en: 'Baizhi', zh: '白芷' },
  { en: 'Jinhsi', zh: '今汐' },
  { en: 'Jinzhou', zh: '今州' },
  { en: 'Huanglong', zh: '瑝珑' },
  { en: 'Resonator', zh: '共鸣者' },
  { en: 'Tacet Discord', zh: '残象' },
  { en: 'Tacet Field', zh: '无音区' },
  { en: 'Etheric Sea', zh: '天空海' },
  { en: 'Terminal', zh: '终端 / 葫芦' },
  { en: 'Echo', zh: '声骸' },
  { en: 'Reverberation', zh: '残响' },
  { en: 'Sentinel', zh: '岁主' },
  { en: 'Magistrate', zh: '令尹' },
]

const SPEAKER_ALIAS = new Map([
  ['Blurry and Gentle Female Voice', '模糊且温柔的女声'],
  ['Gentle Female Voice', '温柔的女声'],
  ['Joyful Female Voice', '元气的女声'],
  ['Chixia', '炽霞'],
  ['Yangyang', '秧秧'],
  ['Baizhi', '白芷'],
  ['Jinhsi', '今汐'],
  ['Rover', '漂泊者'],
  ['???', '？？？'],
])

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=1800',
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() })
}

export async function onRequestGet({ request }) {
  try {
    const requestUrl = new URL(request.url)
    const enUrl = requestUrl.searchParams.get('enUrl') || DEFAULT_EN_URL
    const zhUrlParam = requestUrl.searchParams.get('zhUrl')
    const shouldAutoResolveZh = isAutoChineseSource(zhUrlParam)

    const enTitle = parseFandomTitle(enUrl)
    const enText = await fetchFandomWikitext(enTitle)
    const warnings = []

    let zhUrl = ''
    let zhTitle = ''
    let zhText = ''
    try {
      const zhSource = await resolveChineseSource(zhUrlParam, enText)
      zhUrl = zhSource.url
      zhTitle = zhSource.title
      zhText = zhSource.text
    } catch (error) {
      if (!shouldAutoResolveZh) throw error
      const zhTitleFromFandom = extractSimplifiedChineseTitle(enText) || enTitle
      zhTitle = zhTitleFromFandom
      zhUrl = kuroCatalogueUrl()
      warnings.push(`No Kuro quest dialogue was found for ${zhTitleFromFandom}. Paste the matching Chinese wiki URL to pair Chinese text.`)
    }

    const enEntries = parseEnglishDialogue(enText)
    const zhEntries = parseChineseDialogue(zhText, zhUrl)
    const audioMap = await fetchAudioUrls(enEntries)
    const lines = alignEntries(enEntries, zhEntries).map((line, index) => ({
      ...line,
      id: String(index + 1).padStart(4, '0'),
      ...audioFields(line.audioFile, line.audioFile ? audioMap.get(normalizeFileName(line.audioFile)) : undefined),
    }))

    const body = {
      meta: {
        enTitle,
        zhTitle,
        fetchedAt: new Date().toISOString(),
        enCount: enEntries.length,
        zhCount: zhEntries.length,
        pairedCount: lines.filter((line) => line.en && line.zh).length,
        audioCount: lines.filter((line) => line.audioUrl).length,
      },
      source: { enUrl, zhUrl },
      terms: TERMS,
      warnings,
      lines,
    }

    return json(body)
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      400,
    )
  }
}

function isAutoChineseSource(zhUrlParam) {
  return zhUrlParam !== null && (!zhUrlParam.trim() || zhUrlParam.trim().toLowerCase() === 'auto')
}

async function resolveChineseSource(zhUrlParam, enText) {
  if (zhUrlParam === null) return resolveBwikiSource(DEFAULT_ZH_URL)
  if (zhUrlParam.trim() && zhUrlParam.trim().toLowerCase() !== 'auto') return resolveExplicitChineseSource(zhUrlParam.trim())

  const zhTitle = extractSimplifiedChineseTitle(enText)
  if (!zhTitle) {
    throw new Error('No Simplified Chinese title found in the Fandom Other Languages section.')
  }

  return fetchKuroQuestByTitle(zhTitle, KURO_QUEST_CATALOGUE_ID, enText)
}

async function resolveExplicitChineseSource(input) {
  const url = new URL(input)
  if (url.hostname === 'wiki.biligame.com') return resolveBwikiSource(input)
  if (url.hostname === 'wiki.kurobbs.com') return resolveKuroSource(input)
  throw new Error('Chinese source must be a BWIKI URL or a wiki.kurobbs.com Kuro Wiki URL.')
}

async function resolveBwikiSource(zhUrl) {
  const zhTitle = parseBwikiTitle(zhUrl)
  return {
    type: 'bwiki',
    url: zhUrl,
    title: zhTitle,
    text: await fetchBwikiWikitext(zhTitle),
  }
}

function extractSimplifiedChineseTitle(wikitext) {
  return cleanBwikiQuestTitle(wikitext.match(/\|\s*zhs\s*=\s*([^\n|}]+)/)?.[1])
}

function bwikiTaskReviewUrl(title) {
  return `https://wiki.biligame.com/wutheringwaves/${encodeURI(`任务回顾/${cleanBwikiQuestTitle(title)}`)}`
}

function cleanBwikiQuestTitle(title) {
  return String(title || '')
    .replace(/[・･]/g, '·')
    .replace(/\s+/g, ' ')
    .trim()
}

function audioFields(audioFile, sourceUrl) {
  if (!sourceUrl) return {}
  const mp3Url = audioFile ? AUDIO_MP3_BY_FILE[normalizeFileName(audioFile)] : undefined
  const oggUrl = `/api/audio?url=${encodeURIComponent(sourceUrl)}`

  return {
    audioSourceUrl: sourceUrl,
    audioOggUrl: oggUrl,
    audioMp3Url: mp3Url,
    audioUrl: mp3Url || oggUrl,
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

function parseFandomTitle(input) {
  const url = new URL(input)
  if (url.hostname !== 'wutheringwaves.fandom.com') {
    throw new Error('English source must be a wutheringwaves.fandom.com wiki URL.')
  }

  const match = url.pathname.match(/^\/wiki\/(.+)$/)
  if (!match) {
    throw new Error('Fandom URL must look like https://wutheringwaves.fandom.com/wiki/Page_Title')
  }

  return decodeURIComponent(match[1]).replace(/_/g, ' ')
}

function parseBwikiTitle(input) {
  const url = new URL(input)
  if (url.hostname !== 'wiki.biligame.com') {
    throw new Error('Chinese source must be a wiki.biligame.com/wutheringwaves URL.')
  }

  if (url.searchParams.has('title')) {
    return url.searchParams.get('title') || ''
  }

  const prefix = '/wutheringwaves/'
  if (!url.pathname.startsWith(prefix)) {
    throw new Error('BWIKI URL must be under /wutheringwaves/.')
  }

  return decodeURIComponent(url.pathname.slice(prefix.length))
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

async function fetchBwikiWikitext(title) {
  const params = new URLSearchParams({
    title,
    action: 'raw',
  })
  const response = await fetch(`${BWIKI_RAW}?${params}`, bwikiRequestInit(title))
  if (!response.ok) throw new Error(`BWIKI fetch failed: HTTP ${response.status}`)

  const content = await response.text()
  if (!content.trim()) throw new Error(`No BWIKI wikitext found for ${title}.`)
  return content
}

async function resolveKuroSource(input) {
  const url = new URL(input)
  const itemId = url.pathname.match(/^\/mc\/item\/(\d+)/)?.[1]
  if (itemId) {
    const detail = await fetchKuroEntryDetail(itemId)
    return kuroDetailSource(detail)
  }

  const catalogueId = url.searchParams.get('fid') || (url.pathname.includes('/catalogue/list') ? KURO_QUEST_CATALOGUE_ID : '')
  if (catalogueId) {
    const title = url.searchParams.get('title') || ''
    if (title) return fetchKuroQuestByTitle(title, catalogueId)
    throw new Error('Kuro catalogue URLs need zhUrl=auto or a title parameter to pick a quest dialogue entry.')
  }

  throw new Error('Kuro Wiki URL must be a /mc/item/<id> entry URL or the quest catalogue list URL.')
}

async function fetchKuroQuestByTitle(zhTitle, catalogueId = KURO_QUEST_CATALOGUE_ID, enText = '') {
  const records = await fetchKuroCatalogueRecords(catalogueId)
  const record = findKuroQuestRecord(records, zhTitle) || (await findKuroQuestRecordByFandomNeighbors(records, enText))
  const entryId = kuroRecordEntryId(record)
  if (!entryId) {
    throw new Error(`No Kuro quest catalogue entry found for ${zhTitle}.`)
  }

  const parentDetail = await fetchKuroEntryDetail(entryId)
  const dialogueLink = findKuroDialogueLink(parentDetail.content, zhTitle)
  const detail = dialogueLink ? await fetchKuroEntryDetail(dialogueLink.id) : parentDetail
  return kuroDetailSource(detail)
}

function kuroDetailSource(detail) {
  const title = cleanKuroTitle(detail.content?.title || detail.name)
  return {
    type: 'kuro',
    url: kuroEntryUrl(detail.id),
    title,
    text: JSON.stringify(detail.content || {}),
  }
}

async function fetchKuroCatalogueRecords(catalogueId) {
  const data = await kuroPost('/wiki/core/catalogue/item/getPage', {
    catalogueId,
    page: '1',
    limit: '1000',
  })
  return data?.results?.records || []
}

async function fetchKuroEntryDetail(id) {
  const data = await kuroPost('/wiki/core/catalogue/item/getEntryDetail', { id: String(id) })
  if (!data?.id) throw new Error(`No Kuro entry detail found for ${id}.`)
  return data
}

async function kuroPost(path, data) {
  const response = await fetch(`${KURO_API}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      accept: 'application/json, text/plain, */*',
      source: 'h5',
      wiki_type: KURO_WIKI_TYPE,
      devcode: KURO_DEV_CODE,
      origin: 'https://wiki.kurobbs.com',
      referer: kuroCatalogueUrl(),
      'user-agent': 'GLearning/0.1 personal learning reader',
    },
    body: new URLSearchParams(transformKuroRequestParams(data)),
  })
  if (!response.ok) throw new Error(`Kuro Wiki fetch failed: HTTP ${response.status}`)

  const payload = await response.json()
  if (payload.code !== 200) throw new Error(`Kuro Wiki fetch failed: ${payload.msg || payload.code}`)
  return payload.data
}

function transformKuroRequestParams(data) {
  const params = {}
  for (const [key, value] of Object.entries(data)) {
    params[key] = Array.isArray(value) || (value && typeof value === 'object') ? JSON.stringify(value) : String(value ?? '')
  }
  return params
}

function findKuroQuestRecord(records, zhTitle) {
  const normalizedTitle = normalizeKuroTitle(zhTitle)
  const baseTitle = normalizeKuroTitle(baseQuestTitle(zhTitle))

  return (
    records.find((record) => normalizeKuroTitle(record.name) === normalizedTitle) ||
    records.find((record) => normalizeKuroTitle(record.content?.title) === normalizedTitle) ||
    records.find((record) => normalizeKuroTitle(record.name) === baseTitle) ||
    records.find((record) => normalizeKuroTitle(record.content?.title) === baseTitle) ||
    records.find((record) => normalizedTitle.includes(normalizeKuroTitle(record.name)))
  )
}

async function findKuroQuestRecordByFandomNeighbors(records, enText) {
  if (!enText) return null

  const prevTitle = extractFandomLinkedQuestTitle(enText, 'prev')
  const nextTitle = extractFandomLinkedQuestTitle(enText, 'next')
  const [prevZhTitle, nextZhTitle] = await Promise.all([
    prevTitle ? fetchFandomChineseTitle(prevTitle).catch(() => '') : '',
    nextTitle ? fetchFandomChineseTitle(nextTitle).catch(() => '') : '',
  ])
  const prevIndex = prevZhTitle ? findKuroQuestRecordIndex(records, prevZhTitle) : -1
  const nextIndex = nextZhTitle ? findKuroQuestRecordIndex(records, nextZhTitle) : -1

  if (prevIndex !== -1 && nextIndex !== -1 && Math.abs(prevIndex - nextIndex) === 2) {
    return records[Math.min(prevIndex, nextIndex) + 1]
  }
  if (prevIndex > 0) return records[prevIndex - 1]
  if (nextIndex !== -1 && nextIndex < records.length - 1) return records[nextIndex + 1]
  return null
}

function extractFandomLinkedQuestTitle(wikitext, field) {
  const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return cleanText(wikitext.match(new RegExp(`\\|\\s*${escapedField}\\s*=\\s*\\[\\[([^|\\]]+)`))?.[1])
}

async function fetchFandomChineseTitle(title) {
  return extractSimplifiedChineseTitle(await fetchFandomWikitext(title))
}

function findKuroQuestRecordIndex(records, zhTitle) {
  const record = findKuroQuestRecord(records, zhTitle)
  return record ? records.indexOf(record) : -1
}

function kuroRecordEntryId(record) {
  return record?.content?.linkConfig?.entryId || record?.content?.linkId || (typeof record?.entryId === 'string' ? record.entryId : '')
}

function findKuroDialogueLink(content, zhTitle) {
  const links = extractKuroItemLinks(content)
  if (!links.length) return null

  const normalizedTitle = normalizeKuroTitle(zhTitle)
  const baseTitle = normalizeKuroTitle(baseQuestTitle(zhTitle))
  return (
    links.find((link) => normalizeKuroTitle(link.title) === normalizedTitle) ||
    links.find((link) => normalizeKuroTitle(link.title).includes(normalizedTitle)) ||
    links.find((link) => normalizeKuroTitle(link.title).includes(baseTitle)) ||
    links[0]
  )
}

function extractKuroItemLinks(content) {
  const links = []
  const modules = content?.modules || []
  for (const module of modules) {
    for (const component of module.components || []) {
      const html = component.content || ''
      const linkRegex = /<a\b[^>]*href="https:\/\/wiki\.kurobbs\.com\/mc\/item\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g
      let match
      while ((match = linkRegex.exec(html))) {
        links.push({ id: match[1], title: cleanKuroTitle(htmlToText(match[2])) })
      }
    }
  }
  return links
}

function parseKuroDialogue(content) {
  const parsed = typeof content === 'string' ? JSON.parse(content || '{}') : content || {}
  const entries = []
  const storyIds = moduleStoryIds(parsed)
  const storyBlocks = storyIds.length ? storyIds.map((id) => parsed.story?.[id]).filter(Boolean) : Object.values(parsed.story || {})

  for (const story of storyBlocks) {
    for (const node of story?.flow?.raw || []) {
      const choice = cleanKuroTitle(node.title)
      if (choice) entries.push({ type: 'choice', speaker: '漂泊者', text: choice })
      entries.push(...parseKuroHtmlDialogue(node.content || ''))
    }
  }

  return entries.filter((entry) => entry.text)
}

function moduleStoryIds(content) {
  const ids = []
  for (const module of content.modules || []) {
    for (const component of module.components || []) {
      const storyId = component.id || component.idx
      if (component.type === 'story-component' && storyId && content.story?.[storyId]) ids.push(storyId)
    }
  }
  return ids
}

function parseKuroHtmlDialogue(html) {
  const entries = []
  const paragraphRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/g
  let match
  while ((match = paragraphRegex.exec(html))) {
    const text = cleanText(htmlToText(match[1]))
    if (!text) continue

    const speakerMatch = text.match(/^([^：:]{1,24})[：:]\s*(.+)$/)
    if (speakerMatch) {
      entries.push({ type: 'dialogue', speaker: cleanText(speakerMatch[1]), text: cleanText(speakerMatch[2]) })
    } else {
      entries.push({ type: 'dialogue', speaker: inferNamelessSpeaker(text), text })
    }
  }
  return entries
}

function htmlToText(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<img\b[^>]*>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

function baseQuestTitle(title) {
  return cleanKuroTitle(title).replace(/[·:：]\s*(?:上|下|中|一|二|三|四|五|六|七|八|九|十|I|II|III|IV|V|VI|VII|VIII|IX|X|\d+)$/i, '')
}

function cleanKuroTitle(title) {
  return String(title || '')
    .replace(/&gt;&gt;\s*/g, '')
    .replace(/点击查看(?:剧情对话)?\s*/g, '')
    .replace(/[・･]/g, '·')
    .replace(/\s*·\s*/g, '·')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeKuroTitle(title) {
  return cleanKuroTitle(title)
    .replace(/[\s《》「」『』“”"'。,.，、!！?？()（）\[\]【】]/g, '')
    .toLowerCase()
}

function kuroEntryUrl(id) {
  return `https://wiki.kurobbs.com/mc/item/${id}`
}

function kuroCatalogueUrl() {
  return `https://wiki.kurobbs.com/mc/catalogue/list?fid=${KURO_QUEST_CATALOGUE_ID}`
}

function sourceRequestInit() {
  return {
    headers: {
      'user-agent': 'GLearning/0.1 personal learning reader',
      accept: 'application/json,text/x-wiki,text/plain,*/*',
    },
  }
}

function bwikiRequestInit(title) {
  return {
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      accept: 'text/x-wiki,text/plain,*/*',
      referer: bwikiTaskReviewUrl(title),
    },
  }
}

async function fetchAudioUrls(entries) {
  const files = [...new Set(entries.map((entry) => entry.audioFile).filter(Boolean).map(normalizeFileName))]
  const audioMap = new Map()

  for (let index = 0; index < files.length; index += 40) {
    const batch = files.slice(index, index + 40)
    const params = new URLSearchParams({
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'url',
      titles: batch.map((file) => `File:${file}`).join('|'),
      format: 'json',
      formatversion: '2',
      origin: '*',
    })
    const response = await fetch(`${FANDOM_API}?${params}`, sourceRequestInit())
    if (!response.ok) continue

    const data = await response.json()
    for (const page of data?.query?.pages || []) {
      const file = normalizeFileName((page.title || '').replace(/^File:/, ''))
      const url = page.imageinfo?.[0]?.url || fandomFileRedirect(file)
      if (file) audioMap.set(file, url)
    }
  }

  for (const file of files) {
    if (!audioMap.has(file)) audioMap.set(file, fandomFileRedirect(file))
  }

  return audioMap
}

function fandomFileRedirect(file) {
  return `https://wutheringwaves.fandom.com/wiki/Special:Redirect/file/${encodeURIComponent(file)}`
}

function parseEnglishDialogue(wikitext) {
  const section = sectionBetween(wikitext, '==Dialogue==', ['==Other Languages==', '==Change History=='])
  const entries = []

  for (const rawLine of section.split('\n')) {
    let line = rawLine.trim()
    if (!line || line === '----' || !line.startsWith(':')) continue

    line = line.replace(/<!--[\s\S]*?-->/g, '')
    const audioFile = line.match(/\{\{A\|([^}]+)\}\}/)?.[1]?.trim()
    line = line
      .replace(/^:+/, '')
      .replace(/\{\{A\|[^}]+\}\}/g, '')
      .replace(/\{\{DIcon(?:\|[^}]*)?\}\}/g, '')
      .trim()

    const speakerMatch = line.match(/^'''([^']+?):'''\s*(.+)$/)
    if (speakerMatch) {
      entries.push({
        type: 'dialogue',
        speaker: cleanText(speakerMatch[1]),
        text: cleanText(speakerMatch[2]),
        audioFile,
      })
      continue
    }

    const text = cleanText(line)
    if (text && !text.startsWith("''(")) {
      entries.push({
        type: 'choice',
        speaker: 'Rover',
        text,
        audioFile,
      })
    }
  }

  return entries.filter((entry) => entry.text)
}

function parseChineseDialogue(wikitext, sourceUrl = '') {
  if (sourceUrl.includes('wiki.kurobbs.com')) return parseKuroDialogue(wikitext)

  const section = sectionBetween(wikitext, '==任务剧情==', ['==任务奖励==', '==导航=='])
  return parseChineseContent(section).filter((entry) => entry.text && entry.text !== '返回选择')
}

function parseChineseContent(content) {
  const entries = []
  let cursor = 0

  while (cursor < content.length) {
    const optionIndex = content.indexOf('{{剧情选项', cursor)
    const speakerRegex = /(?:'''([^']+)'''|\*\s*)[：:]\s*([^<\n]+)/g
    speakerRegex.lastIndex = cursor
    const speakerMatch = speakerRegex.exec(content)
    const speakerIndex = speakerMatch?.index ?? -1

    if (optionIndex !== -1 && (speakerIndex === -1 || optionIndex < speakerIndex)) {
      const end = findTemplateEnd(content, optionIndex)
      if (end === -1) {
        cursor = optionIndex + 2
        continue
      }

      entries.push(...parsePlotOptionTemplate(content.slice(optionIndex, end)))
      cursor = end
      continue
    }

    if (speakerMatch) {
      const text = cleanText(speakerMatch[2])
      entries.push({
        type: 'dialogue',
        speaker: speakerMatch[1] ? cleanText(speakerMatch[1]) : inferNamelessSpeaker(text),
        text,
      })
      cursor = speakerRegex.lastIndex
      continue
    }

    break
  }

  return entries
}

function inferNamelessSpeaker(text) {
  return /饿|餓/.test(text) ? '？？？' : '旁白'
}

function findTemplateEnd(content, start) {
  let depth = 0
  for (let index = start; index < content.length - 1; index += 1) {
    const pair = content.slice(index, index + 2)
    if (pair === '{{') {
      depth += 1
      index += 1
      continue
    }
    if (pair === '}}') {
      depth -= 1
      index += 1
      if (depth === 0) return index + 1
    }
  }
  return -1
}

function parsePlotOptionTemplate(template) {
  const body = template.replace(/^\{\{剧情选项\|?/, '').replace(/\}\}$/, '')
  const params = new Map()
  for (const param of splitTopLevelParams(body)) {
    const equals = param.indexOf('=')
    if (equals === -1) continue
    params.set(param.slice(0, equals).trim(), param.slice(equals + 1).trim())
  }

  const optionNumbers = [...params.keys()]
    .map((key) => key.match(/^选项(\d+)$/)?.[1])
    .filter(Boolean)
    .map(Number)
    .sort((left, right) => left - right)

  const entries = []
  for (const number of optionNumbers) {
    const option = cleanText(params.get(`选项${number}`))
    if (option) {
      entries.push({ type: 'choice', speaker: '漂泊者', text: option })
    }

    const plot = params.get(`剧情${number}`)
    if (plot) {
      entries.push(...parseChineseContent(plot))
    }
  }

  return entries
}

function splitTopLevelParams(body) {
  const params = []
  let depth = 0
  let start = 0

  for (let index = 0; index < body.length; index += 1) {
    const pair = body.slice(index, index + 2)
    if (pair === '{{') {
      depth += 1
      index += 1
      continue
    }
    if (pair === '}}') {
      depth = Math.max(0, depth - 1)
      index += 1
      continue
    }
    if (body[index] === '|' && depth === 0) {
      params.push(body.slice(start, index))
      start = index + 1
    }
  }

  params.push(body.slice(start))
  return params
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

function alignEntries(enEntries, zhEntries) {
  const gap = -2
  const rows = enEntries.length + 1
  const columns = zhEntries.length + 1
  const scores = Array.from({ length: rows }, () => Array(columns).fill(0))
  const moves = Array.from({ length: rows }, () => Array(columns).fill(''))

  for (let row = 1; row < rows; row += 1) {
    scores[row][0] = scores[row - 1][0] + gap
    moves[row][0] = 'up'
  }
  for (let column = 1; column < columns; column += 1) {
    scores[0][column] = scores[0][column - 1] + gap
    moves[0][column] = 'left'
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const diagonal = scores[row - 1][column - 1] + pairScore(enEntries[row - 1], zhEntries[column - 1])
      const up = scores[row - 1][column] + gap
      const left = scores[row][column - 1] + gap

      if (diagonal >= up && diagonal >= left) {
        scores[row][column] = diagonal
        moves[row][column] = 'diag'
      } else if (up >= left) {
        scores[row][column] = up
        moves[row][column] = 'up'
      } else {
        scores[row][column] = left
        moves[row][column] = 'left'
      }
    }
  }

  const lines = []
  let row = enEntries.length
  let column = zhEntries.length
  while (row > 0 || column > 0) {
    const move = moves[row][column]
    if (move === 'diag') {
      const enEntry = enEntries[row - 1]
      const zhEntry = zhEntries[column - 1]
      lines.push(toLine(enEntry, zhEntry, confidenceForPair(enEntry, zhEntry)))
      row -= 1
      column -= 1
    } else if (move === 'up') {
      lines.push(toLine(enEntries[row - 1], undefined, 'unmatched'))
      row -= 1
    } else {
      lines.push(toLine(undefined, zhEntries[column - 1], 'unmatched'))
      column -= 1
    }
  }

  return lines.reverse()
}

function pairScore(enEntry, zhEntry) {
  if (enEntry.type !== zhEntry.type) return -4
  if (enEntry.type === 'choice') return 0.75
  return sameSpeaker(enEntry, zhEntry) ? 6 : -3
}

function confidenceForPair(enEntry, zhEntry) {
  if (enEntry.type === 'choice' && zhEntry.type === 'choice') return 'sequence'
  if (sameSpeaker(enEntry, zhEntry)) return 'speaker'
  return enEntry.type === zhEntry.type ? 'low' : 'unmatched'
}

function sameSpeaker(enEntry, zhEntry) {
  if (enEntry.type === 'choice' && zhEntry.type === 'choice') return true
  const expectedZh = SPEAKER_ALIAS.get(enEntry.speaker) || enEntry.speaker
  return normalizeSpeaker(expectedZh) === normalizeSpeaker(zhEntry.speaker)
}

function toLine(enEntry, zhEntry, confidence) {
  return {
    id: '',
    type: enEntry?.type || zhEntry?.type || 'dialogue',
    speakerEn: enEntry?.speaker || '',
    speakerZh: zhEntry?.speaker || '',
    en: enEntry?.text || '',
    zh: zhEntry?.text || '',
    audioFile: enEntry?.audioFile,
    confidence,
  }
}

function cleanText(value) {
  return decodeEntities(
    String(value || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/\{\{Rubi\|([^|{}]+)\|[^{}]+\}\}/g, '$1')
      .replace(/\{\{MC\|m=([^|{}]+)\|f=([^|{}]+)\}\}/g, '$1/$2')
      .replace(/\{\{MC\|f=([^|{}]+)\|m=([^|{}]+)\}\}/g, '$2/$1')
      .replace(/\{\{color\|[^|{}]+\|([^|{}]+)(?:\|[^{}]+)?\}\}/g, '$1')
      .replace(/\{\{颜色\|[^|{}]+\|([^|{}]+)\}\}/g, '$1')
      .replace(/\{\{注音\|2=([^|{}]+)\|1=([^|{}]+)\}\}/g, '$1 $2')
      .replace(/\{\{注音\|1=([^|{}]+)\|2=([^|{}]+)\}\}/g, '$2 $1')
      .replace(/\{\{注音\|([^|{}]+)\|([^|{}]+)\}\}/g, '$2 $1')
      .replace(/\{\{sic\|([^|{}]+)\}\}/g, '$1')
      .replace(/\{\{[^|{}]+\|([^|{}]+)(?:\|[^{}]*)?\}\}/g, '$1')
      .replace(/\{\{剧情选项\|/g, '')
      .replace(/\{\{[^{}]+\}\}/g, '')
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
    .replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '…')
    .replace(/&middot;/g, '·')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rsquo;/g, '’')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function normalizeSpeaker(value) {
  return String(value || '')
    .replace(/[\s:：。,.，]/g, '')
    .toLowerCase()
}

function normalizeFileName(file) {
  return String(file || '').trim().replace(/_/g, ' ')
}
