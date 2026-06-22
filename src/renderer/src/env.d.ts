/// <reference types="vite/client" />

export {}

// ============================================================
// Window augmentation for the renderer process.
// Mirrors the ElectronAPI interface exposed by the preload script.
// DO NOT import from shared/types — this must be self-contained.
// ============================================================

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
  blocked_secrets?: Array<{
    type: string
    pattern: string
    masked_value: string
    position: { start: number; end: number }
  }>
  phishing_result?: PhishingAnalysis
}

interface PhishingSignal {
  type: string
  description: string
  severity: 'low' | 'medium' | 'high'
  score: number
}

interface PhishingAnalysis {
  url: string
  risk_score: number
  verdict: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS'
  signals: PhishingSignal[]
}

interface ActionResult {
  success: boolean
  action: string
  message: string
  data?: unknown
  error?: string
}

interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  intent?: ParsedIntent
  security?: SecurityVerdict
  action_result?: ActionResult
}

interface JarvisResponse {
  message: string
  intent?: ParsedIntent
  security?: SecurityVerdict
  action_result?: ActionResult
  requires_approval?: boolean
  approval_id?: string
}

interface ApprovalRequest {
  id: string
  action: string
  description: string
  risk_level: 0 | 1 | 2 | 3
  timeout_ms: number
  details: Record<string, string>
}

interface SecurityEvent {
  id: string
  type: 'secret_detected' | 'phishing_blocked' | 'action_blocked' | 'prompt_injection'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  timestamp: number
  details?: Record<string, unknown>
}

interface SystemStatus {
  ai_connected: boolean
  security_active: boolean
  voice_available: boolean
  ws_bridge_active: boolean
  memory_size: number
}

interface ElectronAPI {
  // Commands
  sendCommand: (text: string, isVoiceInput?: boolean, attachmentPath?: string) => Promise<JarvisResponse>
  approveAction: (approvalId: string, approved: boolean) => Promise<ActionResult>

  // Voice
  transcribeAudio: (audioBuffer: ArrayBuffer) => Promise<string>
  synthesizeSpeech: (text: string) => Promise<string>

  // Security
  analyzeUrl: (url: string) => Promise<PhishingAnalysis>
  getSecurityEvents: () => Promise<SecurityEvent[]>

  // System
  getSystemStatus: () => Promise<SystemStatus>
  getConversationHistory: () => Promise<ConversationMessage[]>

  // Advanced ML Auditing
  checkFakeNews: (text: string) => Promise<any>
  checkDeepfake: (filePath: string) => Promise<any>
  summarizeDocument: (filePath: string) => Promise<any>
  ocrScreen: () => Promise<string>
  setWindowMode: (mode: 'orb' | 'palette' | 'alert' | 'workspace' | 'onboarding' | 'voice' | 'emergency') => Promise<void>
  getPreference: (key: string) => Promise<string | null>
  setPreference: (key: string, value: string) => Promise<void>

  // Events (Main → Renderer)
  onSecurityAlert: (callback: (event: SecurityEvent) => void) => () => void
  onApprovalRequired: (callback: (request: ApprovalRequest) => void) => () => void
  onStatusUpdate: (callback: (status: SystemStatus) => void) => () => void
  onTogglePalette: (callback: () => void) => () => void
  onEmergencyTriggered: (callback: (reason: string, transcript: string) => void) => () => void
  onStartVoice: (callback: () => void) => () => void

  // Microphone permission helpers
  getMicStatus: () => Promise<string>
  openMicSettings: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
