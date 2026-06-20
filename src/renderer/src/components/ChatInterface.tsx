// ============================================================
// AEGIS UI — Chat Interface Component
// Integrates messages feed, command input, voice button,
// approval popups, and security alerts.
// ============================================================

import React, { useEffect, useRef } from 'react'
import { useJarvis, type UseJarvisReturn } from '../hooks/useJarvis'
import ChatMessage from './ChatMessage'
import CommandInput from './CommandInput'
import VoiceButton from './VoiceButton'
import ApprovalDialog from './ApprovalDialog'
import SecurityAlert from './SecurityAlert'
import * as Icons from './Icons'

interface ChatInterfaceProps {
  jarvis?: UseJarvisReturn
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ jarvis: propJarvis }) => {
  const localJarvis = useJarvis()
  const jarvis = propJarvis || localJarvis
  const {
    messages,
    sendCommand,
    isProcessing,
    approvalRequest,
    respondToApproval,
    securityAlerts,
    dismissAlert,
  } = jarvis

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new messages or processing state
  useEffect(() => {
    const container = scrollContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages, isProcessing])

  // Handles text submission
  const handleSendText = async (text: string): Promise<void> => {
    await sendCommand(text)
  }

  // Handles voice transcript submission
  const handleVoiceTranscript = async (text: string): Promise<void> => {
    if (text.trim()) {
      await sendCommand(text)
    }
  }

  return (
    <div className="chat-container">
      {/* Messages Scroll Area */}
      <div className="chat-messages" ref={scrollContainerRef}>
        {messages.length === 0 ? (
          <div className="welcome-container">
            <Icons.Shield size={48} className="welcome-icon" />
            <h1 className="welcome-title">AEGIS</h1>
            <p className="welcome-subtitle">
              Your security-first AI Operating Companion. I can help launch apps, play music, search files, analyze URLs, and prevent credential leaks.
            </p>
            
            <div className="glass-panel" style={{ padding: '14px 18px', textAlign: 'left', maxWidth: '440px', fontSize: '13px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <Icons.Sparkle size={16} style={{ color: 'var(--aegis-accent)', marginTop: '2px', flexShrink: 0 }} />
                <span>
                  <strong>Try Typing:</strong> "Open Chrome", "Play Believer on YouTube", or paste an API key like <code>sk-12345...</code> to test protection.
                </span>
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}

        {/* Typing / Loading indicator */}
        {isProcessing && (
          <div className="message-wrapper jarvis">
            <div className="message-avatar" aria-hidden="true">
              <Icons.Shield size={16} />
            </div>
            <div className="message-body">
              <div className="msg-jarvis" style={{ padding: 0 }}>
                <div className="typing-indicator" aria-label="AEGIS is processing...">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input controls layout */}
      <div className="chat-input-area">
        <CommandInput onSend={handleSendText} disabled={isProcessing} />
        <VoiceButton onTranscript={handleVoiceTranscript} disabled={isProcessing} />
      </div>

      {/* Action Approval Dialog */}
      {approvalRequest && (
        <ApprovalDialog request={approvalRequest} onRespond={respondToApproval} />
      )}

      {/* Security alert overlay queue */}
      {securityAlerts.length > 0 && (
        <SecurityAlert event={securityAlerts[0]} onDismiss={dismissAlert} />
      )}
    </div>
  )
}

export default ChatInterface
