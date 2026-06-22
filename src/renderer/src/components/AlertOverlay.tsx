export interface SecurityEvent {
  id: string
  type: 'secret_detected' | 'phishing_blocked' | 'action_blocked' | 'prompt_injection'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  timestamp: number
  details?: Record<string, unknown>
}

interface AlertOverlayProps {
  event: SecurityEvent
  onAction: (action: 'inspect' | 'leave' | 'delete' | 'ignore') => void
  onClose: () => void
}

const TYPE_LABELS: Record<SecurityEvent['type'], string> = {
  secret_detected: 'Secret Detected',
  phishing_blocked: 'Phishing Blocked',
  action_blocked: 'Action Blocked',
  prompt_injection: 'Prompt Injection'
}

const SEVERITY_COLORS: Record<SecurityEvent['severity'], string> = {
  low: '#30d158',
  medium: '#ff9f0a',
  high: '#ff453a',
  critical: '#ff453a'
}

function formatRelativeTime(timestamp: number): string {
  const delta = Math.floor((Date.now() - timestamp) / 1000)
  if (delta < 5) return 'Just now'
  if (delta < 60) return `${delta}s ago`
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`
  return `${Math.floor(delta / 86400)}d ago`
}

function ShieldIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function WarningIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function AlertOverlay({ event, onAction, onClose }: AlertOverlayProps): React.JSX.Element {
  const isHighSeverity = event.severity === 'critical' || event.severity === 'high'
  const iconClass = `alert-card-warning-icon${!isHighSeverity ? ' warning' : ''}`

  return (
    <div className="alert-mode-container">
      <div className="alert-card">
        {/* Header */}
        <div className="alert-card-header">
          <div className="alert-card-branding">
            <span className="alert-card-brand-icon">
              <ShieldIcon />
            </span>
            AEGIS SECURITY
          </div>
          <span className="alert-card-time">{formatRelativeTime(event.timestamp)}</span>
        </div>

        {/* Content */}
        <div className="alert-card-content">
          <div className={iconClass}>
            <WarningIcon />
          </div>
          <div className="alert-card-details">
            <div className="alert-card-title">
              {TYPE_LABELS[event.type]}
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: SEVERITY_COLORS[event.severity],
                  opacity: 0.9
                }}
              >
                {event.severity}
              </span>
            </div>
            <div className="alert-card-meta-list">
              <div className="alert-card-meta-item">{event.description}</div>
              {event.details &&
                Object.entries(event.details).map(([key, value]) => (
                  <div className="alert-card-meta-item" key={key}>
                    {key}: <span className="alert-card-meta-value">{String(value)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="alert-card-actions">
          <button className="btn btn-glass" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-glass" onClick={() => onAction('ignore')}>
            Ignore
          </button>
          <button
            className={`btn ${isHighSeverity ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => onAction('inspect')}
          >
            Inspect
          </button>
        </div>
      </div>
    </div>
  )
}

export default AlertOverlay
