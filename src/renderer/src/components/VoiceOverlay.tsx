// ============================================================
// AEGIS UI — Voice Overlay HUD
// Siri-style floating voice panel with wave animations and transcripts
// ============================================================

import React, { useEffect, useState } from 'react'
import { useVoice } from '../hooks/useVoice'
import { type UseJarvisReturn } from '../hooks/useJarvis'
import * as Icons from './Icons'

interface VoiceOverlayProps {
  jarvis: UseJarvisReturn
  onClose: () => void
}

const VoiceOverlay: React.FC<VoiceOverlayProps> = ({
  jarvis,
  onClose
}) => {
  const { sendCommand, isProcessing, messages } = jarvis
  const {
    isListening,
    isTranscribing,
    transcript,
    error,
    startListening,
    stopListening,
    audioLevel
  } = useVoice()

  const [status, setStatus] = useState<'listening' | 'understanding' | 'executing' | 'completed'>('listening')
  const [voiceText, setVoiceText] = useState('')

  // 1. Auto-start voice recording on mount
  useEffect(() => {
    startListening().catch((err) => {
      console.error('[VoiceOverlay] Failed to start voice:', err)
      setStatus('completed')
      setVoiceText('Microphone access failed. Please check permissions.')
    })
  }, [startListening])

  // 2. Process transcript once voice recording stops and transcribes
  useEffect(() => {
    if (transcript) {
      setVoiceText(transcript)
      setStatus('understanding')
      sendCommand(transcript).catch((err) => {
        console.error('[VoiceOverlay] Command failed:', err)
        setStatus('completed')
        setVoiceText('Failed to process command.')
      })
    }
  }, [transcript, sendCommand])

  // 3. Monitor assistant response logs to show the final answer
  useEffect(() => {
    if (status === 'understanding') {
      if (isProcessing) {
        setStatus('executing')
      }
    } else if (status === 'executing') {
      if (!isProcessing) {
        const lastMsg = messages[messages.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          setVoiceText(lastMsg.content)
          setStatus('completed')
        } else {
          setStatus('completed')
          setVoiceText('Command processed successfully.')
        }
      }
    }
  }, [isProcessing, messages, status])

  // 4. Auto-dismiss voice panel 4 seconds after completion
  useEffect(() => {
    if (status === 'completed') {
      const timeout = setTimeout(onClose, 4000)
      return () => clearTimeout(timeout)
    }
    return undefined
  }, [status, onClose])

  const getStatusLabel = (): string => {
    if (error) return `Error: ${error}`
    switch (status) {
      case 'understanding':
        return 'Understanding intent...'
      case 'executing':
        return 'Executing command...'
      case 'completed':
        return 'Action complete'
      case 'listening':
      default:
        return isTranscribing ? 'Transcribing speech...' : 'Listening...'
    }
  }

  const handleSphereClick = (): void => {
    if (isListening) {
      stopListening()
    } else if (status === 'completed') {
      onClose()
    }
  }

  return (
    <div className="voice-overlay-container" onClick={onClose}>
      <div className="voice-overlay animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {/* Animated pulsing wave sphere based on audio levels */}
        <button
          type="button"
          className="voice-wave-sphere"
          onClick={handleSphereClick}
          style={{
            transform: `scale(${1 + audioLevel * 0.2})`,
            cursor: isListening || status === 'completed' ? 'pointer' : 'default',
          }}
          aria-label={isListening ? "Stop listening" : "Voice status"}
        >
          {isTranscribing || status === 'understanding' || status === 'executing' ? (
            <Icons.Sparkle size={24} style={{ animation: 'spin 2s linear infinite' }} />
          ) : (
            <Icons.Mic size={24} />
          )}
          {isListening && (
            <>
              <div 
                className="voice-wave-ring" 
                style={{ 
                  transform: `scale(${1 + audioLevel * 0.4})`,
                  opacity: 0.8 - audioLevel * 0.3
                }} 
              />
              <div 
                className="voice-wave-ring-secondary" 
                style={{ 
                  transform: `scale(${1.2 + audioLevel * 0.6})`,
                  opacity: 0.4 - audioLevel * 0.15
                }} 
              />
            </>
          )}
        </button>

        {/* Live speech transcript */}
        <div className="voice-transcript">
          {voiceText || (isListening ? 'Speak now...' : 'Processing...')}
        </div>

        {/* Sub-status pipeline indicators */}
        <div className="voice-status">{getStatusLabel()}</div>
      </div>
    </div>
  )
}

export default VoiceOverlay
