"use strict";
// ============================================================
// JARVIS Guardian AI — Main Process Entry Point
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Disable hardware acceleration to save ~60MB RAM by eliminating GPU process
electron_1.app.disableHardwareAcceleration();
// Optimize memory usage for production
electron_1.app.commandLine.appendSwitch('js-flags', '--max-old-space-size=48 --expose-gc');
electron_1.app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
electron_1.app.commandLine.appendSwitch('disable-gpu-program-cache');
electron_1.app.commandLine.appendSwitch('disk-cache-size', '1048576');
electron_1.app.commandLine.appendSwitch('media-cache-size', '1048576');
electron_1.app.commandLine.appendSwitch('disable-extensions');
electron_1.app.commandLine.appendSwitch('disable-background-networking');
electron_1.app.commandLine.appendSwitch('disable-sync');
const path_1 = require("path");
const dotenv_1 = require("dotenv");
const ipc_handlers_1 = require("./ipc-handlers");
const intent_engine_1 = require("./engines/intent-engine");
const provider_manager_1 = require("./provider-manager");
const security_engine_1 = require("./engines/security-engine");
const planner_engine_1 = require("./engines/planner-engine");
const action_engine_1 = require("./engines/action-engine");
const memory_engine_1 = require("./engines/memory-engine");
const macos_automation_1 = require("./automation/macos-automation");
const secret_scanner_1 = require("./security/secret-scanner");
const risk_classifier_1 = require("./security/risk-classifier");
const phishing_detector_1 = require("./security/phishing-detector");
const ws_bridge_1 = require("./ws-bridge");
const child_process_1 = require("child_process");
// V3 Architecture Core Imports
const event_manager_1 = require("./event-manager");
const playwright_automation_1 = require("./automation/playwright-automation");
const browser_guardian_1 = require("./guardians/browser-guardian");
const clipboard_guardian_1 = require("./guardians/clipboard-guardian");
const credential_guardian_1 = require("./guardians/credential-guardian");
const download_guardian_1 = require("./guardians/download-guardian");
const privacy_guardian_1 = require("./guardians/privacy-guardian");
const deepfake_guardian_1 = require("./guardians/deepfake-guardian");
const fake_news_guardian_1 = require("./guardians/fake-news-guardian");
const call_guardian_1 = require("./guardians/call-guardian");
const emergency_guardian_1 = require("./guardians/emergency-guardian");
const context_engine_1 = require("./guardians/context-engine");
const automation_guardian_1 = require("./guardians/automation-guardian");
const fs_1 = require("fs");
// Load environment variables from standard or fallback locations
const envPaths = [
    (0, path_1.join)(electron_1.app.getAppPath(), '.env'),
    (0, path_1.join)(electron_1.app.getAppPath(), '..', '..', '.env'),
    (0, path_1.join)(process.cwd(), '.env'),
    (0, path_1.join)(__dirname, '..', '..', '.env')
];
for (const envPath of envPaths) {
    if ((0, fs_1.existsSync)(envPath)) {
        (0, dotenv_1.config)({ path: envPath });
        break;
    }
}
let mainWindow = null;
// --- Initialize Engines ---
const dbPath = (0, path_1.join)(electron_1.app.getPath('userData'), 'jarvis.db');
const intentEngine = new intent_engine_1.IntentEngine();
const secretScanner = new secret_scanner_1.SecretScanner();
const riskClassifier = new risk_classifier_1.RiskClassifier();
const phishingDetector = new phishing_detector_1.PhishingDetector();
const securityEngine = new security_engine_1.SecurityEngine(secretScanner, riskClassifier, phishingDetector);
const plannerEngine = new planner_engine_1.PlannerEngine();
const macosAutomation = new macos_automation_1.MacOSAutomation();
const playwrightAutomation = new playwright_automation_1.PlaywrightAutomation();
const actionEngine = new action_engine_1.ActionEngine(macosAutomation, playwrightAutomation);
const memoryEngine = new memory_engine_1.MemoryEngine(dbPath);
const wsBridge = new ws_bridge_1.WSBridge(8765, securityEngine, intentEngine);
let eventManager;
let downloadGuardian;
let automationGuardian;
let pythonProcess = null;
function createWindow() {
    const primaryDisplay = electron_1.screen.getPrimaryDisplay();
    const { width } = primaryDisplay.workAreaSize;
    mainWindow = new electron_1.BrowserWindow({
        width: 90,
        height: 90,
        x: width - 120,
        y: 40,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        hasShadow: false,
        webPreferences: {
            preload: (0, path_1.join)(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false
        },
        show: false
    });
    // Ensure overlay floats on top of full-screen apps and workspaces on macOS
    if (process.platform === 'darwin') {
        mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    // Gracefully show window when ready
    mainWindow.on('ready-to-show', () => {
        mainWindow?.show();
        mainWindow?.focus();
        const runGC = () => {
            if (global.gc) {
                try {
                    global.gc();
                    console.log('[JARVIS] Garbage collection completed in Main process.');
                }
                catch (e) {
                    console.error('[JARVIS] Failed to run GC:', e);
                }
            }
        };
        setTimeout(runGC, 1000);
        setTimeout(runGC, 3000);
        setTimeout(runGC, 5000);
        setTimeout(runGC, 8000);
    });
    // Restrict main frame navigation to only local app pages
    mainWindow.webContents.on('will-navigate', (event, url) => {
        const devUrl = process.env.ELECTRON_RENDERER_URL;
        const isAllowed = devUrl
            ? url.startsWith(devUrl)
            : url.startsWith('file://');
        if (!isAllowed) {
            event.preventDefault();
            electron_1.shell.openExternal(url).catch((err) => {
                console.error('[will-navigate] Failed to open external URL:', err);
            });
        }
    });
    // Restrict main frame redirection to only local app pages
    mainWindow.webContents.on('will-redirect', (event, url) => {
        const devUrl = process.env.ELECTRON_RENDERER_URL;
        const isAllowed = devUrl
            ? url.startsWith(devUrl)
            : url.startsWith('file://');
        if (!isAllowed) {
            event.preventDefault();
        }
    });
    // Prevent navigation to external URLs in the main window
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:') || url.startsWith('http:')) {
            electron_1.shell.openExternal(url).catch((err) => {
                console.error('[setWindowOpenHandler] Failed to open external URL:', err);
            });
        }
        return { action: 'deny' };
    });
    // Register IPC handlers
    (0, ipc_handlers_1.registerIpcHandlers)({
        mainWindow,
        intentEngine,
        securityEngine,
        plannerEngine,
        actionEngine,
        memoryEngine,
        phishingDetector,
        macosAutomation,
        automationGuardian
    });
    // Load the renderer
    if (process.env.ELECTRON_RENDERER_URL) {
        mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    }
    else {
        mainWindow.loadFile((0, path_1.join)(__dirname, '../renderer/index.html'));
    }
}
electron_1.app.whenReady().then(async () => {
    // Initialize AI ProviderManager
    await provider_manager_1.ProviderManager.getInstance().initialize();
    // Secure permission requests in defaultSession
    const { session } = require('electron');
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        // Only allow notifications and media (microphone access for voice search)
        const allowedPermissions = ['notifications', 'media'];
        if (allowedPermissions.includes(permission)) {
            callback(true);
        }
        else {
            console.warn(`[Security] Blocked unauthorized permission request: ${permission}`);
            callback(false);
        }
    });
    // Instantiate V3 Event Manager and Guardian Services after app paths are active
    eventManager = new event_manager_1.EventManager();
    const browserGuardian = new browser_guardian_1.BrowserGuardian(phishingDetector);
    const clipboardGuardian = new clipboard_guardian_1.ClipboardGuardian(secretScanner);
    const credentialGuardian = new credential_guardian_1.CredentialGuardian();
    downloadGuardian = new download_guardian_1.DownloadGuardian();
    const privacyGuardian = new privacy_guardian_1.PrivacyGuardian();
    const deepfakeGuardian = new deepfake_guardian_1.DeepfakeGuardian();
    const fakeNewsGuardian = new fake_news_guardian_1.FakeNewsGuardian();
    const callGuardian = new call_guardian_1.CallGuardian();
    const emergencyGuardian = new emergency_guardian_1.EmergencyGuardian();
    automationGuardian = new automation_guardian_1.AutomationGuardian();
    const contextEngine = new context_engine_1.ContextEngine();
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
    ]);
    createWindow();
    // Register Option + Space global shortcut to toggle Command Palette
    electron_1.globalShortcut.register('Option+Space', () => {
        mainWindow?.webContents.send('jarvis:toggle-palette');
    });
    // Start WebSocket bridge for Chrome extension
    wsBridge.start();
    // Start Python backend
    const pythonScript = (0, path_1.join)(electron_1.app.getAppPath(), 'backend/main.py');
    // Use virtual environment python if it exists
    const { existsSync } = require('fs');
    let pythonBin = 'python3';
    const venvPath = (0, path_1.join)(electron_1.app.getAppPath(), 'backend', 'venv', 'bin', 'python');
    const venvWinPath = (0, path_1.join)(electron_1.app.getAppPath(), 'backend', 'venv', 'Scripts', 'python.exe');
    if (existsSync(venvPath)) {
        pythonBin = venvPath;
    }
    else if (existsSync(venvWinPath)) {
        pythonBin = venvWinPath;
    }
    console.log(`[JARVIS] Spawning Python backend service using ${pythonBin} at: ${pythonScript}`);
    pythonProcess = (0, child_process_1.spawn)(pythonBin, [pythonScript], {
        stdio: 'inherit',
        env: process.env,
        cwd: (0, path_1.join)(electron_1.app.getAppPath(), 'backend')
    });
    pythonProcess.on('error', (err) => {
        console.error('[JARVIS] Failed to start Python backend:', err.message);
    });
    // Start V3 Event Manager
    eventManager.start();
    const providerStatus = provider_manager_1.ProviderManager.getInstance().getStatus();
    console.log('[JARVIS] WebSocket bridge started on port 8765');
    console.log('[JARVIS] AI Engine Status:', providerStatus.activeProvider !== 'none' ? `Connected (${providerStatus.activeProvider})` : 'No AI provider configured');
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    wsBridge.stop();
    eventManager.stop();
    downloadGuardian.stop();
    memoryEngine.close();
    if (pythonProcess) {
        pythonProcess.kill();
        pythonProcess = null;
    }
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('before-quit', () => {
    wsBridge.stop();
    eventManager.stop();
    downloadGuardian.stop();
    memoryEngine.close();
    electron_1.globalShortcut.unregisterAll();
    if (pythonProcess) {
        pythonProcess.kill();
        pythonProcess = null;
    }
});
