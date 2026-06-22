// ============================================================
// JARVIS V3 — Root App Component
// Event-driven overlay HUD router (Orb, Palette, Alert, Voice, Emergency, Workspace, Onboarding)
// ============================================================

import React, { useState, useEffect, useRef } from 'react'
import Orb from './components/Orb'
import CommandPalette from './components/CommandPalette'
import AlertOverlay, { type SecurityEvent } from './components/AlertOverlay'
import VoiceOverlay from './components/VoiceOverlay'
import EmergencyOverlay from './components/EmergencyOverlay'
import Workspace from './components/Workspace'
import Onboarding from './components/Onboarding'
import { useJarvis } from './hooks/useJarvis'

type WindowMode = 'orb' | 'palette' | 'alert' | 'voice' | 'speech-to-speech' | 'emergency' | 'workspace' | 'onboarding'

const App: React.FC = () => {
  const jarvis = useJarvis()
  const { securityAlerts, approvalRequest, dismissAlert } = jarvis

  const [mode, setMode] = useState<WindowMode>('orb')
  const [activeAlert, setActiveAlert] = useState<SecurityEvent | null>(null)
  
  const prevModeRef = useRef<WindowMode>('orb')
  useEffect(() => {
    if (mode !== 'voice' && mode !== 'speech-to-speech' && mode !== 'alert') {
      prevModeRef.current = mode
    }
  }, [mode])
  
  // Emergency state
  const [emergencyReason, setEmergencyReason] = useState('')
  const [emergencyTranscript, setEmergencyTranscript] = useState('')

  // 0. Check first-run onboarding status on mount
  useEffect(() => {
    const checkOnboarding = async (): Promise<void> => {
      try {
        const completed = await window.electronAPI.getPreference('onboarding_completed')
        if (completed !== 'true') {
          setMode('onboarding')
        }
      } catch (err) {
        console.warn('[App] Failed to query onboarding status:', err)
      }
    }
    checkOnboarding()

    // Trigger GC on startup to release transient setup objects at multiple intervals
    const runGC = () => {
      if (typeof window !== 'undefined' && (window as any).gc) {
        try {
          (window as any).gc()
          console.log('[JARVIS] Garbage collection completed in Renderer process.')
        } catch (e) {}
      }
    }

    const t1 = setTimeout(runGC, 1000)
    const t2 = setTimeout(runGC, 3000)
    const t3 = setTimeout(runGC, 5000)
    const t4 = setTimeout(runGC, 8000)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }, [])

  // 1. Sync window size and bounds via IPC when mode changes
  useEffect(() => {
    window.electronAPI.setWindowMode(mode as any).catch((err) => {
      console.error('[App] Failed to set window mode:', err)
    })
  }, [mode])

  // 2. Listen for Option + Space to toggle Command Palette
  useEffect(() => {
    const unsub = window.electronAPI.onTogglePalette(() => {
      setMode((prev) => {
        // Prevent toggle if onboarding is not complete
        if (prev === 'onboarding') return prev
        return prev === 'palette' ? 'orb' : 'palette'
      })
    })
    return unsub
  }, [])

  // 3. Listen for Emergency Trigger events from Main Event Bus
  useEffect(() => {
    const unsub = window.electronAPI.onEmergencyTriggered((reason, transcript) => {
      if (mode === 'onboarding') return // Ignore during onboarding
      setEmergencyReason(reason)
      setEmergencyTranscript(transcript)
      setMode('emergency')
    })
    return unsub
  }, [])

  // 3.5. Listen for Voice Start Trigger events from Main process
  useEffect(() => {
    const unsub = window.electronAPI.onStartVoice(() => {
      if (mode === 'onboarding') return // Ignore during onboarding
      setMode('voice')
    })
    return unsub
  }, [mode])

  // 4. Automatically trigger Alert Mode on incoming critical threat logs
  useEffect(() => {
    if (mode === 'onboarding') return // Ignore during onboarding
    if (securityAlerts.length > 0 && mode !== 'alert' && mode !== 'emergency') {
      const latest = securityAlerts[securityAlerts.length - 1]
      if (latest.severity !== 'low') {
        setActiveAlert(latest)
        setMode('alert')
      }
    }
  }, [securityAlerts, mode])

  // Determine orb health status color
  const getOrbStatus = (): 'green' | 'yellow' | 'red' => {
    if (securityAlerts.length > 0) return 'red'
    if (approvalRequest) return 'yellow'
    return 'green'
  }

  const handleAlertAction = (action: 'inspect' | 'leave' | 'delete' | 'ignore'): void => {
    if (action === 'delete') {
      alert('Purging sensitive context...')
    }
    dismissAlert()
    setMode('orb')
  }

  return (
    <div className="app-container">
      {mode === 'orb' && (
        <Orb
          status={getOrbStatus()}
          onClick={() => setMode('palette')}
        />
      )}

      {mode === 'palette' && (
        <CommandPalette
          jarvis={jarvis}
          onOpenWorkspace={() => setMode('workspace')}
          onClose={() => setMode('orb')}
          onTriggerVoice={() => setMode('voice')}
          onTriggerSpeechToSpeech={() => setMode('speech-to-speech')}
        />
      )}

      {mode === 'alert' && (
        <AlertOverlay
          event={activeAlert || securityAlerts[0]}
          onAction={handleAlertAction}
          onClose={() => {
            dismissAlert()
            setMode('orb')
          }}
        />
      )}

      {(mode === 'voice' || mode === 'speech-to-speech') && (
        <VoiceOverlay
          jarvis={jarvis}
          continuous={mode === 'speech-to-speech'}
          onClose={() => setMode(prevModeRef.current)}
        />
      )}

      {mode === 'emergency' && (
        <EmergencyOverlay
          reason={emergencyReason}
          transcript={emergencyTranscript}
          onClose={() => setMode(prevModeRef.current)}
        />
      )}

      {mode === 'workspace' && (
        <Workspace
          jarvis={jarvis}
          onClose={() => setMode('orb')}
          onTriggerVoice={() => setMode('voice')}
          onTriggerSpeechToSpeech={() => setMode('speech-to-speech')}
        />
      )}

      {mode === 'onboarding' && (
        <Onboarding
          onComplete={() => setMode('orb')}
        />
      )}
    </div>
  )
}

export default App
