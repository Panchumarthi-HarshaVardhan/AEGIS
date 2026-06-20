// ============================================================
// JARVIS Guardian AI — Shared Type Definitions
// Used across main, preload, and renderer processes
// ============================================================

// --- Intent Engine Types ---

export type IntentType =
  | 'open_app'
  | 'open_url'
  | 'search_web'
  | 'play_music'
  | 'search_product'
  | 'summarize'
  | 'system_control'
  | 'file_operation'
  | 'unknown'

export interface ParsedIntent {
  intent: IntentType
  entities: Record<string, string>
  risk_level: RiskLevel
  steps?: string[]
  confidence: number
  natural_response: string
}

// --- Security Engine Types ---

export type RiskLevel = 0 | 1 | 2 | 3

export interface SecurityVerdict {
  approved: boolean
  risk_level: RiskLevel
  requires_approval: boolean
  reason: string
  blocked_secrets?: DetectedSecret[]
  phishing_result?: PhishingAnalysis
}

export interface DetectedSecret {
  type: string
  pattern: string
  masked_value: string
  position: { start: number; end: number }
}

export interface PhishingSignal {
  type: string
  description: string
  severity: 'low' | 'medium' | 'high'
  score: number
}

export interface PhishingAnalysis {
  url: string
  risk_score: number
  verdict: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS'
  signals: PhishingSignal[]
}

// --- Trust Engine Types ---

export interface TrustSignal {
  type: string
  description: string
  score: number // impact score or score assigned
  status: 'pass' | 'warning' | 'fail'
}

export interface TrustVerdict {
  score: number // 0-100
  category: 'safe' | 'suspicious' | 'dangerous' | 'critical'
  signals: TrustSignal[]
  recommendation: string
}

// --- Action Engine Types ---

export type ActionStatus = 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'blocked'

export interface ActionResult {
  success: boolean
  action: string
  message: string
  data?: unknown
  error?: string
}

// --- Memory Engine Types ---

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  intent?: ParsedIntent
  security?: SecurityVerdict
  action_result?: ActionResult
}

export interface UserPreference {
  key: string
  value: string
  updated_at: number
}

// --- UI Types (passed via IPC) ---

export interface JarvisResponse {
  message: string
  intent?: ParsedIntent
  security?: SecurityVerdict
  action_result?: ActionResult
  requires_approval?: boolean
  approval_id?: string
}

export interface ApprovalRequest {
  id: string
  action: string
  description: string
  risk_level: RiskLevel
  timeout_ms: number
  details: Record<string, string>
}

export interface ThreatReport {
  id: string
  guardian: string
  score: number // 0-100
  severity: 'silent' | 'low' | 'medium' | 'high' | 'critical'
  description: string
  details?: Record<string, any>
  timestamp: number
}

export interface SecurityEvent {
  id: string
  type: 'secret_detected' | 'phishing_blocked' | 'action_blocked' | 'prompt_injection'
  severity: 'silent' | 'low' | 'medium' | 'high' | 'critical'
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

// --- Electron API (exposed via preload) ---

export interface ElectronAPI {
  // Commands
  sendCommand: (text: string) => Promise<JarvisResponse>
  approveAction: (approvalId: string, approved: boolean) => Promise<ActionResult>
  respondPermission: (requestId: string, state: PermissionState) => Promise<ActionResult>

  // Voice
  transcribeAudio: (audioBuffer: ArrayBuffer) => Promise<string>

  // Security
  analyzeUrl: (url: string) => Promise<PhishingAnalysis>
  getSecurityEvents: () => Promise<SecurityEvent[]>

  // System
  getSystemStatus: () => Promise<SystemStatus>
  getConversationHistory: () => Promise<ConversationMessage[]>

  // Permissions
  getPermissions: () => Promise<PermissionEntry[]>
  setPermission: (permission: PermissionType, state: PermissionState) => Promise<void>
  requestPermission: (guardianName: string, permission: PermissionType) => Promise<PermissionState>

  // Advanced ML Auditing
  checkFakeNews: (text: string) => Promise<any>
  checkDeepfake: (filePath: string) => Promise<any>
  summarizeDocument: (filePath: string) => Promise<any>
  ocrScreen: () => Promise<string>
  setWindowMode: (mode: 'orb' | 'palette' | 'alert' | 'workspace' | 'onboarding') => Promise<void>
  getPreference: (key: string) => Promise<string | null>
  setPreference: (key: string, value: string) => Promise<void>

  // Events (Main → Renderer)
  onSecurityAlert: (callback: (event: SecurityEvent) => void) => () => void
  onApprovalRequired: (callback: (request: ApprovalRequest) => void) => () => void
  onPermissionRequest: (callback: (request: { id: string; guardianName: string; permission: PermissionType }) => void) => () => void
  onStatusUpdate: (callback: (status: SystemStatus) => void) => () => void
  onTogglePalette: (callback: () => void) => () => void
  onEmergencyTriggered: (callback: (reason: string, transcript: string) => void) => () => void
}

// --- Permission Manager Types ---

export type PermissionType = 
  | 'microphone'
  | 'camera'
  | 'screen_recording' 
  | 'accessibility'
  | 'automation'
  | 'clipboard' 
  | 'downloads'
  | 'browser_extension'
  | 'notifications' 
  | 'file_system'

export type PermissionState = 'granted' | 'denied' | 'ask_every_time' | 'temporary' | 'not_set'

export interface PermissionEntry {
  permission: PermissionType
  state: PermissionState
  grantedAt?: number
  scope?: string
}

// Augment Window for renderer access
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

