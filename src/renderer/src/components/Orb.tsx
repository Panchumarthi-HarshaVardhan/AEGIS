// ============================================================
// JARVIS V3 — Floating Orb Component
// Translucent frosted glass AssistiveTouch-style orb indicator
// ============================================================

import React from 'react'

interface OrbProps {
  status: 'green' | 'yellow' | 'red'
  onClick: () => void
}

const Orb: React.FC<OrbProps> = ({ status, onClick }) => {
  return (
    <div className="floating-orb-container" title="AEGIS Companion (Click to open)">
      <button
        type="button"
        className={`assistive-touch-orb ${status}`}
        onClick={onClick}
        aria-label={`AEGIS Status: ${status === 'green' ? 'System Safe' : status === 'yellow' ? 'Pending Approval' : 'Threat Blocked'}`}
      >
        <div className="ring-1">
          <div className="ring-center"></div>
        </div>
      </button>
    </div>
  )
}

export default React.memo(Orb)

