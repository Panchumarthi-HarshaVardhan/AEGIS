// ============================================================
// AEGIS — Voice Overlay
// Siri-style voice input overlay with pulsing sphere,
// real-time audio level feedback, and auto-send on transcript.
// ============================================================

import { useEffect, useRef } from 'react'
import { useVoice } from '../hooks/useVoice'
import type { UseJarvisReturn } from '../hooks/useJarvis'

interface VoiceOverlayProps {
  jarvis: UseJarvisReturn
  onClose: () => void
  continuous?: boolean
}

function VoiceOverlay({ jarvis, onClose, continuous }: VoiceOverlayProps): React.JSX.Element {
  const { isListening, isTranscribing, transcript, error, startListening, stopListening, audioLevel } =
    useVoice()

  const hasSentRef = useRef(false)

  // Auto-start listening on mount
  useEffect(() => {
    let active = true
    const autoStart = async () => {
      // Delay slightly to allow transition animations to settle
      await new Promise((resolve) => setTimeout(resolve, 300))
      if (active) {
        startListening().catch((err) => {
          console.error('[VoiceOverlay] Auto-start failed:', err)
        })
      }
    }
    autoStart()
    return () => {
      active = false
    }
  }, [startListening])

  // Auto-send transcript and close once transcription completes
  useEffect(() => {
    if (transcript && !hasSentRef.current) {
      hasSentRef.current = true
      jarvis.sendCommand(transcript, true)
      if (!continuous) {
        onClose()
      }
    }
  }, [transcript, jarvis, onClose, continuous])

  // Continuous Mode: restart listening after JARVIS finishes processing
  useEffect(() => {
    if (continuous && hasSentRef.current && !jarvis.isProcessing) {
      const timer = setTimeout(() => {
        hasSentRef.current = false
        startListening().catch((err) => {
          console.error('[VoiceOverlay] Continuous restart failed:', err)
        })
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [continuous, jarvis.isProcessing, startListening])

  const sphereScale = isListening ? 1 + audioLevel * 0.35 : 1

  const statusLabel = isTranscribing
    ? 'TRANSCRIBING'
    : isListening
      ? (continuous ? 'CONVERSATION ACTIVE' : 'LISTENING')
      : jarvis.isProcessing
        ? 'PROCESSING'
        : 'READY'

  return (
    <div className="voice-overlay-container">
      <div className="voice-overlay">
        {/* ── Sphere with pulse rings ── */}
        <div className="voice-wave-sphere" style={{ transform: `scale(${sphereScale})` }}>
          {isListening && (
            <>
              <div className="voice-wave-ring" />
              <div className="voice-wave-ring-secondary" />
            </>
          )}

          {/* Microphone icon */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="1" width="6" height="12" rx="3" />
            <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>

        {/* ── Transcript / error display ── */}
        <div className="voice-transcript">
          {error
            ? error
            : transcript
              ? transcript
              : isListening
                ? 'Speak now…'
                : isTranscribing
                  ? 'Processing…'
                  : 'Tap the microphone to begin'}
        </div>

        {/* ── Status label ── */}
        <div className="voice-status">{statusLabel}</div>

        {/* ── Controls ── */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          {isListening ? (
            <button className="btn btn-danger" onClick={stopListening}>
              {/* Stop icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="none"
              >
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
              Stop
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={startListening}
              disabled={isTranscribing}
            >
              {/* Mic icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="1" width="6" height="12" rx="3" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
              </svg>
              Start
            </button>
          )}

          <button className="btn btn-glass" onClick={onClose}>
            {/* Close / X icon */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default VoiceOverlay
