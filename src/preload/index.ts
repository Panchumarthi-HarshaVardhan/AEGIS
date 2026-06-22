import { contextBridge, ipcRenderer } from 'electron'
import type {
  ElectronAPI,
  JarvisResponse,
  ActionResult,
  PhishingAnalysis,
  SecurityEvent,
  ApprovalRequest,
  SystemStatus,
  ConversationMessage,
  PermissionType,
  PermissionState,
  PermissionEntry
} from '../shared/types'

const electronAPI: ElectronAPI = {
  // --- Commands ---
  sendCommand: (text: string, isVoiceInput?: boolean, attachmentPath?: string): Promise<JarvisResponse> =>
    ipcRenderer.invoke('jarvis:command', text, isVoiceInput, attachmentPath),

  approveAction: (approvalId: string, approved: boolean): Promise<ActionResult> =>
    ipcRenderer.invoke('jarvis:approve', approvalId, approved),

  respondPermission: (requestId: string, state: PermissionState): Promise<ActionResult> =>
    ipcRenderer.invoke('jarvis:respond-permission', requestId, state),

  getPermissions: (): Promise<PermissionEntry[]> =>
    ipcRenderer.invoke('jarvis:get-permissions'),

  setPermission: (permission: PermissionType, state: PermissionState): Promise<void> =>
    ipcRenderer.invoke('jarvis:set-permission', permission, state),

  requestPermission: (guardianName: string, permission: PermissionType): Promise<PermissionState> =>
    ipcRenderer.invoke('jarvis:request-permission', guardianName, permission),

  // --- Voice ---
  transcribeAudio: (audioBuffer: ArrayBuffer): Promise<string> =>
    ipcRenderer.invoke('jarvis:transcribe', audioBuffer),

  synthesizeSpeech: (text: string): Promise<string> =>
    ipcRenderer.invoke('jarvis:synthesize-speech', text),

  // --- Security ---
  analyzeUrl: (url: string): Promise<PhishingAnalysis> =>
    ipcRenderer.invoke('jarvis:analyze-url', url),

  getSecurityEvents: (): Promise<SecurityEvent[]> =>
    ipcRenderer.invoke('jarvis:security-events'),

  // --- System ---
  getSystemStatus: (): Promise<SystemStatus> =>
    ipcRenderer.invoke('jarvis:status'),

  getConversationHistory: (): Promise<ConversationMessage[]> =>
    ipcRenderer.invoke('jarvis:history'),

  // --- Advanced ML Auditing ---
  checkFakeNews: (text: string): Promise<any> =>
    ipcRenderer.invoke('jarvis:fake-news-check', text),

  checkDeepfake: (filePath: string): Promise<any> =>
    ipcRenderer.invoke('jarvis:deepfake-check', filePath),

  summarizeDocument: (filePath: string): Promise<any> =>
    ipcRenderer.invoke('jarvis:document-summarize', filePath),

  ocrScreen: (): Promise<string> =>
    ipcRenderer.invoke('jarvis:ocr-screen'),

  // --- Window Modes (V2) ---
  setWindowMode: (mode: 'orb' | 'palette' | 'alert' | 'workspace' | 'onboarding' | 'voice' | 'emergency'): Promise<void> =>
    ipcRenderer.invoke('jarvis:set-window-mode', mode),

  getPreference: (key: string): Promise<string | null> =>
    ipcRenderer.invoke('jarvis:get-preference', key),

  setPreference: (key: string, value: string): Promise<void> =>
    ipcRenderer.invoke('jarvis:set-preference', key, value),

  onTogglePalette: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('jarvis:toggle-palette', handler)
    return () => ipcRenderer.removeListener('jarvis:toggle-palette', handler)
  },

  // --- Events (Main → Renderer subscriptions) ---
  onSecurityAlert: (callback: (event: SecurityEvent) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, event: SecurityEvent) => callback(event)
    ipcRenderer.on('jarvis:security-alert', handler)
    return () => ipcRenderer.removeListener('jarvis:security-alert', handler)
  },

  onApprovalRequired: (callback: (request: ApprovalRequest) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, request: ApprovalRequest) => callback(request)
    ipcRenderer.on('jarvis:approval-required', handler)
    return () => ipcRenderer.removeListener('jarvis:approval-required', handler)
  },

  onPermissionRequest: (callback: (request: { id: string; guardianName: string; permission: PermissionType }) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, request: { id: string; guardianName: string; permission: PermissionType }) => callback(request)
    ipcRenderer.on('jarvis:permission-request', handler)
    return () => ipcRenderer.removeListener('jarvis:permission-request', handler)
  },

  onStatusUpdate: (callback: (status: SystemStatus) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, status: SystemStatus) => callback(status)
    ipcRenderer.on('jarvis:status-update', handler)
    return () => ipcRenderer.removeListener('jarvis:status-update', handler)
  },

  onEmergencyTriggered: (callback: (reason: string, transcript: string) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, reason: string, transcript: string) => callback(reason, transcript)
    ipcRenderer.on('jarvis:emergency-triggered', handler)
    return () => ipcRenderer.removeListener('jarvis:emergency-triggered', handler)
  },

  onStartVoice: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('jarvis:start-voice', handler)
    return () => ipcRenderer.removeListener('jarvis:start-voice', handler)
  },

  // --- Microphone Permission ---
  getMicStatus: (): Promise<string> =>
    ipcRenderer.invoke('jarvis:mic-status'),

  openMicSettings: (): Promise<void> =>
    ipcRenderer.invoke('jarvis:open-mic-settings')
}
contextBridge.exposeInMainWorld('electronAPI', electronAPI)
