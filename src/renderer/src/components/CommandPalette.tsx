// ============================================================
// AEGIS UI — Command Palette Component
// Siri/Raycast-inspired frosted glass input overlay
// ============================================================

import React, { useState, useEffect, useRef } from 'react'
import VoiceButton from './VoiceButton'
import type { UseJarvisReturn } from '../hooks/useJarvis'
import * as Icons from './Icons'

interface CommandPaletteProps {
  jarvis: UseJarvisReturn
  onOpenWorkspace: () => void
  onClose: () => void
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  jarvis,
  onOpenWorkspace,
  onClose
}) => {
  const {
    messages,
    sendCommand,
    isProcessing,
    approvalRequest,
    respondToApproval,
    securityAlerts,
    dismissAlert
  } = jarvis

  const [input, setInput] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Handle global Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSend = async (): Promise<void> => {
    const trimmed = input.trim()
    if (trimmed && !isProcessing) {
      setInput('')
      await sendCommand(trimmed)
    }
  }

  const handleVoiceTranscript = async (text: string): Promise<void> => {
    if (text.trim() && !isProcessing) {
      await sendCommand(text)
    }
  }

  // Filter messages to show last 5 commands/results in a sleek timeline log format
  const recentActivities = messages.slice(-5).reverse()

  // Suggested quick commands
  const suggestions = [
    { text: 'Explain my screen', icon: <Icons.Eye size={16} />, desc: 'Captures screen and extracts text via OCR' },
    { text: 'Play some jazz on Spotify', icon: <Icons.Volume size={16} />, desc: 'Searches and starts music playback' },
    { text: 'Fact check my clipboard', icon: <Icons.Newspaper size={16} />, desc: 'Audits clipboard text for misinformation' },
    { text: 'Summarize latest download', icon: <Icons.Document size={16} />, desc: 'Reads the most recent document in Downloads' }
  ]

  // Filter suggestions based on input
  const filteredSuggestions = suggestions.filter(s =>
    s.text.toLowerCase().includes(input.toLowerCase()) ||
    s.desc.toLowerCase().includes(input.toLowerCase())
  )

  const showAskJarvis = input.trim() !== ''

  const handleSuggestionClick = async (text: string): Promise<void> => {
    if (!isProcessing) {
      await sendCommand(text)
    }
  }

  // Build the flat list of interactive items for arrow key navigation
  const navigableItems: Array<{
    id: string
    text: string
    action: () => void
  }> = []

  if (securityAlerts.length > 0) {
    navigableItems.push({
      id: `alert-${securityAlerts[0].id}`,
      text: `Dismiss Alert: ${securityAlerts[0].type}`,
      action: () => dismissAlert()
    })
  }

  if (showAskJarvis) {
    navigableItems.push({
      id: 'ask-aegis',
      text: `Ask AEGIS "${input}"`,
      action: handleSend
    })
  }

  filteredSuggestions.forEach((s, idx) => {
    navigableItems.push({
      id: `suggest-${idx}`,
      text: s.text,
      action: () => handleSuggestionClick(s.text)
    })
  })

  // Reset activeIndex when input changes
  useEffect(() => {
    setActiveIndex(0)
  }, [input])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (navigableItems.length > 0) {
        setActiveIndex(prev => (prev + 1) % navigableItems.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (navigableItems.length > 0) {
        setActiveIndex(prev => (prev - 1 + navigableItems.length) % navigableItems.length)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (e.metaKey || e.ctrlKey) {
        onOpenWorkspace()
      } else if (navigableItems.length > 0 && activeIndex < navigableItems.length) {
        navigableItems[activeIndex].action()
      } else {
        handleSend()
      }
    }
  }

  // Keep track of rendering indices to match activeIndex
  let currentNavIndex = 0

  return (
    <div className="command-palette-container" onClick={onClose}>
      <div 
        className="command-palette animate-scale-in" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="AEGIS Command Palette"
      >
        {/* Input Bar */}
        <div className="palette-input-wrapper">
          <Icons.Sparkle size={18} className="palette-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="palette-input"
            placeholder={isProcessing ? "AEGIS is thinking..." : "Ask AEGIS or type a command..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            aria-label="AEGIS command input"
            aria-autocomplete="list"
            aria-controls="palette-results-list"
            aria-activedescendant={
              navigableItems.length > 0 && activeIndex < navigableItems.length
                ? navigableItems[activeIndex].id
                : undefined
            }
          />
          <VoiceButton onTranscript={handleVoiceTranscript} disabled={isProcessing} />
        </div>

        {/* Dynamic Results & Feed Area */}
        <div className="palette-results" id="palette-results-list" role="listbox">
          {/* 1. CRITICAL THREAT ALERTS */}
          {securityAlerts.length > 0 && (() => {
            const thisIndex = currentNavIndex
            currentNavIndex++
            const isSelected = activeIndex === thisIndex

            return (
              <div style={{ marginBottom: '8px' }}>
                <div className="palette-section-title" style={{ color: 'var(--aegis-red)' }}>Threat Intercepted</div>
                <div 
                  id={`alert-${securityAlerts[0].id}`}
                  role="option"
                  aria-selected={isSelected}
                  className={`palette-item alert-item ${isSelected ? 'selected' : ''}`}
                >
                  <span className="palette-item-icon" style={{ background: 'rgba(255, 69, 58, 0.12)', color: 'var(--aegis-red)' }}>
                    <Icons.AlertTriangle size={16} />
                  </span>
                  <div className="palette-item-content">
                    <div className="palette-item-title" style={{ color: 'var(--aegis-red)' }}>
                      {securityAlerts[0].type.replace('_', ' ').toUpperCase()}
                    </div>
                    <div className="palette-item-subtitle">{securityAlerts[0].description}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-glass"
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      dismissAlert()
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )
          })()}

          {/* 2. PENDING APPROVAL GATEWAY CARDS (Not in flat arrow navigation, uses standard button focus tab) */}
          {approvalRequest && (
            <div style={{ marginBottom: '8px' }}>
              <div className="palette-section-title" style={{ color: 'var(--aegis-orange)' }}>Approval Gateway</div>
              <div className="palette-item approval-item">
                <span className="palette-item-icon" style={{ background: 'rgba(255, 159, 10, 0.12)', color: 'var(--aegis-orange)' }}>
                  <Icons.Lock size={16} />
                </span>
                <div className="palette-item-content">
                  <div className="palette-item-title" style={{ color: 'var(--aegis-orange)' }}>
                    Confirm: {approvalRequest.action.toUpperCase()}
                  </div>
                  <div className="palette-item-subtitle">{approvalRequest.description}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--aegis-green)', boxShadow: '0 2px 6px var(--aegis-green-glow)' }}
                    onClick={() => respondToApproval(true)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                    onClick={() => respondToApproval(false)}
                  >
                    Deny
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. RECENT ACTIVITY LOGS */}
          {recentActivities.length > 0 && input.trim() === '' && (
            <div style={{ marginBottom: '8px' }}>
              <div className="palette-section-title">Recent Activity</div>
              {recentActivities.map((msg) => {
                const isUser = msg.role === 'user'
                const isSecBlock = msg.security && !msg.security.approved
                const actionResult = msg.action_result

                let icon = <Icons.Sparkle size={16} />
                let title = msg.content
                let subtitle = 'System Response'

                if (isUser) {
                  icon = <Icons.Search size={16} />
                  title = `"${msg.content}"`
                  subtitle = 'User Command'
                } else if (isSecBlock) {
                  icon = <Icons.XCircle size={16} style={{ color: 'var(--aegis-red)' }} />
                  title = 'Action Blocked by Security Engine'
                  subtitle = msg.security?.reason || ''
                } else if (actionResult) {
                  icon = actionResult.success 
                    ? <Icons.CheckCircle size={16} style={{ color: 'var(--aegis-green)' }} /> 
                    : <Icons.XCircle size={16} style={{ color: 'var(--aegis-red)' }} />
                  title = actionResult.success ? `Success: ${actionResult.action}` : `Failed: ${actionResult.action}`
                  subtitle = actionResult.message || actionResult.error || ''
                }

                return (
                  <div key={msg.id} className="palette-item" style={{ cursor: 'default' }}>
                    <span className="palette-item-icon">{icon}</span>
                    <div className="palette-item-content">
                      <div 
                        className="palette-item-title" 
                        style={{ color: isSecBlock ? 'var(--aegis-red)' : 'var(--aegis-text-primary)' }}
                      >
                        {title}
                      </div>
                      <div className="palette-item-subtitle">{subtitle}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 4. QUICK COMMAND SUGGESTIONS & FALLBACK */}
          {(input.trim() === '' || filteredSuggestions.length > 0 || showAskJarvis) && (
            <div>
              <div className="palette-section-title">Actions</div>
              
              {showAskJarvis && (() => {
                const thisIndex = currentNavIndex
                currentNavIndex++
                const isSelected = activeIndex === thisIndex

                return (
                  <div
                    id="ask-aegis"
                    role="option"
                    aria-selected={isSelected}
                    className={`palette-item active-prompt-item ${isSelected ? 'selected' : ''}`}
                    onClick={handleSend}
                    style={{
                      borderLeft: '3px solid var(--aegis-accent)'
                    }}
                  >
                    <span className="palette-item-icon">
                      <Icons.Chat size={16} />
                    </span>
                    <div className="palette-item-content">
                      <div className="palette-item-title" style={{ fontWeight: 600 }}>Ask AEGIS "{input}"</div>
                      <div className="palette-item-subtitle">Press Enter to execute command</div>
                    </div>
                    <span className="shortcut-badge">↵ Enter</span>
                  </div>
                )
              })()}

              {filteredSuggestions.map((s, idx) => {
                const thisIndex = currentNavIndex
                currentNavIndex++
                const isSelected = activeIndex === thisIndex

                return (
                  <div
                    id={`suggest-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    key={idx}
                    className={`palette-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSuggestionClick(s.text)}
                  >
                    <span className="palette-item-icon">{s.icon}</span>
                    <div className="palette-item-content">
                      <div className="palette-item-title">{s.text}</div>
                      <div className="palette-item-subtitle">{s.desc}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Command Palette Footer Info & Shortcuts */}
        <div className="palette-footer">
          <span>AEGIS</span>
          <div className="palette-shortcuts">
            <span>
              <span className="shortcut-badge">Esc</span> Close
            </span>
            <span>
              <span className="shortcut-badge">⌥ Space</span> Toggle
            </span>
            <span>
              <span className="shortcut-badge">⌘ ↵</span> Workspace
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
