// ============================================================
// JARVIS Guardian AI — Main Interaction Hook
// Manages chat messages, commands, approvals, and alerts
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react'

// --- Local type definitions (mirror shared types) ---

interface ParsedIntent {
  intent: string
  entities: Record<string, string>
  risk_level: 0 | 1 | 2 | 3
  steps?: string[]
  confidence: number
  natural_response: string
}

interface SecurityVerdict {
  approved: boolean
  risk_level: 0 | 1 | 2 | 3
  requires_approval: boolean
  reason: string
}

interface ActionResult {
  success: boolean
  action: string
  message: string
  data?: unknown
  error?: string
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  intent?: ParsedIntent
  security?: SecurityVerdict
  action_result?: ActionResult
}

export interface ApprovalRequest {
  id: string
  action: string
  description: string
  risk_level: 0 | 1 | 2 | 3
  timeout_ms: number
  details: Record<string, string>
}

export interface SecurityEvent {
  id: string
  type: 'secret_detected' | 'phishing_blocked' | 'action_blocked' | 'prompt_injection'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  timestamp: number
  details?: Record<string, unknown>
}

export interface SystemStatus {
  ai_connected: boolean
  security_active: boolean
  voice_available: boolean
  ws_bridge_active: boolean
  memory_size: number
}

// --- Hook Return Type ---

export interface UseJarvisReturn {
  messages: ConversationMessage[]
  sendCommand: (text: string, isVoiceInput?: boolean, attachmentPath?: string) => Promise<void>
  isProcessing: boolean
  approvalRequest: ApprovalRequest | null
  respondToApproval: (approved: boolean) => Promise<void>
  securityAlerts: SecurityEvent[]
  dismissAlert: () => void
}

/**
 * Primary hook for interacting with the JARVIS backend via Electron IPC.
 * Manages conversation state, approval requests, and security alerts.
 */
export function useJarvis(): UseJarvisReturn {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null)
  const [securityAlerts, setSecurityAlerts] = useState<SecurityEvent[]>([])
  const initializedRef = useRef(false)

  // Load conversation history on mount
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const loadHistory = async (): Promise<void> => {
      try {
        const history = await window.electronAPI.getConversationHistory()
        if (history && history.length > 0) {
          setMessages(history)
        }
      } catch (err) {
        console.warn('[useJarvis] Failed to load conversation history:', err)
      }
    }

    loadHistory()
  }, [])

  // Subscribe to IPC events from main process
  useEffect(() => {
    const unsubApproval = window.electronAPI.onApprovalRequired(
      (request: ApprovalRequest) => {
        setApprovalRequest(request)
      }
    )

    const unsubAlert = window.electronAPI.onSecurityAlert(
      (event: SecurityEvent) => {
        setSecurityAlerts((prev) => [...prev, event])
      }
    )

    return () => {
      unsubApproval()
      unsubAlert()
    }
  }, [])

  /** Send a user command to JARVIS and append the response */
  const sendCommand = useCallback(async (text: string, isVoiceInput = false, attachmentPath?: string): Promise<void> => {
    const trimmed = text.trim()
    if (!trimmed && !attachmentPath) return
    if (isProcessing) return

    // Add user message immediately
    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed || (attachmentPath ? `[Attached File: ${attachmentPath.split(/[/\\]/).pop()}]` : ''),
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMessage])
    setIsProcessing(true)

    try {
      const response = await window.electronAPI.sendCommand(trimmed, isVoiceInput, attachmentPath)

      // Add JARVIS response
      const jarvisMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        timestamp: Date.now(),
        intent: response.intent,
        security: response.security,
        action_result: response.action_result,
      }
      setMessages((prev) => [...prev, jarvisMessage])

      // Synthesize and play speech response only if user triggered via voice
      if (isVoiceInput) {
        try {
          const audioBase64 = await window.electronAPI.synthesizeSpeech(response.message)
          if (audioBase64) {
            const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`)
            await new Promise<void>((resolve) => {
              audio.onended = () => resolve()
              audio.onerror = () => resolve() // resolve on error to avoid hanging
              audio.play().catch((err) => {
                console.warn('[useJarvis] Audio play failed:', err)
                resolve()
              })
            })
          }
        } catch (speechErr) {
          console.warn('[useJarvis] Speech synthesis playback failed:', speechErr)
        }
      }

      // If the response requires approval, set the pending approval
      if (response.requires_approval && response.approval_id) {
        // The approval request will arrive via the onApprovalRequired event
        // but we can also handle it here as a fallback
      }
    } catch (err) {
      // Add error message
      const errorMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `I encountered an error processing your request. Please try again.`,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, errorMessage])
      console.error('[useJarvis] Command error:', err)
    } finally {
      setIsProcessing(false)
    }
  }, [isProcessing])

  /** Respond to a pending approval request */
  const respondToApproval = useCallback(async (approved: boolean): Promise<void> => {
    if (!approvalRequest) return

    const currentRequest = approvalRequest
    setApprovalRequest(null)

    try {
      const result = await window.electronAPI.approveAction(currentRequest.id, approved)

      // Append the result as a system message
      const resultMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: approved
          ? `Action approved: ${result.message}`
          : `Action denied: ${currentRequest.action}`,
        timestamp: Date.now(),
        action_result: result,
      }
      setMessages((prev) => [...prev, resultMessage])
    } catch (err) {
      console.error('[useJarvis] Approval error:', err)
    }
  }, [approvalRequest])

  /** Dismiss the oldest security alert from the queue */
  const dismissAlert = useCallback((): void => {
    setSecurityAlerts((prev) => prev.slice(1))
  }, [])

  return {
    messages,
    sendCommand,
    isProcessing,
    approvalRequest,
    respondToApproval,
    securityAlerts,
    dismissAlert,
  }
}
