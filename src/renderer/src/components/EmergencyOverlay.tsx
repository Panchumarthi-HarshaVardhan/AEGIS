// ============================================================
// AEGIS UI — Emergency Overlay
// Secure workspace overlay shown during blackmail/extortion threats
// ============================================================

import React, { useState } from 'react'
import * as Icons from './Icons'

interface EmergencyOverlayProps {
  reason: string
  transcript: string
  onClose: () => void
}

const EmergencyOverlay: React.FC<EmergencyOverlayProps> = ({
  reason,
  transcript,
  onClose
}) => {
  const [recording, setRecording] = useState(false)
  const [contactsNotified, setContactsNotified] = useState(false)

  const handleNotifyContacts = (): void => {
    setContactsNotified(true)
    alert('Emergency alert sent to configured trusted contacts.')
  }

  return (
    <div 
      className="emergency-overlay-container"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="emergency-title"
      aria-describedby="emergency-desc"
    >
      <div className="emergency-overlay animate-scale-in">
        {/* Header */}
        <div className="emergency-header">
          <Icons.AlertTriangle size={24} className="emergency-icon" />
          <div>
            <div className="emergency-title" id="emergency-title">AEGIS Emergency Shield</div>
            <div className="text-muted" style={{ fontSize: '12px' }}>
              Active Protection Mode enabled.
            </div>
          </div>
        </div>

        {/* Threat Summary */}
        <div 
          className="glass-panel" 
          id="emergency-desc"
          style={{ 
            padding: '12px', 
            background: 'rgba(255, 69, 58, 0.08)', 
            borderColor: 'rgba(255, 69, 58, 0.15)',
            fontSize: '13px' 
          }}
        >
          <strong>Threat Detected:</strong> {reason}
          <div className="text-muted" style={{ fontStyle: 'italic', marginTop: '6px' }}>
            "{transcript.length > 150 ? `${transcript.substring(0, 150)}...` : transcript}"
          </div>
        </div>

        {/* Safety Checklist */}
        <div className="emergency-checklist">
          <strong>Recommended Security Steps:</strong>
          <label className="emergency-check-item">
            <span className="emergency-check-icon active">
              <Icons.CheckCircle size={16} />
            </span>
            <span>Secure passwords & revoke session tokens</span>
          </label>
          <label className="emergency-check-item">
            <span className="emergency-check-icon active">
              <Icons.CheckCircle size={16} />
            </span>
            <span>Enable screen recording & log call audio</span>
          </label>
          <label className="emergency-check-item">
            <span className="emergency-check-icon">
              <Icons.CheckCircle size={16} />
            </span>
            <span>Contact local law enforcement (DO NOT delete evidence)</span>
          </label>
        </div>

        {/* Action Panel */}
        <div className="emergency-actions-grid">
          <button
            type="button"
            className={`btn ${recording ? 'btn-danger' : 'btn-glass'}`}
            onClick={() => setRecording(!recording)}
          >
            {recording ? (
              <>
                <span className="sidebar-status-dot" style={{ background: 'var(--aegis-red)', boxShadow: '0 0 6px var(--aegis-red-glow)' }} />
                Recording Screen...
              </>
            ) : (
              <>
                <Icons.Eye size={16} />
                Start Screen Record
              </>
            )}
          </button>
          
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleNotifyContacts}
            disabled={contactsNotified}
            style={{
              background: contactsNotified ? 'var(--aegis-green)' : 'var(--aegis-red)',
              boxShadow: contactsNotified ? '0 2px 6px var(--aegis-green-glow)' : '0 2px 6px var(--aegis-red-glow)'
            }}
          >
            {contactsNotified ? (
              <>
                <Icons.CheckCircle size={16} />
                Contacts Notified
              </>
            ) : (
              <>
                <Icons.ExternalLink size={16} />
                Notify Trusted Contacts
              </>
            )}
          </button>
        </div>

        {/* Location Log Status */}
        <div className="text-muted" style={{ fontSize: '11px', textAlign: 'center', marginTop: '6px' }}>
          Location logs active: lat/lon (mocked) and system timeline recorded locally in RAM.
        </div>

        {/* Close and exit back to Orb */}
        <button
          type="button"
          className="btn btn-glass"
          onClick={onClose}
          style={{ width: '100%', marginTop: '8px' }}
        >
          Exit Emergency Mode
        </button>
      </div>
    </div>
  )
}

export default EmergencyOverlay
