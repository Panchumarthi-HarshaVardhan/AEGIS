// ============================================================
// AEGIS UI — Security Dashboard Component
// Visual logs and statistics showing security events blocked
// ============================================================

import React, { useState, useEffect } from 'react'
import * as Icons from './Icons'

interface SecurityEvent {
  id: string
  type: 'secret_detected' | 'phishing_blocked' | 'action_blocked' | 'prompt_injection'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  timestamp: number
  details?: Record<string, unknown>
}

const SecurityDashboard: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadEvents = async (): Promise<void> => {
      try {
        const data = await window.electronAPI.getSecurityEvents()
        setEvents(data || [])
      } catch (err) {
        console.error('[SecurityDashboard] Failed to load security events:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadEvents()
  }, [])

  // Calculate stats
  const totalBlocked = events.length
  const secretsCount = events.filter((e) => e.type === 'secret_detected').length
  const phishingCount = events.filter((e) => e.type === 'phishing_blocked').length

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'secret_detected':
        return <Icons.Lock size={16} />
      case 'phishing_blocked':
        return <Icons.ExternalLink size={16} />
      case 'prompt_injection':
        return <Icons.Shield size={16} />
      case 'action_blocked':
        return <Icons.XCircle size={16} />
      default:
        return <Icons.AlertTriangle size={16} />
    }
  }

  const formatDateTime = (ts: number): string => {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="security-dashboard animate-fade-in">
      {/* Title */}
      <h2>
        <Icons.Shield size={20} className="stat-card-icon" />
        Security Center
      </h2>

      {/* Top Stats Cards */}
      <div className="stat-cards">
        <div className="stat-card">
          <Icons.AlertTriangle size={24} className="stat-card-icon" />
          <span className="stat-card-value">{totalBlocked}</span>
          <span className="stat-card-label">Intercepted Threats</span>
        </div>

        <div className="stat-card">
          <Icons.Lock size={24} className="stat-card-icon" />
          <span className="stat-card-value">{secretsCount}</span>
          <span className="stat-card-label">Secrets Secured</span>
        </div>

        <div className="stat-card">
          <Icons.ExternalLink size={24} className="stat-card-icon" />
          <span className="stat-card-value">{phishingCount}</span>
          <span className="stat-card-label">Phishing Blocks</span>
        </div>
      </div>

      {/* Timeline Section */}
      <div className="event-timeline">
        <div className="event-timeline-title">Threat Mitigation Feed</div>

        {isLoading ? (
          <div className="empty-state">
            <Icons.Sparkle size={32} style={{ animation: 'spin 2s linear infinite' }} className="empty-state-icon" />
            <p className="empty-state-text">Retrieving logs...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <Icons.CheckCircle size={32} style={{ color: 'var(--aegis-green)' }} className="empty-state-icon" />
            <p className="empty-state-text">All Systems Operational</p>
            <p className="empty-state-subtext">No security threats intercepted in this session.</p>
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className={`event-item ${event.severity}`}>
              <div className="event-icon">
                {getEventIcon(event.type)}
              </div>
              <div className="event-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="event-type">
                    {event.type.replace('_', ' ')}
                  </span>
                  <span className="event-timestamp">{formatDateTime(event.timestamp)}</span>
                </div>
                <div className="event-description">{event.description}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default SecurityDashboard
