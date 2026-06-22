// ============================================================
// AEGIS — Command Palette
// Clean, elegant search-and-command interface (no history shown)
// ============================================================

import React, { useState, useEffect, useRef } from 'react'
import type { UseJarvisReturn } from '../hooks/useJarvis'

interface CommandPaletteProps {
  jarvis: UseJarvisReturn
  onOpenWorkspace: () => void
  onClose: () => void
  onTriggerVoice: () => void
  onTriggerSpeechToSpeech: () => void
}

/** SVG icon components */
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

const MicIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
)

const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)

const MonitorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
)

const GlobeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/>
    <rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/>
  </svg>
)

const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)

const LoadingDots = () => (
  <div className="typing-indicator">
    <div className="typing-dot" />
    <div className="typing-dot" />
    <div className="typing-dot" />
  </div>
)

interface QuickAction {
  id: string
  label: string
  subtitle: string
  icon: React.ReactNode
  command: string
}

const quickActions: QuickAction[] = [
  { id: 'screen', label: 'Explain My Screen', subtitle: 'Analyze what\'s visible on screen', icon: <MonitorIcon />, command: 'Explain my screen' },
  { id: 'security', label: 'Security Status', subtitle: 'Check system protection status', icon: <ShieldIcon />, command: 'Show security status' },
  { id: 'url', label: 'Check URL Safety', subtitle: 'Analyze a URL for threats', icon: <GlobeIcon />, command: 'Check this URL: ' },
  { id: 'workspace', label: 'Open Workspace', subtitle: 'Full dashboard with chat & tools', icon: <GridIcon />, command: '__workspace__' },
]

const CommandPalette: React.FC<CommandPaletteProps> = ({ jarvis, onOpenWorkspace, onClose, onTriggerVoice, onTriggerSpeechToSpeech }) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [responseMessage, setResponseMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Filter quick actions based on query
  const filteredActions = query.trim()
    ? quickActions.filter(a =>
        a.label.toLowerCase().includes(query.toLowerCase()) ||
        a.subtitle.toLowerCase().includes(query.toLowerCase())
      )
    : quickActions

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const executeAction = async (action: QuickAction) => {
    if (action.command === '__workspace__') {
      onOpenWorkspace()
      return
    }
    // If command has trailing space (like URL check), just fill the input
    if (action.command.endsWith(': ')) {
      setQuery(action.command)
      inputRef.current?.focus()
      return
    }
    setResponseMessage(null)
    await jarvis.sendCommand(action.command)
  }

  const handleSubmit = async () => {
    const trimmed = query.trim()
    if (!trimmed || jarvis.isProcessing) return
    setResponseMessage(null)
    await jarvis.sendCommand(trimmed)
    // Show the latest assistant message
    setQuery('')
  }

  // Watch for new assistant messages to display response
  useEffect(() => {
    if (jarvis.messages.length > 0) {
      const last = jarvis.messages[jarvis.messages.length - 1]
      if (last.role === 'assistant') {
        setResponseMessage(last.content)
      }
    }
  }, [jarvis.messages])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filteredActions.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (query.trim() && filteredActions.length === 0) {
        handleSubmit()
      } else if (filteredActions.length > 0) {
        executeAction(filteredActions[selectedIndex])
      }
      return
    }
    if (e.key === ' ' && e.metaKey) {
      e.preventDefault()
      onClose()
      return
    }
  }

  return (
    <div className="command-palette-container animate-scale-in">
      <div className="command-palette">
        {/* Search Input */}
        <div className="palette-input-wrapper">
          <span className="palette-search-icon">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            className="palette-input"
            type="text"
            placeholder="Ask AEGIS or type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className="voice-btn"
              style={{ width: 32, height: 32, borderRadius: '50%', padding: 0, border: 'none', background: 'rgba(120,120,128,0.12)', color: 'var(--aegis-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={onTriggerVoice}
              title="Voice Input (Push to Talk)"
            >
              <MicIcon />
            </button>
            <button
              className="voice-btn"
              style={{ width: 32, height: 32, borderRadius: '50%', padding: 0, border: 'none', background: 'rgba(120,120,128,0.12)', color: 'var(--aegis-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={onTriggerSpeechToSpeech}
              title="Speech-to-Speech Conversation"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
                <path d="M3 15h2m14 0h2m-16 4h4m10 0h-4"></path>
              </svg>
            </button>
          </div>
          {/* Send Button */}
          <button 
            className={`palette-send-btn ${query.trim() && !jarvis.isProcessing ? 'active' : ''}`}
            onClick={handleSubmit}
            disabled={!query.trim() || jarvis.isProcessing}
            style={{ marginLeft: '8px' }}
          >
            <SendIcon />
          </button>
        </div>

        {/* Response Area */}
        {(responseMessage || jarvis.isProcessing || jarvis.approvalRequest) && (
          <div className="palette-results" style={{ borderBottom: '1px solid var(--aegis-separator)' }}>
            {jarvis.approvalRequest ? (
              <div style={{ padding: 'var(--aegis-spacing-3)', border: '1px solid var(--aegis-color-yellow)', borderRadius: '6px', background: 'var(--aegis-surface-hover)', margin: 'var(--aegis-spacing-3)' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--aegis-color-yellow)', fontSize: '13px' }}>
                  ⚠️ Automation Requires Approval
                </div>
                <div style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--aegis-text-primary)' }}>
                  {jarvis.approvalRequest.description}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => jarvis.respondToApproval(true)}
                    style={{ fontSize: '12px', padding: '4px 12px' }}
                  >
                    Approve
                  </button>
                  <button 
                    className="btn btn-glass" 
                    onClick={() => jarvis.respondToApproval(false)}
                    style={{ fontSize: '12px', padding: '4px 12px' }}
                  >
                    Deny
                  </button>
                </div>
              </div>
            ) : jarvis.isProcessing ? (
              <div className="palette-item" style={{ justifyContent: 'center' }}>
                <LoadingDots />
              </div>
            ) : responseMessage ? (
              <div style={{ padding: 'var(--aegis-spacing-3)', fontSize: '13px', color: 'var(--aegis-text-primary)', lineHeight: 1.5, maxHeight: '120px', overflowY: 'auto' }}>
                {responseMessage}
              </div>
            ) : null}
          </div>
        )}

        {/* Quick Actions */}
        <div className="palette-results">
          {!responseMessage && !jarvis.isProcessing && (
            <div className="palette-section-title">Quick Actions</div>
          )}
          {filteredActions.map((action, index) => (
            <div
              key={action.id}
              className={`palette-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => executeAction(action)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="palette-item-icon">
                {action.icon}
              </div>
              <div className="palette-item-content">
                <div className="palette-item-title">{action.label}</div>
                <div className="palette-item-subtitle">{action.subtitle}</div>
              </div>
            </div>
          ))}
          {filteredActions.length === 0 && query.trim() && (
            <div
              className={`palette-item selected`}
              onClick={handleSubmit}
              style={{ cursor: 'pointer' }}
            >
              <div className="palette-item-icon">
                <SendIcon />
              </div>
              <div className="palette-item-content">
                <div className="palette-item-title">Ask AEGIS: "{query}"</div>
                <div className="palette-item-subtitle">Press Enter to send</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="palette-footer">
          <span>AEGIS</span>
          <div className="palette-shortcuts">
            <span><span className="shortcut-badge">Esc</span> Close</span>
            <span><span className="shortcut-badge">⌥ Space</span> Toggle</span>
            <span><span className="shortcut-badge">⌘ ↵</span> Workspace</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
