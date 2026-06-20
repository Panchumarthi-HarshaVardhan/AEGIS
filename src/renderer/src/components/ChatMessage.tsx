// ============================================================
// AEGIS UI — Chat Message Component
// Renders individual speech bubbles with security badges
// ============================================================

import React from 'react'
import * as Icons from './Icons'

interface ParsedIntent {
  intent: string
  entities: Record<string, string>
  risk_level: 0 | 1 | 2 | 3
  steps?: string[]
  confidence: number
  natural_response: string
}

interface DetectedSecret {
  type: string
  pattern: string
  masked_value: string
  position: { start: number; end: number }
}

interface PhishingSignal {
  type: string
  description: string
  severity: 'low' | 'medium' | 'high'
  score: number
}

interface PhishingAnalysis {
  url: string
  risk_score: number
  verdict: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS'
  signals: PhishingSignal[]
}

interface SecurityVerdict {
  approved: boolean
  risk_level: 0 | 1 | 2 | 3
  requires_approval: boolean
  reason: string
  blocked_secrets?: DetectedSecret[]
  phishing_result?: PhishingAnalysis
}

interface ActionResult {
  success: boolean
  action: string
  message: string
  data?: unknown
  error?: string
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  intent?: ParsedIntent
  security?: SecurityVerdict
  action_result?: ActionResult
}

interface ChatMessageProps {
  message: ConversationMessage
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  // Format timestamp (HH:MM)
  const formatTime = (ts: number): string => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Get security badge class
  const getSecurityBadge = (verdict: SecurityVerdict): { text: string; className: string } => {
    if (!verdict.approved || verdict.blocked_secrets?.length || verdict.phishing_result?.verdict === 'DANGEROUS') {
      return { text: 'BLOCKED / DANGER', className: 'badge-danger' }
    }
    if (verdict.risk_level > 1 || verdict.phishing_result?.verdict === 'SUSPICIOUS') {
      return { text: 'WARNING', className: 'badge-warning' }
    }
    return { text: 'SECURE', className: 'badge-safe' }
  }

  if (isSystem) {
    return (
      <div className="message-system animate-slide-up" style={{ textAlign: 'center', margin: '8px 0' }}>
        <span className="system-pill" style={{ background: 'rgba(120,120,128,0.1)', padding: '4px 12px', borderRadius: 'var(--aegis-radius-full)', fontSize: '11px', color: 'var(--aegis-text-secondary)' }}>
          {message.content}
        </span>
      </div>
    )
  }

  const badgeInfo = message.security ? getSecurityBadge(message.security) : null

  return (
    <div className={`message-wrapper ${isUser ? 'user' : ''}`}>
      {/* Avatar */}
      <div className="message-avatar" aria-hidden="true">
        {isUser ? <Icons.User size={14} /> : <Icons.Shield size={14} />}
      </div>

      {/* Message Body containing Bubble and Timestamp */}
      <div className="message-body">
        {/* Bubble panel */}
        <div className={isUser ? 'msg-user' : 'msg-jarvis'}>
          {/* Header (with security badges if assistant) */}
          {!isUser && badgeInfo && (
            <div className="message-security-header" style={{ marginBottom: '6px', display: 'flex', gap: '6px' }}>
              <span className={`badge ${badgeInfo.className}`}>{badgeInfo.text}</span>
              {message.security?.requires_approval && (
                <span className="badge badge-warning">Requires Auth</span>
              )}
            </div>
          )}

          {/* Text Content */}
          <div className="message-text">
            {message.content}
          </div>

          {/* Action result panel */}
          {message.action_result && (
            <div
              className={`action-result-card ${
                message.action_result.success ? 'success' : 'failure'
              }`}
              style={{
                marginTop: '10px',
                padding: '10px',
                background: 'rgba(0, 0, 0, 0.12)',
                borderLeft: `3px solid ${message.action_result.success ? 'var(--aegis-green)' : 'var(--aegis-red)'}`,
                borderRadius: 'var(--aegis-radius-s)'
              }}
            >
              <div className="action-name" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--aegis-text-secondary)' }}>
                {message.action_result.action.replace('_', ' ')}
              </div>
              <div className="action-message" style={{ fontSize: '12px', marginTop: '2px', color: 'var(--aegis-text-primary)' }}>
                {message.action_result.message}
              </div>
            </div>
          )}

          {/* Phishing warning if applicable */}
          {!isUser && message.security?.phishing_result && (
            <div
              className="phishing-details"
              style={{
                marginTop: '10px',
                padding: '10px',
                background: 'rgba(0,0,0,0.12)',
                borderRadius: 'var(--aegis-radius-s)',
                fontSize: '12px',
                borderLeft: '2px solid var(--aegis-orange)',
              }}
            >
              <strong>URL scan:</strong> {message.security.phishing_result.url}
              <br />
              <strong>Risk Score:</strong> {message.security.phishing_result.risk_score}/100
              {message.security.phishing_result.signals.length > 0 && (
                <ul style={{ paddingLeft: '16px', marginTop: '6px', color: 'var(--aegis-text-secondary)', listStyleType: 'none' }}>
                  {message.security.phishing_result.signals.map((sig, i) => (
                    <li key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                      <Icons.AlertTriangle size={12} style={{ color: 'var(--aegis-orange)' }} />
                      <span>{sig.description} (+{sig.score})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Secret scanner findings if any */}
          {!isUser && message.security?.blocked_secrets && message.security.blocked_secrets.length > 0 && (
            <div
              className="secrets-details"
              style={{
                marginTop: '10px',
                padding: '10px',
                background: 'rgba(255, 69, 58, 0.04)',
                borderRadius: 'var(--aegis-radius-s)',
                fontSize: '12px',
                borderLeft: '2px solid var(--aegis-red)',
              }}
            >
              <strong style={{ color: 'var(--aegis-red)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Icons.Lock size={12} />
                Blocked Credentials:
              </strong>
              <ul style={{ paddingLeft: '16px', marginTop: '6px', color: 'var(--aegis-text-secondary)', listStyleType: 'none' }}>
                {message.security.blocked_secrets.map((sec, i) => (
                  <li key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                    <Icons.Lock size={12} style={{ color: 'var(--aegis-text-tertiary)' }} />
                    <span><code>{sec.type}</code>: {sec.masked_value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className="message-timestamp" style={{ fontSize: '10px', color: 'var(--aegis-text-tertiary)', marginTop: '2px', display: 'block', textAlign: isUser ? 'right' : 'left' }}>
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  )
}

export default React.memo(ChatMessage)
