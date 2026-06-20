// ============================================================
// AEGIS UI — Status Bar Component
// Bottom bar indicating engine connections and health metrics
// ============================================================

import React, { useState, useEffect } from 'react'
import * as Icons from './Icons'

interface SystemStatus {
  ai_connected: boolean
  security_active: boolean
  voice_available: boolean
  ws_bridge_active: boolean
  memory_size: number
}

interface StatusBarProps {
  status?: SystemStatus | null
}

const StatusBar: React.FC<StatusBarProps> = ({ status }) => {
  const [localStatus, setLocalStatus] = useState<SystemStatus>({
    ai_connected: false,
    security_active: true,
    voice_available: false,
    ws_bridge_active: false,
    memory_size: 0,
  })

  // Poll system status and subscribe to updates
  useEffect(() => {
    // If status is passed as props, prioritize it
    if (status) {
      setLocalStatus(status)
      return
    }

    const fetchStatus = async (): Promise<void> => {
      try {
        const res = await window.electronAPI.getSystemStatus()
        setLocalStatus(res)
      } catch (err) {
        console.warn('[StatusBar] Failed to fetch system status:', err)
      }
    }

    // Initial fetch
    fetchStatus()

    // 10s polling loop
    const interval = setInterval(fetchStatus, 10000)

    // IPC event subscription
    const unsub = window.electronAPI.onStatusUpdate((updatedStatus) => {
      setLocalStatus(updatedStatus)
    })

    return () => {
      clearInterval(interval)
      unsub()
    }
  }, [status])

  // Format memory size in KB/MB
  const formatMemory = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const mb = bytes / (1024 * 1024)
    if (mb > 1) {
      return `${mb.toFixed(1)} MB`
    }
    const kb = bytes / 1024
    return `${kb.toFixed(0)} KB`
  }

  return (
    <footer className="statusbar-container">
      <div className="statusbar-left">
        {/* AI Connection Status */}
        <div className="statusbar-pill">
          <span
            className={`statusbar-dot ${localStatus.ai_connected ? '' : 'inactive'}`}
            aria-hidden="true"
          />
          <span>AI Provider</span>
        </div>

        {/* Security Engine Status */}
        <div className="statusbar-pill">
          <span
            className={`statusbar-dot ${localStatus.security_active ? '' : 'inactive'}`}
            aria-hidden="true"
          />
          <span>Security Engine</span>
        </div>

        {/* Local Voice Status */}
        <div className="statusbar-pill">
          <span
            className={`statusbar-dot ${localStatus.voice_available ? '' : 'inactive'}`}
            aria-hidden="true"
          />
          <span>Local Voice</span>
        </div>

        {/* WebSocket Bridge status */}
        <div className="statusbar-pill">
          <span
            className={`statusbar-dot ${localStatus.ws_bridge_active ? '' : 'inactive'}`}
            aria-hidden="true"
          />
          <span>Chrome Link</span>
        </div>
      </div>

      <div className="statusbar-right">
        {/* SQLite DB size / memory usage */}
        <div className="statusbar-pill">
          <Icons.Shield size={12} style={{ color: 'var(--aegis-text-tertiary)' }} />
          <span>RAM Logs: {formatMemory(localStatus.memory_size)}</span>
        </div>
      </div>
    </footer>
  )
}

export default React.memo(StatusBar)
