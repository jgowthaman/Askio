/** Chat state: messages, settings, send/stream logic */

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { streamChat } from './api'
import { MAX_CHARS, defaultSettings, getSessionId, loadSettings, resetSessionId, saveSettings } from './utils'

const ChatContext = createContext(null)

export function ChatProvider({ children }) {
  const [messages, setMessages] = useState([])
  const [settings, setSettingsState] = useState(loadSettings)
  const [isLoading, setIsLoading] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [error, setError] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const sessionRef = useRef(getSessionId())
  const abortRef = useRef(null)

  const setSettings = useCallback((patch) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return
    if (trimmed.length > MAX_CHARS) {
      setError(`Message exceeds ${MAX_CHARS} characters.`)
      return
    }

    setError(null)
    setMetrics(null)
    setIsLoading(true)
    setStatusText('Understanding...')

    const assistantId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: trimmed },
      { id: assistantId, role: 'assistant', content: '' },
    ])

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    let accumulated = ''

    try {
      await streamChat(
        {
          session_id: sessionRef.current,
          message: trimmed,
          mode: settings.mode,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
        },
        (event) => {
          if (event.type === 'status') setStatusText(event.text)
          else if (event.type === 'delta') {
            accumulated += event.text
            setStatusText('')
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + event.text } : m)),
            )
          } else if (event.type === 'done') {
            setMetrics(event.metrics)
            setStatusText('')
            if (settings.voiceEnabled && accumulated && window.speechSynthesis) {
              window.speechSynthesis.cancel()
              window.speechSynthesis.speak(new SpeechSynthesisUtterance(accumulated))
            }
          } else if (event.type === 'error') {
            setError(event.message)
            setMessages((prev) => prev.filter((m) => m.id !== assistantId))
          }
        },
        abortRef.current.signal,
      )
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to send.')
        setMessages((prev) => prev.filter((m) => m.id !== assistantId))
      }
    } finally {
      setIsLoading(false)
      setStatusText('')
    }
  }, [isLoading, settings])

  const clearChat = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
    setMetrics(null)
    sessionRef.current = resetSessionId()
  }, [])

  const value = {
    messages,
    settings,
    setSettings,
    isLoading,
    statusText,
    error,
    metrics,
    sendMessage,
    clearChat,
    newChat: clearChat,
    dismissError: () => setError(null),
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be inside ChatProvider')
  return ctx
}
