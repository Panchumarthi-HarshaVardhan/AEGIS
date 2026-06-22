import { useState, useEffect } from 'react'

interface EmergencyOverlayProps {
  reason: string
  transcript: string
  onClose: () => void
}

const CHECKLIST_ITEMS = [
  'Scanning active connections...',
  'Checking running processes...',
  'Securing sensitive data...',
  'Generating incident report...'
]

function EmergencyOverlay({ reason, transcript, onClose }: EmergencyOverlayProps): React.JSX.Element {
  const [completedCount, setCompletedCount] = useState(0)

  useEffect(() => {
    if (completedCount >= CHECKLIST_ITEMS.length) return

    const timer = setTimeout(() => {
      setCompletedCount((prev) => prev + 1)
    }, 2000)

    return (): void => clearTimeout(timer)
  }, [completedCount])

  return (
    <div className="emergency-overlay-container">
      <div className="emergency-overlay">
        {/* Header */}
        <div className="emergency-header">
          <div className="emergency-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L1 21h22L12 2z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="17" r="1" fill="currentColor" />
            </svg>
          </div>
          <span className="emergency-title">🚨 EMERGENCY DETECTED</span>
        </div>

        {/* Reason */}
        <p style={{ fontSize: 14, color: 'var(--aegis-text-secondary)', margin: 0, lineHeight: 1.5 }}>
          {reason}
        </p>

        {/* Transcript */}
        {transcript && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--aegis-text-tertiary)',
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: 8,
              padding: '10px 12px',
              fontStyle: 'italic',
              lineHeight: 1.5
            }}
          >
            &ldquo;{transcript}&rdquo;
          </div>
        )}

        {/* Checklist */}
        <div className="emergency-checklist">
          {CHECKLIST_ITEMS.map((item, index) => {
            const isDone = index < completedCount
            return (
              <div className="emergency-check-item" key={index}>
                <div className={`emergency-check-icon${isDone ? ' active' : ''}`}>
                  {isDone ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M20 6L9 17l-5-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  )}
                </div>
                <span>{item}</span>
              </div>
            )
          })}
        </div>

        {/* Action Buttons */}
        <div className="emergency-actions-grid">
          <button className="btn btn-danger">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              style={{ marginRight: 6, verticalAlign: -2 }}
            >
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Lock System
          </button>
          <button className="btn btn-danger">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              style={{ marginRight: 6, verticalAlign: -2 }}
            >
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Kill Connections
          </button>
          <button className="btn btn-danger">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              style={{ marginRight: 6, verticalAlign: -2 }}
            >
              <path
                d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Call Emergency
          </button>
          <button className="btn btn-glass" onClick={onClose}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}

export default EmergencyOverlay
