// ============================================================
// AEGIS UI — Sidebar Component
// Navigation sidebar with branding and status
// ============================================================

import React from 'react'
import * as Icons from './Icons'

export type ViewType = 'chat' | 'security' | 'fakenews' | 'deepfake' | 'docintel' | 'settings'

interface SidebarProps {
  activeView: ViewType
  onViewChange: (view: ViewType) => void
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange }) => {
  return (
    <aside className="sidebar">
      {/* Branding Logo */}
      <div className="sidebar-brand">
        <Icons.Shield size={28} className="sidebar-logo" />
        <div className="sidebar-brand-text">
          <h1>AEGIS</h1>
          <p>Security Companion</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        <button
          className={`sidebar-nav-item ${activeView === 'chat' ? 'active' : ''}`}
          onClick={() => onViewChange('chat')}
          aria-current={activeView === 'chat' ? 'page' : undefined}
        >
          <span className="sidebar-nav-item-icon"><Icons.Chat size={16} /></span>
          <span>Chat</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeView === 'security' ? 'active' : ''}`}
          onClick={() => onViewChange('security')}
          aria-current={activeView === 'security' ? 'page' : undefined}
        >
          <span className="sidebar-nav-item-icon"><Icons.Shield size={16} /></span>
          <span>Security</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeView === 'fakenews' ? 'active' : ''}`}
          onClick={() => onViewChange('fakenews')}
          aria-current={activeView === 'fakenews' ? 'page' : undefined}
        >
          <span className="sidebar-nav-item-icon"><Icons.Newspaper size={16} /></span>
          <span>Fact Check</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeView === 'deepfake' ? 'active' : ''}`}
          onClick={() => onViewChange('deepfake')}
          aria-current={activeView === 'deepfake' ? 'page' : undefined}
        >
          <span className="sidebar-nav-item-icon"><Icons.Scan size={16} /></span>
          <span>Deepfake</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeView === 'docintel' ? 'active' : ''}`}
          onClick={() => onViewChange('docintel')}
          aria-current={activeView === 'docintel' ? 'page' : undefined}
        >
          <span className="sidebar-nav-item-icon"><Icons.Document size={16} /></span>
          <span>Document Intel</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeView === 'settings' ? 'active' : ''}`}
          onClick={() => onViewChange('settings')}
          aria-current={activeView === 'settings' ? 'page' : undefined}
        >
          <span className="sidebar-nav-item-icon"><Icons.Settings size={16} /></span>
          <span>Settings</span>
        </button>
      </nav>

      {/* Bottom Status Panel */}
      <div className="sidebar-footer">
        <span className="sidebar-status-dot" aria-hidden="true"></span>
        <span className="sidebar-status-text">System Protected</span>
      </div>
    </aside>
  )
}

export default React.memo(Sidebar)
