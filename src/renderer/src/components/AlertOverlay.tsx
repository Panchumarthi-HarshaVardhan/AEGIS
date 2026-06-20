// ============================================================
// AEGIS UI — macOS Style Notification Alert Card
// Displays beautiful slide-in warnings for phishing and secrets
// ============================================================

import React from 'react'
import * as Icons from './Icons'

export interface SecurityEvent {
  id: string
  type: 'secret_detected' | 'phishing_blocked' | 'action_blocked' | 'prompt_injection'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  timestamp: number
  details?: Record<string, any>
}

interface AlertOverlayProps {
  event: SecurityEvent
  onAction: (action: 'inspect' | 'leave' | 'delete' | 'ignore') => void
  onClose: () => void
}

const AlertOverlay: React.FC<AlertOverlayProps> = ({ event, onAction, onClose }) => {
  const isPhishing = event.type === 'phishing_blocked'
  const isSecret = event.type === 'secret_detected'
  const isDownload = event.details && event.details.file_path

  // Determine metadata values
  const riskScore = event.details?.risk_score || (event.severity === 'critical' ? 95 : event.severity === 'high' ? 82 : 55)
  const riskLabel = riskScore >= 90 ? 'High' : riskScore >= 70 ? 'Moderate' : 'Low'
  const targetDomain = event.details?.url ? new URL(event.details.url).hostname : (event.details?.domain || 'Unknown Origin')
  const scanReason = event.details?.reason || event.description

  const handleLeaveSite = (): void => {
    window.location.href = 'about:blank'
    onAction('leave')
  }

  // Choose correct warning icon style
  const isHighAlert = event.severity === 'high' || event.severity === 'critical'

  return (
    <div 
      className="alert-mode-container"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alert-title"
      aria-describedby="alert-desc"
    >
      <div className="alert-card animate-slide-up">
        {/* Apple Style Header */}
        <div className="alert-card-header">
          <div className="alert-card-branding">
            <Icons.Shield size={12} className="alert-card-brand-icon" />
            <span>AEGIS</span>
          </div>
          <span className="alert-card-time">now</span>
        </div>

        {/* Body content */}
        <div className="alert-card-content">
          {/* Outlined Warning Shield */}
          <div className={`alert-card-warning-icon ${isHighAlert ? '' : 'warning'}`}>
            <Icons.AlertTriangle size={20} />
          </div>

          <div className="alert-card-details">
            <h1 className="alert-card-title" id="alert-title">
              {isPhishing
                ? 'Potentially Harmful Link Detected'
                : isSecret
                ? 'Developer Secret Leak Blocked'
                : 'Suspicious File Intercepted'}
            </h1>

            <div className="alert-card-meta-list" id="alert-desc">
              <div className="alert-card-meta-item">
                Risk Level: <span className="alert-card-meta-value" style={{ color: isHighAlert ? 'var(--aegis-red)' : 'var(--aegis-orange)' }}>{riskLabel} ({riskScore}%)</span>
              </div>
              
              {isPhishing && (
                <div className="alert-card-meta-item">
                  Domain: <span className="alert-card-meta-value" style={{ textDecoration: 'underline' }}>{targetDomain}</span>
                </div>
              )}
              
              <div className="alert-card-meta-item">
                Reason: <span className="alert-card-meta-value">{scanReason}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions Row */}
        <div className="alert-card-actions">
          {isPhishing && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleLeaveSite}
              >
                Leave Site
              </button>
              <button
                type="button"
                className="btn btn-glass"
                onClick={onClose}
              >
                Check Anyway
              </button>
            </>
          )}

          {isSecret && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onAction('delete')}
              >
                Purge Clipboard
              </button>
              <button
                type="button"
                className="btn btn-glass"
                onClick={onClose}
              >
                Ignore
              </button>
            </>
          )}

          {isDownload && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onAction('delete')}
              >
                Delete File
              </button>
              <button
                type="button"
                className="btn btn-glass"
                onClick={onClose}
              >
                Keep File
              </button>
            </>
          )}

          {!isPhishing && !isSecret && !isDownload && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onClose}
            >
              Acknowledge
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default AlertOverlay
