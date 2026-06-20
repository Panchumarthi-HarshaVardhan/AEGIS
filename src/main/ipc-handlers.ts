// ============================================================
// JARVIS Guardian AI — IPC Handler Registration
// ============================================================

import { ipcMain, BrowserWindow, app } from 'electron'
import { randomUUID } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import type Groq from 'groq-sdk'
import type { IntentEngine } from './engines/intent-engine'
import type { SecurityEngine } from './engines/security-engine'
import type { PlannerEngine } from './engines/planner-engine'
import type { ActionEngine } from './engines/action-engine'
import type { MemoryEngine } from './engines/memory-engine'
import type { PhishingDetector } from './security/phishing-detector'
import type { AutomationProvider } from './automation/automation-provider'
import { ProviderManager } from './provider-manager'
import type {
  JarvisResponse,
  ActionResult,
  ConversationMessage,
  SecurityEvent,
  SystemStatus,
  ApprovalRequest,
  PermissionType,
  PermissionState
} from '../shared/types'
import { PermissionManager } from './services/permission-manager'
import { NotificationManager } from './services/notification-manager'

// V3 static imports to resolve bundler chunk packaging
import { AIEngine } from './ai-engine'
import { AutomationGuardian } from './guardians/automation-guardian'
import { RiskEngine } from './risk-engine'
import { EventBus } from './event-bus'
import { isValidFilePath } from './security/path-validator'

interface EngineContext {
  mainWindow: BrowserWindow | null
  intentEngine: IntentEngine
  securityEngine: SecurityEngine
  plannerEngine: PlannerEngine
  actionEngine: ActionEngine
  memoryEngine: MemoryEngine
  phishingDetector: PhishingDetector
  macosAutomation: AutomationProvider
  automationGuardian: AutomationGuardian
  riskEngine: RiskEngine
  aiEngine: AIEngine
}

let emergencyListener: ((reason: string, transcript: string) => void) | null = null
const pendingPermissionRequests = new Map<string, (state: PermissionState) => void>()

export function registerIpcHandlers(ctx: EngineContext): void {
  // Clear any existing handlers to prevent duplicate registration errors when recreating windows
  const channels = [
    'jarvis:command',
    'jarvis:approve',
    'jarvis:analyze-call',
    'jarvis:transcribe',
    'jarvis:analyze-url',
    'jarvis:security-events',
    'jarvis:status',
    'jarvis:history',
    'jarvis:fake-news-check',
    'jarvis:deepfake-check',
    'jarvis:document-summarize',
    'jarvis:ocr-screen',
    'jarvis:get-preference',
    'jarvis:set-preference',
    'jarvis:set-window-mode',
    'jarvis:get-permissions',
    'jarvis:set-permission',
    'jarvis:request-permission',
    'jarvis:respond-permission'
  ]
  for (const channel of channels) {
    ipcMain.removeHandler(channel)
  }

  // Configure PermissionManager callback to prompt user via renderer
  PermissionManager.getInstance().setRequestCallback(async (req) => {
    return new Promise<PermissionState>((resolve) => {
      pendingPermissionRequests.set(req.id, resolve)
      ctx.mainWindow?.webContents.send('jarvis:permission-request', {
        id: req.id,
        guardianName: req.guardianName,
        permission: req.permission
      })

      // Auto-deny timeout after 30 seconds
      setTimeout(() => {
        const pendingResolve = pendingPermissionRequests.get(req.id)
        if (pendingResolve) {
          pendingPermissionRequests.delete(req.id)
          pendingResolve('denied')
        }
      }, 30000)
    })
  })

  const riskEngine = ctx.riskEngine
  const aiEngine = ctx.aiEngine

  // Register RiskEngine alert callback to notify UI
  riskEngine.registerAlertCallback((event: SecurityEvent) => {
    NotificationManager.getInstance().notify(event)
  })

  // Unsubscribe the previous emergency listener to prevent memory leaks and duplicate handler execution
  if (emergencyListener) {
    EventBus.getInstance().unsubscribe('emergency:triggered', emergencyListener)
  }

  // Define and store reusable listener reference
  emergencyListener = (reason: string, transcript: string) => {
    ctx.mainWindow?.webContents.send('jarvis:emergency-triggered', reason, transcript)
  }

  // Listen for emergency triggers on the EventBus and notify UI
  EventBus.getInstance().subscribe(
    'emergency:triggered',
    emergencyListener,
    { name: 'IPCHandlers:Emergency' }
  )

  // -------------------------------------------------------
  // MAIN COMMAND HANDLER — V3 pipeline orchestrator
  // -------------------------------------------------------
  ipcMain.handle('jarvis:command', async (_event, text: string): Promise<JarvisResponse> => {
    if (typeof text !== 'string') {
      return { message: 'Invalid command payload type.' }
    }
    return aiEngine.processCommand(text, (request: ApprovalRequest) => {
      ctx.mainWindow?.webContents.send('jarvis:approval-required', request)
    })
  })

  // -------------------------------------------------------
  // APPROVAL RESPONSE
  // -------------------------------------------------------
  ipcMain.handle('jarvis:approve', async (_event, approvalId: string, approved: boolean): Promise<ActionResult> => {
    if (typeof approvalId !== 'string' || typeof approved !== 'boolean') {
      return { success: false, action: 'approve', message: 'Invalid approval arguments' }
    }
    return aiEngine.handleApprovalResponse(approvalId, approved)
  })

  // -------------------------------------------------------
  // CALL TRANSCRIPT SCANNING FOR SCAMS
  // -------------------------------------------------------
  ipcMain.handle('jarvis:analyze-call', async (_event, text: string): Promise<ActionResult> => {
    if (typeof text !== 'string') {
      return { success: false, action: 'analyze-call', message: 'Invalid transcript payload type.' }
    }
    EventBus.getInstance().publish('call:transcript', text)
    return { success: true, action: 'analyze-call', message: 'Transcript submitted' }
  })

  // -------------------------------------------------------
  // VOICE TRANSCRIPTION
  // -------------------------------------------------------
  ipcMain.handle('jarvis:transcribe', async (_event, audioBuffer: ArrayBuffer): Promise<string> => {
    if (!(audioBuffer instanceof ArrayBuffer)) {
      return 'Voice transcription failed: Invalid audio buffer.'
    }
    const apiKey = process.env.GROQ_API_KEY || ''
    if (!apiKey || apiKey === 'your_groq_api_key_here') {
      return 'Voice transcription failed: GROQ_API_KEY is not configured.'
    }

    const tempDir = app.getPath('temp')
    const tempFilePath = path.join(tempDir, `jarvis_audio_${Date.now()}_${randomUUID().substring(0, 8)}.webm`)

    try {
      fs.writeFileSync(tempFilePath, Buffer.from(audioBuffer))

      const GroqSdk = require('groq-sdk')
      const groq = new GroqSdk({ apiKey }) as Groq
      const response = await groq.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-large-v3',
      })

      try {
        fs.unlinkSync(tempFilePath)
      } catch (err) {
        console.error('Failed to delete temp audio file:', err)
      }

      return response.text || ''
    } catch (error) {
      console.error('[JARVIS] Voice transcription error:', error)
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath)
        }
      } catch (e) {}

      const errMsg = error instanceof Error ? error.message : String(error)
      return `Voice transcription error: ${errMsg}`
    }
  })

  // -------------------------------------------------------
  // URL ANALYSIS
  // -------------------------------------------------------
  ipcMain.handle('jarvis:analyze-url', async (_event, url: string) => {
    if (typeof url !== 'string') {
      return { verdict: 'SAFE', risk_score: 0, signals: [] }
    }
    return ctx.phishingDetector.analyze(url)
  })

  // -------------------------------------------------------
  // SECURITY EVENTS
  // -------------------------------------------------------
  ipcMain.handle('jarvis:security-events', async () => {
    return ctx.memoryEngine.getSecurityEvents(50)
  })

  ipcMain.handle('jarvis:status', async (): Promise<SystemStatus> => {
    const providerStatus = ProviderManager.getInstance().getStatus()
    const isConnected = providerStatus.activeProvider !== 'none'
    return {
      ai_connected: isConnected,
      security_active: true,
      voice_available: isConnected,
      ws_bridge_active: true,
      memory_size: ctx.memoryEngine.getDatabaseSize()
    }
  })

  // -------------------------------------------------------
  // CONVERSATION HISTORY
  // -------------------------------------------------------
  ipcMain.handle('jarvis:history', async () => {
    return ctx.memoryEngine.getHistory(100)
  })

  // -------------------------------------------------------
  // ADVANCED ML OPERATIONAL HANDLERS
  // -------------------------------------------------------
  ipcMain.handle('jarvis:fake-news-check', async (_event, text: string): Promise<any> => {
    if (typeof text !== 'string') {
      return {
        verdict: 'ERROR',
        risk_score: 0,
        claims: [],
        summary: 'Invalid fact check payload type.'
      }
    }
    try {
      const response = await fetch('http://127.0.0.1:8000/api/fake-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (err) {
      console.error('[IPC] Fake News check failed:', err)
      return {
        verdict: 'ERROR',
        risk_score: 0,
        claims: [],
        summary: `Connection error to JARVIS Python service: ${err instanceof Error ? err.message : String(err)}`
      }
    }
  })

  ipcMain.handle('jarvis:deepfake-check', async (_event, filePath: string): Promise<any> => {
    if (typeof filePath !== 'string' || !isValidFilePath(filePath)) {
      return {
        success: false,
        error: 'Access denied: Invalid or restricted file path provided.'
      }
    }
    try {
      const ext = path.extname(filePath).toLowerCase()
      const isAudio = ['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext)
      const endpoint = isAudio
        ? 'http://127.0.0.1:8000/api/deepfake/audio'
        : 'http://127.0.0.1:8000/api/deepfake/video'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath })
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (err) {
      console.error('[IPC] Deepfake check failed:', err)
      return {
        success: false,
        error: `Python backend service connection failure: ${err instanceof Error ? err.message : String(err)}`
      }
    }
  })

  ipcMain.handle('jarvis:document-summarize', async (_event, filePath: string): Promise<any> => {
    if (typeof filePath !== 'string' || !isValidFilePath(filePath)) {
      return {
        success: false,
        error: 'Access denied: Invalid or restricted file path provided.'
      }
    }
    try {
      const response = await fetch('http://127.0.0.1:8000/api/document/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath })
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (err) {
      console.error('[IPC] Document analysis failed:', err)
      return {
        success: false,
        error: `Python document service connection failure: ${err instanceof Error ? err.message : String(err)}`
      }
    }
  })

  ipcMain.handle('jarvis:ocr-screen', async (): Promise<string> => {
    const tempPath = path.join(app.getPath('temp'), `jarvis_screen_${Date.now()}.png`)
    try {
      await ctx.macosAutomation.captureScreen(tempPath)

      const response = await fetch('http://127.0.0.1:8000/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: tempPath })
      })

      if (!response.ok) throw new Error(`OCR HTTP error: ${response.status}`)
      const ocrResult = await response.json()

      try {
        fs.unlinkSync(tempPath)
      } catch (err) {}

      return ocrResult.text || 'No text detected on screen.'
    } catch (err) {
      console.error('[IPC] OCR screen failed:', err)
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
      } catch (e) {}
      return `OCR Screen capture failed: ${err instanceof Error ? err.message : String(err)}`
    }
  })

  // -------------------------------------------------------
  // PREFERENCE HANDLERS
  // -------------------------------------------------------
  ipcMain.handle('jarvis:get-preference', async (_event, key: string): Promise<string | null> => {
    if (typeof key !== 'string') return null
    const pref = ctx.memoryEngine.getPreference(key)
    return pref ? pref.value : null
  })

  ipcMain.handle('jarvis:set-preference', async (_event, key: string, value: string): Promise<void> => {
    if (typeof key !== 'string' || typeof value !== 'string') return
    ctx.memoryEngine.setPreference(key, value)
  })

  // -------------------------------------------------------
  // WINDOW MODE SWITCHER
  // -------------------------------------------------------
  ipcMain.handle('jarvis:set-window-mode', async (_event, mode: 'orb' | 'palette' | 'alert' | 'voice' | 'emergency' | 'workspace' | 'onboarding'): Promise<void> => {
    if (typeof mode !== 'string') return
    const win = ctx.mainWindow
    if (!win) return

    const isMac = process.platform === 'darwin'
    if (isMac) {
      win.setWindowButtonVisibility(mode === 'workspace')
    }

    const { screen } = require('electron')
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize

    if (mode === 'orb') {
      win.setResizable(true)
      win.setSize(90, 90)
      win.setPosition(width - 120, 40)
      win.setAlwaysOnTop(true, 'floating')
      win.setResizable(false)
      win.setFullScreenable(false)
    } else if (mode === 'palette') {
      win.setResizable(true)
      win.setSize(680, 500)
      win.center()
      win.setAlwaysOnTop(true, 'floating')
      win.setResizable(false)
      win.setFullScreenable(false)
      win.focus()
    } else if (mode === 'alert') {
      win.setResizable(true)
      win.setSize(420, 220)
      win.setPosition(width - 440, height - 260)
      win.setAlwaysOnTop(true, 'screen-saver')
      win.setResizable(false)
      win.setFullScreenable(false)
    } else if (mode === 'voice') {
      win.setResizable(true)
      win.setSize(360, 240)
      win.setPosition(width - 380, 40) // Place near top-right next to orb
      win.setAlwaysOnTop(true, 'floating')
      win.setResizable(false)
      win.setFullScreenable(false)
    } else if (mode === 'emergency') {
      win.setResizable(true)
      win.setSize(520, 480)
      win.center()
      win.setAlwaysOnTop(true, 'screen-saver')
      win.setResizable(false)
      win.setFullScreenable(false)
      win.focus()
    } else if (mode === 'workspace') {
      win.setResizable(true)
      win.setSize(1000, 700)
      win.center()
      win.setAlwaysOnTop(false)
      win.setResizable(true)
      win.setFullScreenable(true)
      win.focus()
    } else if (mode === 'onboarding') {
      win.setResizable(true)
      win.setSize(560, 520)
      win.center()
      win.setAlwaysOnTop(true, 'floating')
      win.setResizable(false)
      win.setFullScreenable(false)
      win.focus()
    }
  })

  // -------------------------------------------------------
  // PERMISSION MANAGER HANDLERS
  // -------------------------------------------------------
  ipcMain.handle('jarvis:get-permissions', async (): Promise<any[]> => {
    return PermissionManager.getInstance().getAll()
  })

  ipcMain.handle('jarvis:set-permission', async (_event, permission: PermissionType, state: PermissionState): Promise<void> => {
    if (typeof permission !== 'string' || typeof state !== 'string') return
    const pm = PermissionManager.getInstance()
    if (state === 'granted') {
      pm.grant(permission)
    } else if (state === 'denied') {
      pm.deny(permission)
    } else if (state === 'temporary') {
      pm.grantTemporary(permission)
    } else {
      pm.revoke(permission)
    }
  })

  ipcMain.handle('jarvis:request-permission', async (_event, guardianName: string, permission: PermissionType): Promise<PermissionState> => {
    if (typeof guardianName !== 'string' || typeof permission !== 'string') return 'denied'
    return PermissionManager.getInstance().request(guardianName, permission)
  })

  ipcMain.handle('jarvis:respond-permission', async (_event, requestId: string, state: PermissionState): Promise<ActionResult> => {
    if (typeof requestId !== 'string' || typeof state !== 'string') {
      return { success: false, action: 'respond-permission', message: 'Invalid arguments' }
    }
    const resolve = pendingPermissionRequests.get(requestId)
    if (resolve) {
      pendingPermissionRequests.delete(requestId)
      resolve(state)
      return { success: true, action: 'respond-permission', message: 'Response registered' }
    }
    return { success: false, action: 'respond-permission', message: 'Request not found or timed out' }
  })
}
