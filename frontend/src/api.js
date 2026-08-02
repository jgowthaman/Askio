/** API calls — health check + SSE chat stream */

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

function url(path) {
  return `${API_BASE}${path}`
}

export async function checkHealth() {
  try {
    const res = await fetch(url('/api/health'))
    if (!res.ok) return { online: false, keyValid: false }
    const data = await res.json()
    return { online: true, keyValid: Boolean(data.gemini_key_valid), keySet: Boolean(data.gemini_key_set) }
  } catch {
    return { online: false, keyValid: false, keySet: false }
  }
}

export async function streamChat(payload, onEvent, signal) {
  const res = await fetch(url('/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })

  if (!res.ok) {
    let detail = 'Server error.'
    try {
      const data = await res.json()
      detail = data.detail || detail
    } catch { /* ignore */ }
    throw new Error(detail)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('Streaming not supported.')

  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        onEvent(JSON.parse(line.slice(6)))
      } catch { /* skip */ }
    }
  }
}
