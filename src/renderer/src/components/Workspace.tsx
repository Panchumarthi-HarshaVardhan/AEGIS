// ============================================================
// AEGIS — Workspace
// Full-featured dashboard with sidebar navigation, chat, and security views
// ============================================================

import React, { useState, useRef, useEffect } from 'react'
import type { UseJarvisReturn, ConversationMessage } from '../hooks/useJarvis'

interface WorkspaceProps {
  jarvis: UseJarvisReturn
  onClose: () => void
  onTriggerVoice?: () => void
  onTriggerSpeechToSpeech?: () => void
}

type WorkspaceView = 'chat' | 'security' | 'settings'

/* ─── Inline SVG Icons ──────────────────────────────────────── */
const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)

const ChatIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)

const ShieldSmallIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
)

const UserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)

const BotIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7v1H3v-1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
    <rect x="3" y="15" width="18" height="5" rx="2"/>
    <circle cx="9" cy="18" r="1"/>
    <circle cx="15" cy="18" r="1"/>
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const ClipIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
)

const MicIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="1" width="6" height="12" rx="3" />
    <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
)

/* ─── Chat View ──────────────────────────────────────────────── */
const ChatView: React.FC<{ jarvis: UseJarvisReturn; onTriggerVoice?: () => void; onTriggerSpeechToSpeech?: () => void }> = ({ jarvis, onTriggerVoice, onTriggerSpeechToSpeech }) => {
  const [inputText, setInputText] = useState('')
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [jarvis.messages])

  const handleSend = async () => {
    const trimmed = inputText.trim()
    if (!trimmed && !attachedFile) return
    if (jarvis.isProcessing) return

    setInputText('')
    setAttachedFile(null)

    const attachmentPath = attachedFile ? (attachedFile as any).path : undefined
    await jarvis.sendCommand(trimmed, false, attachmentPath)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {jarvis.messages.length === 0 && (
          <div className="welcome-container">
            <div className="welcome-icon">
              <ShieldIcon />
            </div>
            <div className="welcome-title">AEGIS Guardian AI</div>
            <div className="welcome-subtitle">
              Your AI-powered security companion. Ask me to check URLs, analyze files, explain your screen, detect deepfakes, or manage your system securely.
            </div>
          </div>
        )}
        {jarvis.messages.map((msg: ConversationMessage) => (
          <div key={msg.id} className={`message-wrapper ${msg.role === 'user' ? 'user' : 'jarvis'}`}>
            <div className="message-avatar">
              {msg.role === 'user' ? <UserIcon /> : <BotIcon />}
            </div>
            <div className="message-body">
              <div className={msg.role === 'user' ? 'msg-user' : 'msg-jarvis'}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        {jarvis.isProcessing && (
          <div className="message-wrapper jarvis">
            <div className="message-avatar"><BotIcon /></div>
            <div className="message-body">
              <div className="msg-jarvis">
                <div className="typing-indicator">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            </div>
          </div>
        )}
        {jarvis.approvalRequest && (
          <div className="message-wrapper jarvis">
            <div className="message-avatar"><AlertIcon /></div>
            <div className="message-body">
              <div className="msg-jarvis" style={{ border: '1px solid var(--aegis-color-yellow)', background: 'var(--aegis-surface-hover)' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--aegis-color-yellow)' }}>
                  ⚠️ Automation Requires Approval
                </div>
                <div style={{ marginBottom: '12px', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
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
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        {attachedFile && (
          <div className="attached-file-chip" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(120, 120, 128, 0.12)', border: '1px solid var(--border-glass)', borderRadius: 'var(--aegis-radius-s)', marginBottom: '8px', fontSize: '12px', color: 'var(--aegis-text-primary)', width: 'fit-content' }}>
            <span>📎 {attachedFile.name}</span>
            <button
              onClick={() => setAttachedFile(null)}
              style={{ background: 'none', border: 'none', color: 'var(--aegis-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '14px', marginLeft: '4px' }}
            >
              ✕
            </button>
          </div>
        )}
        <div className="command-input-wrapper">
          <button
            className="btn-icon"
            onClick={() => fileInputRef.current?.click()}
            style={{ background: 'none', border: 'none', color: 'var(--aegis-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '28px', width: '28px', flexShrink: 0 }}
            title="Attach file/photo"
          >
            <ClipIcon />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                setAttachedFile(e.target.files[0])
              }
            }}
          />
          <textarea
            ref={textareaRef}
            className="command-textarea"
            placeholder="Ask AEGIS anything..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          {onTriggerVoice && (
            <button
              className="btn-icon"
              onClick={onTriggerVoice}
              style={{ background: 'none', border: 'none', color: 'var(--aegis-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '28px', width: '28px', flexShrink: 0 }}
              title="Voice Input (Push to Talk)"
            >
              <MicIcon />
            </button>
          )}
          {onTriggerSpeechToSpeech && (
            <button
              className="btn-icon"
              onClick={onTriggerSpeechToSpeech}
              style={{ background: 'none', border: 'none', color: 'var(--aegis-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '28px', width: '28px', flexShrink: 0 }}
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
          )}
          <button
            className="command-send-btn"
            onClick={handleSend}
            disabled={(!inputText.trim() && !attachedFile) || jarvis.isProcessing}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Security Dashboard View ────────────────────────────────── */
const SecurityView: React.FC<{ jarvis: UseJarvisReturn }> = ({ jarvis }) => {
  const [status, setStatus] = useState<{ ai_connected: boolean; security_active: boolean; voice_available: boolean; ws_bridge_active: boolean; memory_size: number } | null>(null)

  useEffect(() => {
    window.electronAPI.getSystemStatus().then(setStatus).catch(() => {})
  }, [])

  return (
    <div className="security-dashboard">
      <h2><ShieldSmallIcon /> Security Dashboard</h2>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-card-icon"><CheckIcon /></div>
          <div className="stat-card-value">{status?.security_active ? 'Active' : 'Inactive'}</div>
          <div className="stat-card-label">Protection Status</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><EyeIcon /></div>
          <div className="stat-card-value">{status?.ai_connected ? 'Online' : 'Offline'}</div>
          <div className="stat-card-label">AI Engine</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><AlertIcon /></div>
          <div className="stat-card-value">{jarvis.securityAlerts.length}</div>
          <div className="stat-card-label">Active Alerts</div>
        </div>
      </div>

      <div className="event-timeline">
        <div className="event-timeline-title">Security Events</div>
        {jarvis.securityAlerts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><CheckIcon /></div>
            <div className="empty-state-text">All Clear</div>
            <div className="empty-state-subtext">No security threats detected. AEGIS is actively monitoring your system.</div>
          </div>
        ) : (
          jarvis.securityAlerts.map(alert => (
            <div key={alert.id} className={`event-item ${alert.severity}`}>
              <div className="event-icon"><AlertIcon /></div>
              <div className="event-content">
                <div className="event-type">{alert.type.replace(/_/g, ' ')}</div>
                <div className="event-description">{alert.description}</div>
                <div className="event-timestamp">{new Date(alert.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/* ─── Settings View ──────────────────────────────────────────── */
const SettingsView: React.FC = () => {
  const [provider, setProvider] = useState('loading...')

  useEffect(() => {
    window.electronAPI.getSystemStatus().then((status) => {
      setProvider(status.ai_connected ? 'groq' : 'offline')
    }).catch(() => {
      setProvider('unknown')
    })
  }, [])

  return (
    <div className="security-dashboard">
      <h2><SettingsIcon /> Settings</h2>
      <div className="event-timeline">
        <div className="event-timeline-title">AI Provider</div>
        <div style={{ padding: 'var(--aegis-spacing-3)', display: 'flex', flexDirection: 'column', gap: 'var(--aegis-spacing-3)' }}>
          <div className="permission-item">
            <div className="permission-info">
              <div className="permission-name">AI Provider</div>
              <div className="permission-desc">Current inference engine for AEGIS</div>
            </div>
            <span className="badge badge-safe">{provider}</span>
          </div>
          <div className="permission-item">
            <div className="permission-info">
              <div className="permission-name">WebSocket Bridge</div>
              <div className="permission-desc">Chrome extension communication channel</div>
            </div>
            <span className="badge badge-safe">Port 8765</span>
          </div>
          <div className="permission-item">
            <div className="permission-info">
              <div className="permission-name">Python Backend</div>
              <div className="permission-desc">ML pipeline for deepfake and OCR analysis</div>
            </div>
            <span className="badge badge-safe">Port 8000</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Workspace Component ───────────────────────────────── */
const Workspace: React.FC<WorkspaceProps> = ({ jarvis, onClose, onTriggerVoice, onTriggerSpeechToSpeech }) => {
  const [view, setView] = useState<WorkspaceView>('chat')

  const navItems: { id: WorkspaceView; label: string; icon: React.ReactNode }[] = [
    { id: 'chat', label: 'Chat', icon: <ChatIcon /> },
    { id: 'security', label: 'Security', icon: <ShieldSmallIcon /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
  ]

  return (
    <div className="workspace-wrapper">
      <div className="workspace-container animate-scale-in">
        {/* Titlebar */}
        <div className="titlebar">
          <span className="titlebar-title">AEGIS GUARDIAN AI</span>
        </div>

        {/* Main Layout */}
        <div className="app-layout">
          {/* Sidebar */}
          <div className="sidebar">
            <div>
              <div className="sidebar-brand">
                <div className="sidebar-logo"><ShieldIcon /></div>
                <div className="sidebar-brand-text">
                  <h1>AEGIS</h1>
                  <p>Guardian AI</p>
                </div>
              </div>
              <nav className="sidebar-nav">
                {navItems.map(item => (
                  <button
                    key={item.id}
                    className={`sidebar-nav-item ${view === item.id ? 'active' : ''}`}
                    onClick={() => setView(item.id)}
                  >
                    <span className="sidebar-nav-item-icon">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="sidebar-footer">
              <div className="sidebar-status-dot" />
              <span className="sidebar-status-text">Protected</span>
            </div>
          </div>

          {/* Main Content */}
          <div className="main-content">
            {view === 'chat' && <ChatView jarvis={jarvis} onTriggerVoice={onTriggerVoice} onTriggerSpeechToSpeech={onTriggerSpeechToSpeech} />}
            {view === 'security' && <SecurityView jarvis={jarvis} />}
            {view === 'settings' && <SettingsView />}
          </div>
        </div>

        {/* Statusbar */}
        <div className="statusbar-container">
          <div className="statusbar-left">
            <div className="statusbar-pill">
              <div className="statusbar-dot" />
              <span>AEGIS Active</span>
            </div>
          </div>
          <div className="statusbar-right">
            <button
              className="btn btn-glass"
              style={{ padding: '2px 10px', fontSize: '10px' }}
              onClick={onClose}
            >
              Close Workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Workspace
