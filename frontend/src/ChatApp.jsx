/** Entire Askio UI — sidebar, chat, input, settings, markdown */
"use no memo";

import { Component, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { checkHealth } from "./api";
import { useChat } from "./chatState";
import {
  MAX_CHARS,
  MODES,
  downloadChat,
  formatLatency,
  formatTokens,
} from "./utils";

export default function ChatApp() {
  const chat = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-full bg-[var(--bg-primary)]">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSettings={() => {
          setSidebarOpen(false);
          setSettingsOpen(true);
        }}
        chat={chat}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <button
          type="button"
          className="lg:hidden p-3"
          onClick={() => setSidebarOpen(true)}
        >
          ☰
        </button>
        <Header metrics={chat.metrics} />
        {chat.error && (
          <div className="mx-4 mt-2 flex justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            <span>{chat.error}</span>
            <button type="button" onClick={chat.dismissError}>
              ✕
            </button>
          </div>
        )}
        <MessageArea
          messages={chat.messages}
          isLoading={chat.isLoading}
          statusText={chat.statusText}
        />
        {chat.metrics && <MetricsBar metrics={chat.metrics} />}
        <InputBar sendMessage={chat.sendMessage} isLoading={chat.isLoading} />
      </div>
      {settingsOpen && (
        <SettingsPanel chat={chat} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

/* ---------- Header ---------- */

function Header({ metrics }) {
  const [health, setHealth] = useState({ online: true, keyValid: true });
  useEffect(() => {
    checkHealth().then(setHealth);
    const t = setInterval(() => checkHealth().then(setHealth), 30000);
    return () => clearInterval(t);
  }, []);

  const label = !health.online
    ? "Offline"
    : !health.keyValid
      ? "Invalid key"
      : "Online";

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 glass-panel">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center font-bold text-white">
          A
        </div>
        <div>
          <h1 className="text-lg font-semibold">Askio</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Ask Anything. Every Language.
          </p>
        </div>
      </div>
      <div className="flex gap-4 text-xs text-[var(--text-secondary)]">
        {metrics && (
          <span className="hidden sm:inline">
            Latency: {formatLatency(metrics.latency_ms)}
          </span>
        )}
        <span>Gemini Flash</span>
        <span className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${health.online && health.keyValid ? "bg-green-400" : "bg-amber-400"}`}
          />
          {label}
        </span>
      </div>
    </header>
  );
}

/* ---------- Sidebar ---------- */

function Sidebar({ open, onClose, onSettings, chat }) {
  const btn = (label, icon, onClick, disabled) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full flex gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-white/10 disabled:opacity-40 text-left"
    >
      <span className="text-violet-400 w-5 text-center">{icon}</span>
      {label}
    </button>
  );

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed lg:static z-50 w-64 glass-panel border-r border-white/10 flex flex-col transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-4 font-semibold border-b border-white/10">Askio</div>
        <nav className="flex-1 p-3 space-y-1">
          {btn("New Chat", "+", chat.newChat)}
          {btn("Clear Chat", "×", chat.clearChat)}
          <p className="px-3 pt-3 text-xs text-gray-500 uppercase">Export</p>
          {btn(
            "Download TXT",
            "↓",
            () => downloadChat(chat.messages, "txt"),
            !chat.messages.length,
          )}
          {btn(
            "Download MD",
            "↓",
            () => downloadChat(chat.messages, "md"),
            !chat.messages.length,
          )}
          {btn("Settings", "⚙", onSettings)}
        </nav>
      </aside>
    </>
  );
}

/* ---------- Messages ---------- */

function MessageArea({ messages, isLoading, statusText }) {
  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, statusText]);

  const lastHasContent =
    messages.at(-1)?.role === "assistant" && messages.at(-1)?.content;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {!messages.length && (
        <div className="flex flex-col items-center justify-center h-full opacity-60 text-center">
          <h2 className="text-2xl font-semibold mb-2">Ask Anything</h2>
          <p className="text-[var(--text-secondary)]">
            Every language. Instant answers.
          </p>
        </div>
      )}
      {messages.map((msg, i) => (
        <Message
          key={msg.id}
          msg={msg}
          streaming={
            isLoading && i === messages.length - 1 && msg.role === "assistant"
          }
        />
      ))}
      {isLoading && statusText && !lastHasContent && (
        <p className="text-sm text-violet-300 animate-pulse px-2">
          {statusText}
        </p>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function Message({ msg, streaming }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-3 bg-violet-600/30 border border-violet-500/30">
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 glass-panel">
        {streaming ? (
          msg.content ? (
            <p className="whitespace-pre-wrap">
              {msg.content}
              <span className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 animate-pulse" />
            </p>
          ) : (
            <span className="inline-flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
                />
              ))}
            </span>
          )
        ) : (
          <MarkdownView content={msg.content} />
        )}
      </div>
    </div>
  );
}

/* ---------- Markdown (safe render after stream completes) ---------- */

const mdStyles =
  "text-sm leading-relaxed [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:bg-violet-500/20 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-black/30 [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_a]:text-violet-400";

class MarkdownErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <p className="whitespace-pre-wrap leading-relaxed">
          {this.props.content}
        </p>
      );
    }
    return this.props.children;
  }
}

function MarkdownView({ content }) {
  const text = content || "";
  return (
    <MarkdownErrorBoundary key={text} content={text}>
      <div className={mdStyles}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    </MarkdownErrorBoundary>
  );
}

/* ---------- Metrics + Input ---------- */

function MetricsBar({ metrics }) {
  const langs = { en: "English", hi: "Hindi", ta: "Tamil" };
  return (
    <div className="px-4 py-2 border-t border-white/5 flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
      <span>Latency: {formatLatency(metrics.latency_ms)}</span>
      <span>Tokens: ~{formatTokens(metrics.tokens_est)}</span>
      <span>Words: {metrics.words}</span>
      <span>Language: {langs[metrics.language] || metrics.language}</span>
    </div>
  );
}

function InputBar({ sendMessage, isLoading }) {
  const [text, setText] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim() || isLoading) return;
    sendMessage(text);
    setText("");
  };

  return (
    <form onSubmit={submit} className="p-4 border-t border-white/10">
      <div className="glass-panel rounded-2xl p-3 flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(e);
            }
          }}
          placeholder="Ask anything in any language..."
          rows={2}
          disabled={isLoading}
          className="w-full bg-transparent resize-none outline-none text-sm"
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">
            {text.length}/{MAX_CHARS}
          </span>
          <button
            type="submit"
            disabled={!text.trim() || isLoading}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </form>
  );
}

/* ---------- Settings ---------- */

function SettingsPanel({ chat, onClose }) {
  const { settings, setSettings } = chat;
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm glass-panel border-l border-white/10 p-6 overflow-y-auto">
        <div className="flex justify-between mb-6">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        <label className="block text-sm mb-2">Response Mode</label>
        <select
          value={settings.mode}
          onChange={(e) => setSettings({ mode: e.target.value })}
          className="w-full mb-4 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <label className="block text-sm mb-2">
          Temperature: {settings.temperature}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={settings.temperature}
          onChange={(e) => setSettings({ temperature: +e.target.value })}
          className="w-full mb-4 accent-violet-500"
        />
        <label className="block text-sm mb-2">
          Max tokens: {settings.maxTokens}
        </label>
        <input
          type="range"
          min="128"
          max="2048"
          step="128"
          value={settings.maxTokens}
          onChange={(e) => setSettings({ maxTokens: +e.target.value })}
          className="w-full mb-4 accent-violet-500"
        />
        <div className="flex gap-2">
          {["dark", "light"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSettings({ theme: t })}
              className={`flex-1 py-2 rounded-xl text-sm capitalize ${settings.theme === t ? "bg-violet-600 text-white" : "bg-white/5"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
