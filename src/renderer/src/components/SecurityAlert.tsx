// ============================================================
// AEGIS UI — Security Alert Overlay Component
// Full screen overlay notifying critical security blocks/threats
// ============================================================

import React from 'react'
import * as Icons from './Icons'

interface SecurityEvent {
  id: string
  type: 'secret_detected' | 'phishing_blocked' | 'action_blocked' | 'prompt_injection'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  timestamp: number
  details?: Record<string, unknown>
}

interface SecurityAlertProps {
  event: SecurityEvent
  onDismiss: () => void
}

const SecurityAlert: React.FC<SecurityAlertProps> = ({ event, onDismiss }) => {
  const isCritical = event.severity === 'critical' || event.severity === 'high'

  // Format date time
  const formatDateTime = (ts: number): string => {
    return new Date(ts).toLocaleString()
  }

  // Get event type clean label
  const getEventLabel = (type: string): string => {
    switch (type) {
      case 'secret_detected':
        return 'CREDENTIAL EXPOSURE BLOCKED'
      case 'phishing_blocked':
        return 'PHISHING WEBSITE DETECTED'
      case 'prompt_injection':
        return 'PROMPT INJECTION DEFLECTED'
      case 'action_blocked':
        return 'UNAUTHORIZED SYSTEM CONTROL BLOCKED'
      default:
        return 'SECURITY THREAT INTERCEPTED'
    }
  }

  return (
    <div
      className="overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alert-title"
      aria-describedby="alert-desc"
    >
      <div className={`overlay-card alert-card ${isCritical ? 'critical' : 'warning'}`}>
        {/* Header */}
        <div className="approval-header" style={{ borderBottomColor: isCritical ? 'rgba(255, 69, 58, 0.2)' : 'rgba(255, 159, 10, 0.2)' }}>
          <Icons.AlertTriangle size={20} className="approval-icon" style={{ color: isCritical ? 'var(--aegis-red)' : 'var(--aegis-orange)' }} />
          <div className="approval-title" id="alert-title">
            {getEventLabel(event.type)}
          </div>
        </div>

        {/* Description */}
        <div className="approval-description" id="alert-desc">
          {event.description}
        </div>

        {/* Meta */}
        <div className="text-muted" style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', marginBottom: '20px' }}>
          <div>
            <strong>Severity:</strong> <span style={{ textTransform: 'uppercase', color: isCritical ? 'var(--aegis-red)' : 'var(--aegis-orange)', fontWeight: 700 }}>{event.severity}</span>
          </div>
          <div>
            <strong>Intercepted at:</strong> {formatDateTime(event.timestamp)}
          </div>
          {event.details && Object.keys(event.details).length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <strong>Threat Context:</strong>
              <pre
                style={{
                  marginTop: '6px',
                  background: 'rgba(0,0,0,0.12)',
                  border: '1px solid var(--border-glass)',
                  padding: '8px',
                  borderRadius: 'var(--aegis-radius-s)',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  fontFamily: 'var(--aegis-font-mono)',
                  fontSize: '11px',
                  color: 'var(--aegis-text-secondary)',
                }}
              >
                {JSON.stringify(event.details, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="approval-actions">
          <button
            type="button"
            className="btn"
            style={{
              width: '100%',
              background: isCritical ? 'var(--aegis-red)' : 'var(--aegis-accent)',
              color: '#FFFFFF',
              boxShadow: isCritical ? '0 2px 6px var(--aegis-red-glow)' : '0 2px 6px var(--shadow-glow)'
            }}
            onClick={onDismiss}
            aria-label="Dismiss security warning"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default SecurityAlert
