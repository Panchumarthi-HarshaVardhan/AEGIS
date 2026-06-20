// ============================================================
// JARVIS Guardian AI — Command Input Component
// Multi-line auto-growing text field with keyboard bindings
// ============================================================

import React, { useState, useRef, useEffect } from 'react'

interface CommandInputProps {
  onSend: (text: string) => void
  disabled?: boolean
}

const CommandInput: React.FC<CommandInputProps> = ({ onSend, disabled = false }) => {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow height function
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to compute scrollHeight accurately
    textarea.style.height = 'auto'
    const newHeight = Math.min(textarea.scrollHeight, 120)
    textarea.style.height = `${newHeight}px`
  }, [text])

  const handleSend = (): void => {
    const trimmed = text.trim()
    if (trimmed && !disabled) {
      onSend(trimmed)
      setText('')
      // Refocus input
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="command-input-wrapper">
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask AEGIS anything or say a command..."
        disabled={disabled}
        className="command-textarea"
        aria-label="AEGIS input command"
      />

      <button
        type="button"
        className="command-send-btn"
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        aria-label="Send command"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  )
}

export default CommandInput
