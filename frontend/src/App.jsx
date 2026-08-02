import { useEffect } from 'react'
import { ChatProvider } from './chatState'
import ChatApp from './ChatApp'
import { loadSettings } from './utils'

export default function App() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', loadSettings().theme)
  }, [])

  return (
    <ChatProvider>
      <ChatApp />
    </ChatProvider>
  )
}
