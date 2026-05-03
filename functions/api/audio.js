const ALLOWED_AUDIO_HOSTS = ['static.wikia.nocookie.net']

export async function onRequestOptions() {
  return new Response(null, { headers: audioCorsHeaders() })
}

export async function onRequestGet({ request }) {
  return proxyAudio(request, false)
}

export async function onRequestHead({ request }) {
  return proxyAudio(request, true)
}

async function proxyAudio(request, headOnly) {
  const requestUrl = new URL(request.url)
  const audioUrl = requestUrl.searchParams.get('url')

  if (!audioUrl) {
    return new Response('Missing audio URL.', { status: 400, headers: audioCorsHeaders() })
  }

  let source
  try {
    source = new URL(audioUrl)
  } catch {
    return new Response('Invalid audio URL.', { status: 400, headers: audioCorsHeaders() })
  }

  if (source.protocol !== 'https:' || !ALLOWED_AUDIO_HOSTS.includes(source.hostname)) {
    return new Response('Audio host is not allowed.', { status: 400, headers: audioCorsHeaders() })
  }

  const range = request.headers.get('range')
  const upstream = await fetch(source, {
    headers: range ? { range, accept: 'audio/ogg,*/*' } : { accept: 'audio/ogg,*/*' },
  })

  if (!upstream.ok && upstream.status !== 206) {
    return new Response('Failed to fetch source audio.', {
      status: upstream.status,
      headers: audioCorsHeaders(),
    })
  }

  const headers = audioResponseHeaders(upstream)
  if (headOnly) return emptyAudioResponse(upstream)

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  })
}

function emptyAudioResponse(upstream) {
  const headers = audioResponseHeaders(upstream)
  return new Response(null, {
    status: upstream.status,
    headers,
  })
}

function audioCorsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-allow-headers': 'range, content-type',
  }
}

function audioResponseHeaders(upstream) {
  const headers = new Headers(audioCorsHeaders())
  headers.set('content-type', upstream.headers.get('content-type') || 'audio/ogg')
  headers.set('cache-control', 'public, max-age=604800')
  headers.set('content-disposition', 'inline')
  headers.set('accept-ranges', upstream.headers.get('accept-ranges') || 'bytes')

  for (const name of ['content-length', 'content-range', 'etag', 'last-modified']) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }

  return headers
}
