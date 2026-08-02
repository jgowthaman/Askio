/** Constants, session ID, export, formatting */

import { v4 as uuidv4 } from 'uuid'

export const MAX_CHARS = 4000
export const MODES = [
  { value: 'simple', label: 'Simple' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'professional', label: 'Professional' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'programmer', label: 'Programmer' },
  { value: 'interviewer', label: 'Interviewer' },
]

const SESSION_KEY = 'askio_session_id'
const SETTINGS_KEY = 'askio_settings'

export const defaultSettings = {
  mode: 'simple',
  temperature: 0.7,
  maxTokens: 512,
  theme: 'dark',
  voiceEnabled: false,
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings
  } catch {
    return defaultSettings
  }
}

export function saveSettings(next) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  document.documentElement.setAttribute('data-theme', next.theme)
}

export function getSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = uuidv4()
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

export function resetSessionId() {
  const id = uuidv4()
  sessionStorage.setItem(SESSION_KEY, id)
  return id
}

export function formatLatency(ms) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

export function formatTokens(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

export function downloadChat(messages, type) {
  if (!messages.length) return
  if (type === 'txt') {
    const text = messages.map((m) => `${m.role === 'user' ? 'You' : 'Askio'}: ${m.content}`).join('\n\n')
    blobDownload(text, 'askio-chat.txt', 'text/plain')
  } else if (type === 'md') {
    const md = messages.map((m) => `## ${m.role === 'user' ? 'You' : 'Askio'}\n\n${m.content}`).join('\n')
    blobDownload(`# Askio Chat\n\n${md}`, 'askio-chat.md', 'text/markdown')
  } else {
    const html = `<html><body style="font-family:sans-serif;padding:2rem">${messages.map((m) => `<p><b>${m.role}</b></p><p>${m.content}</p>`).join('')}</body></html>`
    const w = window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })))
    w?.print()
  }
}

function blobDownload(content, name, type) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type }))
  a.download = name
  a.click()
}
