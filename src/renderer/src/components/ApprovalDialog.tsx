// ============================================================
// AEGIS UI — Approval Dialog Component
// Confirming action execution with user authorization & timeout
// ============================================================

import React, { useState, useEffect } from 'react'
import * as Icons from './Icons'

interface ApprovalRequest {
  id: string
  action: string
  description: string
  risk_level: 0 | 1 | 2 | 3
  timeout_ms: number
  details: Record<string, string>
}

interface ApprovalDialogProps {
  request: ApprovalRequest
  onRespond: (approved: boolean) => void
}

const ApprovalDialog: React.FC<ApprovalDialogProps> = ({ request, onRespond }) => {
  const timeoutSeconds = Math.max(1, Math.round(request.timeout_ms / 1000))
  const [secondsLeft, setSecondsLeft] = useState(timeoutSeconds)

  // Countdown timer logic
  useEffect(() => {
    setSecondsLeft(timeoutSeconds)

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          onRespond(false) // Auto-deny on timeout
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [request, timeoutSeconds, onRespond])

  // Get risk level label
  const getRiskLabel = (level: 0 | 1 | 2 | 3): string => {
    switch (level) {
      case 3:
        return 'CRITICAL THREAT'
      case 2:
        return 'HIGH RISK ACTION'
      case 1:
        return 'ELEVATED RISK ACTION'
      default:
        return 'LOW RISK ACTION'
    }
  }

  const riskLabel = getRiskLabel(request.risk_level)

  return (
    <div className="overlay" role="alertdialog" aria-modal="true" aria-labelledby="approval-title" aria-describedby="approval-desc">
      <div className="overlay-card animate-scale-in">
        {/* Header */}
        <div className="approval-header">
          <Icons.Shield size={20} className="approval-icon" />
          <div className="approval-title" id="approval-title">
            Authorization Required
          </div>
        </div>

        {/* Description */}
        <div className="approval-description" id="approval-desc">
          AEGIS is requesting authorization to perform the following action.
          <div style={{ marginTop: '8px', color: 'var(--aegis-text-primary)', fontWeight: 600 }}>
            {request.description}
          </div>
        </div>

        {/* Risk Badge */}
        <div style={{ marginBottom: '16px' }}>
          <span className={`badge ${request.risk_level >= 2 ? 'badge-danger' : 'badge-warning'}`}>
            {riskLabel} (Level {request.risk_level})
          </span>
        </div>

        {/* Details list if available */}
        {Object.keys(request.details).length > 0 && (
          <div className="approval-details">
            {Object.entries(request.details).map(([key, val]) => (
              <div className="approval-detail-row" key={key}>
                <span className="approval-detail-key">{key}</span>
                <span className="approval-detail-value">{val}</span>
              </div>
            ))}
          </div>
        )}

        {/* Timer */}
        <div className="approval-timer">
          <span>Auto-denying action in:</span>
          <span className="approval-timer-count">{secondsLeft}s</span>
        </div>

        {/* Footer Actions */}
        <div className="approval-actions">
          <button
            type="button"
            className="btn btn-glass"
            onClick={() => onRespond(false)}
          >
            Deny
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onRespond(true)}
            style={{
              background: request.risk_level >= 2 ? 'var(--aegis-red)' : 'var(--aegis-accent)',
              boxShadow: request.risk_level >= 2 ? '0 2px 6px var(--aegis-red-glow)' : '0 2px 6px var(--shadow-glow)'
            }}
          >
            Approve Action
          </button>
        </div>
      </div>
    </div>
  )
}

export default ApprovalDialog
