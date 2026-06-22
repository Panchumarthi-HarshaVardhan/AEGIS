// ============================================================
// JARVIS Guardian AI — Main Process Entry Point
// ============================================================

import { app, BrowserWindow, shell, globalShortcut, screen, Notification as ElectronNotification } from 'electron'

// Handle EPIPE and uncaught exceptions globally — prevents Electron's crash dialog
process.stdout.on('error', (err: any) => {
  if (err && err.code === 'EPIPE') return
})
process.stderr.on('error', (err: any) => {
  if (err && err.code === 'EPIPE') return
})
process.on('uncaughtException', (err: any) => {
  // Silently ignore broken pipe errors (happen when mic/audio stream closes)
  if (err && err.code === 'EPIPE') return
  // For all other errors: log safely without re-throwing
  // (re-throwing inside uncaughtException triggers Electron's built-in crash dialog)
  try {
    process.stderr.write(`[JARVIS] Uncaught Exception: ${err?.stack || err?.message || String(err)}\n`)
  } catch (_) {}
})



// Disable hardware acceleration to save ~60MB RAM by eliminating GPU process
app.disableHardwareAcceleration()

// Optimize memory usage for production
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=48 --expose-gc')
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disable-gpu-program-cache')
app.commandLine.appendSwitch('disk-cache-size', '1048576')
app.commandLine.appendSwitch('media-cache-size', '1048576')
app.commandLine.appendSwitch('disable-extensions')
app.commandLine.appendSwitch('disable-background-networking')
app.commandLine.appendSwitch('disable-sync')
import { join } from 'path'
import { config } from 'dotenv'
import { registerIpcHandlers } from './ipc-handlers'
import { IntentEngine } from './engines/intent-engine'
import { ProviderManager } from './provider-manager'
import { SecurityEngine } from './engines/security-engine'
import { PlannerEngine } from './engines/planner-engine'
import { ActionEngine } from './engines/action-engine'
import { MemoryEngine } from './engines/memory-engine'
import { MacOSAutomation } from './automation/macos-automation'
import { WindowsAutomation } from './automation/windows-automation'
import { LinuxAutomation } from './automation/linux-automation'
import { MockAutomationProvider } from './automation/mock-automation'
import { AutomationProvider } from './automation/automation-provider'
import { SecretScanner } from './security/secret-scanner'
import { RiskClassifier } from './security/risk-classifier'
import { PhishingDetector } from './security/phishing-detector'
import { WSBridge } from './ws-bridge'

import { TrustEngine } from './engines/trust-engine'

// V4 Infrastructure Layer
import { ServiceManager } from './services/service-manager'
import { PermissionManager } from './services/permission-manager'
import { NotificationManager } from './services/notification-manager'
import { GuardianRegistry } from './guardians/guardian-registry'
import {
  MemoryService,
  WebSocketService,
  EventManagerService,
  AIProviderService,
  PythonBackendService
} from './services/service-adapters'

// V3 Architecture Core Imports
import { EventManager } from './event-manager'
import { PlaywrightAutomation } from './automation/playwright-automation'
import { BrowserGuardian } from './guardians/browser-guardian'
import { ClipboardGuardian } from './guardians/clipboard-guardian'
import { CredentialGuardian } from './guardians/credential-guardian'
import { DownloadGuardian } from './guardians/download-guardian'
import { PrivacyGuardian } from './guardians/privacy-guardian'
import { DeepfakeGuardian } from './guardians/deepfake-guardian'
import { FakeNewsGuardian } from './guardians/fake-news-guardian'
import { CallGuardian } from './guardians/call-guardian'
import { EmergencyGuardian } from './guardians/emergency-guardian'
import { ContextEngine } from './guardians/context-engine'
import { AutomationGuardian } from './guardians/automation-guardian'
import { RiskEngine } from './risk-engine'
import { AIEngine } from './ai-engine'

import { existsSync } from 'fs'

// Load environment variables from standard or fallback locations
const envPaths = [
  join(app.getAppPath(), '.env'),
  join(app.getAppPath(), '..', '..', '.env'),
  join(process.cwd(), '.env'),
  join(__dirname, '..', '..', '.env')
]
for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    config({ path: envPath })
    break
  }
}

let mainWindow: BrowserWindow | null = null

// --- Initialize Engines ---
const dbPath = join(app.getPath('userData'), 'jarvis.db')

const intentEngine = new IntentEngine()
const secretScanner = new SecretScanner()
const riskClassifier = new RiskClassifier()
const phishingDetector = new PhishingDetector()
const securityEngine = new SecurityEngine(secretScanner, riskClassifier, phishingDetector)
const trustEngine = new TrustEngine(phishingDetector, secretScanner)
const plannerEngine = new PlannerEngine()
const automationProvider: AutomationProvider =
  process.platform === 'darwin' ? new MacOSAutomation() :
  process.platform === 'win32' ? new WindowsAutomation() :
  process.platform === 'linux' ? new LinuxAutomation() :
  new MockAutomationProvider()
const playwrightAutomation = new PlaywrightAutomation()
const actionEngine = new ActionEngine(automationProvider, playwrightAutomation)
const memoryEngine = new MemoryEngine(dbPath)
const wsBridge = new WSBridge(8765, securityEngine, intentEngine)

let eventManager: EventManager
let downloadGuardian: DownloadGuardian
let automationGuardian: AutomationGuardian
let riskEngine: RiskEngine
let aiEngine: AIEngine


function createWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width } = primaryDisplay.workAreaSize

  const isMac = process.platform === 'darwin'

  mainWindow = new BrowserWindow({
    width: 90,
    height: 90,
    x: width - 120,
    y: 40,
    frame: isMac ? true : false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    ...(isMac ? {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 14 },
      vibrancy: 'under-window',
      visualEffectState: 'active',
    } : {}),
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    show: false
  })

  if (isMac) {
    mainWindow.setWindowButtonVisibility(false)
  }

  // Ensure overlay floats on top of full-screen apps and workspaces on macOS
  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  // Gracefully show window when ready
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.focus()
    
    const runGC = () => {
      if (global.gc) {
        try {
          global.gc()
          console.log('[JARVIS] Garbage collection completed in Main process.')
        } catch (e) {
          console.error('[JARVIS] Failed to run GC:', e)
        }
      }
    }
    
    setTimeout(runGC, 1000)
    setTimeout(runGC, 3000)
    setTimeout(runGC, 5000)
    setTimeout(runGC, 8000)
  })

  // Restrict main frame navigation to only local app pages
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL
    const isAllowed = devUrl
      ? url.startsWith(devUrl)
      : url.startsWith('file://')

    if (!isAllowed) {
      event.preventDefault()
      shell.openExternal(url).catch((err) => {
        console.error('[will-navigate] Failed to open external URL:', err)
      })
    }
  })

  // Restrict main frame redirection to only local app pages
  mainWindow.webContents.on('will-redirect', (event, url) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL
    const isAllowed = devUrl
      ? url.startsWith(devUrl)
      : url.startsWith('file://')

    if (!isAllowed) {
      event.preventDefault()
    }
  })

  // Prevent navigation to external URLs in the main window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url).catch((err) => {
        console.error('[setWindowOpenHandler] Failed to open external URL:', err)
      })
    }
    return { action: 'deny' }
  })

  // Register main window with NotificationManager
  NotificationManager.getInstance().setMainWindow(mainWindow)

  // Register IPC handlers
  registerIpcHandlers({
    mainWindow,
    intentEngine,
    securityEngine,
    plannerEngine,
    actionEngine,
    memoryEngine,
    phishingDetector,
    macosAutomation: automationProvider,
    automationGuardian,
    riskEngine,
    aiEngine
  })

  // Load the renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  // Secure permission requests in defaultSession
  const { session } = require('electron')
  session.defaultSession.setPermissionRequestHandler((_webContents: any, permission: string, callback: (isAllowed: boolean) => void) => {
    // Only allow notifications and media (microphone access for voice search)
    const allowedPermissions = ['notifications', 'media']
    if (allowedPermissions.includes(permission)) {
      callback(true)
    } else {
      console.warn(`[Security] Blocked unauthorized permission request: ${permission}`)
      callback(false)
    }
  })

  // Request macOS microphone access at startup and expose status globally
  if (process.platform === 'darwin') {
    const { systemPreferences } = require('electron')
    const status: string = systemPreferences.getMediaAccessStatus('microphone')
    console.log(`[JARVIS] macOS microphone status: ${status}`)

    if (status === 'not-determined') {
      // First launch — request permission from the system
      systemPreferences.askForMediaAccess('microphone').then((granted: boolean) => {
        console.log(`[JARVIS] Microphone permission granted: ${granted}`)
        process.env.JARVIS_MIC_STATUS = granted ? 'granted' : 'denied'
      })
    } else if (status === 'denied') {
      // Already denied — notify user with instructions
      process.env.JARVIS_MIC_STATUS = 'denied'
      console.warn('[JARVIS] Microphone access denied by macOS. User must enable it in System Settings.')
      if (ElectronNotification.isSupported()) {
        const n = new ElectronNotification({
          title: '🎙️ Microphone Access Required',
          body: 'AEGIS needs mic access for voice input. Go to System Settings → Privacy & Security → Microphone and enable AEGIS.'
        })
        n.on('click', () => {
          shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone')
        })
        n.show()
      }
    } else {
      process.env.JARVIS_MIC_STATUS = status // 'granted' | 'restricted'
    }
  } else {
    // Non-macOS: assume available
    process.env.JARVIS_MIC_STATUS = 'granted'
  }

  // Instantiate V3 Event Manager and Guardian Services after app paths are active
  eventManager = new EventManager()
  const browserGuardian = new BrowserGuardian(phishingDetector)
  const clipboardGuardian = new ClipboardGuardian(secretScanner)
  const credentialGuardian = new CredentialGuardian()
  downloadGuardian = new DownloadGuardian()
  const privacyGuardian = new PrivacyGuardian()
  const deepfakeGuardian = new DeepfakeGuardian()
  const fakeNewsGuardian = new FakeNewsGuardian()
  const callGuardian = new CallGuardian()
  const emergencyGuardian = new EmergencyGuardian()
  automationGuardian = new AutomationGuardian()
  const contextEngine = new ContextEngine()

  // Register guardians to context engine for adaptive power control
  contextEngine.registerGuardians([
    browserGuardian,
    clipboardGuardian,
    credentialGuardian,
    downloadGuardian,
    privacyGuardian,
    deepfakeGuardian,
    fakeNewsGuardian,
    callGuardian,
    emergencyGuardian,
    automationGuardian
  ])

  // Initialize RiskEngine and AIEngine singletons
  riskEngine = new RiskEngine(memoryEngine)
  aiEngine = new AIEngine(
    intentEngine,
    plannerEngine,
    automationGuardian,
    actionEngine,
    memoryEngine,
    riskEngine,
    securityEngine
  )

  // Initialize PermissionManager
  PermissionManager.getInstance().initialize(memoryEngine)

  // Initialize and register background services
  const serviceManager = ServiceManager.getInstance()
  serviceManager.register(new MemoryService(memoryEngine))
  serviceManager.register(new AIProviderService())
  serviceManager.register(new PythonBackendService())
  serviceManager.register(new WebSocketService(wsBridge))
  serviceManager.register(new EventManagerService(eventManager))

  // Start all services sequentially
  await serviceManager.startAll()

  // Register and start guardians
  const guardianRegistry = GuardianRegistry.getInstance()
  guardianRegistry.register(browserGuardian)
  guardianRegistry.register(clipboardGuardian)
  guardianRegistry.register(credentialGuardian)
  guardianRegistry.register(downloadGuardian)
  guardianRegistry.register(privacyGuardian)
  guardianRegistry.register(deepfakeGuardian)
  guardianRegistry.register(fakeNewsGuardian)
  guardianRegistry.register(callGuardian)
  guardianRegistry.register(emergencyGuardian)
  guardianRegistry.register(automationGuardian)

  guardianRegistry.startAll()

  createWindow()

  // Register Option + Space global shortcut to toggle Command Palette
  globalShortcut.register('Option+Space', () => {
    mainWindow?.webContents.send('jarvis:toggle-palette')
  })

  const providerStatus = ProviderManager.getInstance().getStatus()
  console.log('[JARVIS] Services and guardians initialized successfully.')
  console.log('[JARVIS] AI Engine Status:', providerStatus.activeProvider !== 'none' ? `Connected (${providerStatus.activeProvider})` : 'No AI provider configured')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

let isCleaningUp = false

async function handleQuit(event: any): Promise<void> {
  if (isCleaningUp) return
  event.preventDefault()
  isCleaningUp = true

  console.log('[AEGIS] Initiating clean application shutdown...')

  // 1. Unregister keyboard shortcuts
  try {
    globalShortcut.unregisterAll()
  } catch (e) {}

  // 2. Stop all guardians
  try {
    GuardianRegistry.getInstance().stopAll()
  } catch (e) {}

  // 3. Stop all services
  try {
    await ServiceManager.getInstance().stopAll()
  } catch (e) {}

  console.log('[AEGIS] Teardown complete. Exiting process.')
  app.exit(0)
}

app.on('before-quit', (event) => {
  handleQuit(event)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})


