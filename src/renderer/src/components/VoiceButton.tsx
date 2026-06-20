// ============================================================
// AEGIS UI — Voice Button Component
// Microphone controller with audio level waveform animation
// ============================================================

import React, { useEffect } from 'react'
import { useVoice } from '../hooks/useVoice'
import * as Icons from './Icons'

interface VoiceButtonProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

const VoiceButton: React.FC<VoiceButtonProps> = ({ onTranscript, disabled = false }) => {
  const {
    isListening,
    isTranscribing,
    transcript,
    error,
    startListening,
    stopListening,
    audioLevel,
  } = useVoice()

  // Propagate transcript when received
  useEffect(() => {
    if (transcript) {
      onTranscript(transcript)
    }
  }, [transcript, onTranscript])

  // Log voice error if any
  useEffect(() => {
    if (error) {
      console.error('[VoiceButton] Voice error:', error)
    }
  }, [error])

  const handleClick = async (): Promise<void> => {
    if (isListening) {
      stopListening()
    } else {
      await startListening()
    }
  }

  // Determine subclass
  const voiceStateClass = isTranscribing
    ? 'transcribing'
    : isListening
    ? 'listening'
    : 'idle'

  return (
    <div className="voice-btn-container">
      <button
        type="button"
        className={`voice-btn ${voiceStateClass}`}
        onClick={handleClick}
        disabled={disabled || isTranscribing}
        aria-label={
          isListening
            ? 'Stop listening'
            : isTranscribing
            ? 'Transcribing audio...'
            : 'Start voice command'
        }
      >
        {/* Concentric pulsing waves */}
        {isListening && (
          <div className="voice-btn-rings">
            <span className="voice-ring" style={{ animationDuration: '1.5s' }} />
            <span className="voice-ring" style={{ animationDuration: '1.5s', animationDelay: '0.4s' }} />
            <span className="voice-ring" style={{ animationDuration: '1.5s', animationDelay: '0.8s' }} />
          </div>
        )}

        {/* Microphone/Spinner Icon */}
        {isTranscribing ? (
          <Icons.Sparkle size={18} style={{ animation: 'spin 2s linear infinite' }} />
        ) : (
          <Icons.Mic size={18} />
        )}
      </button>

      {/* Floating level visualization indicator */}
      {isListening && audioLevel > 0.05 && (
        <span className="listening-label animate-fade-in">
          Level: {Math.round(audioLevel * 100)}%
        </span>
      )}
    </div>
  )
}

export default VoiceButton
