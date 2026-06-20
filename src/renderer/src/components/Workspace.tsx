// ============================================================
// AEGIS UI — Workspace Component
// Wraps advanced tabs views inside a premium custom container
// ============================================================

import React, { useState } from 'react'
import Sidebar, { type ViewType } from './Sidebar'
import ChatInterface from './ChatInterface'
import SecurityDashboard from './SecurityDashboard'
import FakeNewsAudit from './FakeNewsAudit'
import DeepfakeScanner from './DeepfakeScanner'
import DocumentIntelligence from './DocumentIntelligence'
import StatusBar from './StatusBar'
import * as Icons from './Icons'

import { type UseJarvisReturn } from '../hooks/useJarvis'

interface WorkspaceProps {
  jarvis: UseJarvisReturn
  onClose: () => void
}

const Workspace: React.FC<WorkspaceProps> = ({ jarvis, onClose }) => {
  const [activeView, setActiveView] = useState<ViewType>('chat')
  const isMac = navigator.userAgent.includes('Mac')

  return (
    <div className="workspace-wrapper">
      <div className="workspace-container">
        {/* Custom Window Titlebar */}
        <div className="titlebar">
          <span className="titlebar-title">AEGIS Workspace</span>
          {!isMac && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Workspace"
              style={{
                marginLeft: 'auto',
                marginRight: '16px',
                background: 'transparent',
                border: 'none',
                color: 'var(--aegis-text-secondary)',
                cursor: 'pointer',
                fontSize: '14px',
                WebkitAppRegion: 'no-drag'
              } as React.CSSProperties}
            >
              ✕
            </button>
          )}
        </div>

        {/* Main layout containing Sidebar navigation and detail view panels */}
        <div className="app-layout">
          <Sidebar activeView={activeView} onViewChange={setActiveView} />

          <div className="main-content">
            {activeView === 'chat' && <ChatInterface jarvis={jarvis} />}
            {activeView === 'security' && <SecurityDashboard />}
            {activeView === 'fakenews' && <FakeNewsAudit />}
            {activeView === 'deepfake' && <DeepfakeScanner />}
            {activeView === 'docintel' && <DocumentIntelligence />}
            {activeView === 'settings' && <SettingsPlaceholder />}
          </div>
        </div>

        <StatusBar status={null} />
      </div>
    </div>
  )
}

/** Placeholder settings view */
const SettingsPlaceholder: React.FC = () => (
  <div className="security-dashboard">
    <h2>
      <Icons.Settings size={20} className="stat-card-icon" />
      Settings
    </h2>
    <div className="empty-state">
      <Icons.Settings size={32} className="empty-state-icon" />
      <p className="empty-state-text">Settings Configuration</p>
      <p className="empty-state-subtext">
        Configure AI model parameters, safety scanning thresholds, and global alert settings.
      </p>
    </div>
  </div>
)

export default Workspace
