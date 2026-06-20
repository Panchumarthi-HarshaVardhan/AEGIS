"use strict";
// ============================================================
// JARVIS Guardian AI — IPC Handler Registration
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIpcHandlers = registerIpcHandlers;
const electron_1 = require("electron");
const crypto_1 = require("crypto");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const provider_manager_1 = require("./provider-manager");
// V3 static imports to resolve bundler chunk packaging
const ai_engine_1 = require("./ai-engine");
const risk_engine_1 = require("./risk-engine");
const event_bus_1 = require("./event-bus");
/**
 * Helper to validate if a file path is safe for application read operations.
 * Resolves paths and denies hidden files, directory traversal, and sensitive system folders.
 */
function isValidFilePath(filePath) {
    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
        return false;
    }
    try {
        const absolutePath = path.resolve(path.normalize(filePath));
        // 1. Prevent traversal tricks
        if (absolutePath.includes('..')) {
            return false;
        }
        // Split path into individual components
        const parts = absolutePath.split(path.sep);
        // 2. Prevent hidden files / dotfiles (e.g., .ssh, .env, .git)
        const hasHidden = parts.some((part) => part.startsWith('.') && part !== '.' && part !== '..');
        if (hasHidden) {
            return false;
        }
        // 3. Block sensitive operating system / system configuration folders on macOS/Unix
        const blockedDirs = new Set([
            'etc',
            'var',
            'System',
            'Library',
            'private',
            'bin',
            'sbin',
            'usr',
            'opt'
        ]);
        // Check if the absolute path starts with any of the blocked folders
        if (parts.length > 1 && blockedDirs.has(parts[1])) {
            return false;
        }
        return true;
    }
    catch (error) {
        return false;
    }
}
let emergencyListener = null;
function registerIpcHandlers(ctx) {
    // Initialize V3 AI and Risk Engines
    const automationGuardian = ctx.automationGuardian;
    const riskEngine = new risk_engine_1.RiskEngine(ctx.memoryEngine);
    const aiEngine = new ai_engine_1.AIEngine(ctx.intentEngine, ctx.plannerEngine, automationGuardian, ctx.actionEngine, ctx.memoryEngine, riskEngine, ctx.securityEngine);
    // Register RiskEngine alert callback to notify UI
    riskEngine.registerAlertCallback((event) => {
        ctx.mainWindow?.webContents.send('jarvis:security-alert', event);
    });
    // Unsubscribe the previous emergency listener to prevent memory leaks and duplicate handler execution
    if (emergencyListener) {
        event_bus_1.EventBus.getInstance().unsubscribe('emergency:triggered', emergencyListener);
    }
    // Define and store reusable listener reference
    emergencyListener = (reason, transcript) => {
        ctx.mainWindow?.webContents.send('jarvis:emergency-triggered', reason, transcript);
    };
    // Listen for emergency triggers on the EventBus and notify UI
    event_bus_1.EventBus.getInstance().subscribe('emergency:triggered', emergencyListener, { name: 'IPCHandlers:Emergency' });
    // -------------------------------------------------------
    // MAIN COMMAND HANDLER — V3 pipeline orchestrator
    // -------------------------------------------------------
    electron_1.ipcMain.handle('jarvis:command', async (_event, text) => {
        if (typeof text !== 'string') {
            return { message: 'Invalid command payload type.' };
        }
        return aiEngine.processCommand(text, (request) => {
            ctx.mainWindow?.webContents.send('jarvis:approval-required', request);
        });
    });
    // -------------------------------------------------------
    // APPROVAL RESPONSE
    // -------------------------------------------------------
    electron_1.ipcMain.handle('jarvis:approve', async (_event, approvalId, approved) => {
        if (typeof approvalId !== 'string' || typeof approved !== 'boolean') {
            return { success: false, action: 'approve', message: 'Invalid approval arguments' };
        }
        return aiEngine.handleApprovalResponse(approvalId, approved);
    });
    // -------------------------------------------------------
    // CALL TRANSCRIPT SCANNING FOR SCAMS
    // -------------------------------------------------------
    electron_1.ipcMain.handle('jarvis:analyze-call', async (_event, text) => {
        if (typeof text !== 'string') {
            return { success: false, action: 'analyze-call', message: 'Invalid transcript payload type.' };
        }
        event_bus_1.EventBus.getInstance().publish('call:transcript', text);
        return { success: true, action: 'analyze-call', message: 'Transcript submitted' };
    });
    // -------------------------------------------------------
    // VOICE TRANSCRIPTION
    // -------------------------------------------------------
    electron_1.ipcMain.handle('jarvis:transcribe', async (_event, audioBuffer) => {
        if (!(audioBuffer instanceof ArrayBuffer)) {
            return 'Voice transcription failed: Invalid audio buffer.';
        }
        const apiKey = process.env.GROQ_API_KEY || '';
        if (!apiKey || apiKey === 'your_groq_api_key_here') {
            return 'Voice transcription failed: GROQ_API_KEY is not configured.';
        }
        const tempDir = electron_1.app.getPath('temp');
        const tempFilePath = path.join(tempDir, `jarvis_audio_${Date.now()}_${(0, crypto_1.randomUUID)().substring(0, 8)}.webm`);
        try {
            fs.writeFileSync(tempFilePath, Buffer.from(audioBuffer));
            const GroqSdk = require('groq-sdk');
            const groq = new GroqSdk({ apiKey });
            const response = await groq.audio.transcriptions.create({
                file: fs.createReadStream(tempFilePath),
                model: 'whisper-large-v3',
            });
            try {
                fs.unlinkSync(tempFilePath);
            }
            catch (err) {
                console.error('Failed to delete temp audio file:', err);
            }
            return response.text || '';
        }
        catch (error) {
            console.error('[JARVIS] Voice transcription error:', error);
            try {
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
            }
            catch (e) { }
            const errMsg = error instanceof Error ? error.message : String(error);
            return `Voice transcription error: ${errMsg}`;
        }
    });
    // -------------------------------------------------------
    // URL ANALYSIS
    // -------------------------------------------------------
    electron_1.ipcMain.handle('jarvis:analyze-url', async (_event, url) => {
        if (typeof url !== 'string') {
            return { verdict: 'SAFE', risk_score: 0, signals: [] };
        }
        return ctx.phishingDetector.analyze(url);
    });
    // -------------------------------------------------------
    // SECURITY EVENTS
    // -------------------------------------------------------
    electron_1.ipcMain.handle('jarvis:security-events', async () => {
        return ctx.memoryEngine.getSecurityEvents(50);
    });
    electron_1.ipcMain.handle('jarvis:status', async () => {
        const providerStatus = provider_manager_1.ProviderManager.getInstance().getStatus();
        const isConnected = providerStatus.activeProvider !== 'none';
        return {
            ai_connected: isConnected,
            security_active: true,
            voice_available: isConnected,
            ws_bridge_active: true,
            memory_size: ctx.memoryEngine.getDatabaseSize()
        };
    });
    // -------------------------------------------------------
    // CONVERSATION HISTORY
    // -------------------------------------------------------
    electron_1.ipcMain.handle('jarvis:history', async () => {
        return ctx.memoryEngine.getHistory(100);
    });
    // -------------------------------------------------------
    // ADVANCED ML OPERATIONAL HANDLERS
    // -------------------------------------------------------
    electron_1.ipcMain.handle('jarvis:fake-news-check', async (_event, text) => {
        if (typeof text !== 'string') {
            return {
                verdict: 'ERROR',
                risk_score: 0,
                claims: [],
                summary: 'Invalid fact check payload type.'
            };
        }
        try {
            const response = await fetch('http://127.0.0.1:8000/api/fake-news', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
            return await response.json();
        }
        catch (err) {
            console.error('[IPC] Fake News check failed:', err);
            return {
                verdict: 'ERROR',
                risk_score: 0,
                claims: [],
                summary: `Connection error to JARVIS Python service: ${err instanceof Error ? err.message : String(err)}`
            };
        }
    });
    electron_1.ipcMain.handle('jarvis:deepfake-check', async (_event, filePath) => {
        if (typeof filePath !== 'string' || !isValidFilePath(filePath)) {
            return {
                success: false,
                error: 'Access denied: Invalid or restricted file path provided.'
            };
        }
        try {
            const ext = path.extname(filePath).toLowerCase();
            const isAudio = ['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext);
            const endpoint = isAudio
                ? 'http://127.0.0.1:8000/api/deepfake/audio'
                : 'http://127.0.0.1:8000/api/deepfake/video';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_path: filePath })
            });
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
            return await response.json();
        }
        catch (err) {
            console.error('[IPC] Deepfake check failed:', err);
            return {
                success: false,
                error: `Python backend service connection failure: ${err instanceof Error ? err.message : String(err)}`
            };
        }
    });
    electron_1.ipcMain.handle('jarvis:document-summarize', async (_event, filePath) => {
        if (typeof filePath !== 'string' || !isValidFilePath(filePath)) {
            return {
                success: false,
                error: 'Access denied: Invalid or restricted file path provided.'
            };
        }
        try {
            const response = await fetch('http://127.0.0.1:8000/api/document/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_path: filePath })
            });
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
            return await response.json();
        }
        catch (err) {
            console.error('[IPC] Document analysis failed:', err);
            return {
                success: false,
                error: `Python document service connection failure: ${err instanceof Error ? err.message : String(err)}`
            };
        }
    });
    electron_1.ipcMain.handle('jarvis:ocr-screen', async () => {
        const tempPath = path.join(electron_1.app.getPath('temp'), `jarvis_screen_${Date.now()}.png`);
        try {
            await ctx.macosAutomation.captureScreen(tempPath);
            const response = await fetch('http://127.0.0.1:8000/api/ocr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_path: tempPath })
            });
            if (!response.ok)
                throw new Error(`OCR HTTP error: ${response.status}`);
            const ocrResult = await response.json();
            try {
                fs.unlinkSync(tempPath);
            }
            catch (err) { }
            return ocrResult.text || 'No text detected on screen.';
        }
        catch (err) {
            console.error('[IPC] OCR screen failed:', err);
            try {
                if (fs.existsSync(tempPath))
                    fs.unlinkSync(tempPath);
            }
            catch (e) { }
            return `OCR Screen capture failed: ${err instanceof Error ? err.message : String(err)}`;
        }
    });
    // -------------------------------------------------------
    // PREFERENCE HANDLERS
    // -------------------------------------------------------
    electron_1.ipcMain.handle('jarvis:get-preference', async (_event, key) => {
        if (typeof key !== 'string')
            return null;
        const pref = ctx.memoryEngine.getPreference(key);
        return pref ? pref.value : null;
    });
    electron_1.ipcMain.handle('jarvis:set-preference', async (_event, key, value) => {
        if (typeof key !== 'string' || typeof value !== 'string')
            return;
        ctx.memoryEngine.setPreference(key, value);
    });
    // -------------------------------------------------------
    // WINDOW MODE SWITCHER
    // -------------------------------------------------------
    electron_1.ipcMain.handle('jarvis:set-window-mode', async (_event, mode) => {
        if (typeof mode !== 'string')
            return;
        const win = ctx.mainWindow;
        if (!win)
            return;
        const { screen } = require('electron');
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;
        if (mode === 'orb') {
            win.setResizable(true);
            win.setSize(90, 90);
            win.setPosition(width - 120, 40);
            win.setAlwaysOnTop(true, 'floating');
            win.setResizable(false);
            win.setFullScreenable(false);
        }
        else if (mode === 'palette') {
            win.setResizable(true);
            win.setSize(680, 500);
            win.center();
            win.setAlwaysOnTop(true, 'floating');
            win.setResizable(false);
            win.setFullScreenable(false);
            win.focus();
        }
        else if (mode === 'alert') {
            win.setResizable(true);
            win.setSize(420, 220);
            win.setPosition(width - 440, height - 260);
            win.setAlwaysOnTop(true, 'screen-saver');
            win.setResizable(false);
            win.setFullScreenable(false);
        }
        else if (mode === 'voice') {
            win.setResizable(true);
            win.setSize(360, 240);
            win.setPosition(width - 380, 40); // Place near top-right next to orb
            win.setAlwaysOnTop(true, 'floating');
            win.setResizable(false);
            win.setFullScreenable(false);
        }
        else if (mode === 'emergency') {
            win.setResizable(true);
            win.setSize(520, 480);
            win.center();
            win.setAlwaysOnTop(true, 'screen-saver');
            win.setResizable(false);
            win.setFullScreenable(false);
            win.focus();
        }
        else if (mode === 'workspace') {
            win.setResizable(true);
            win.setSize(1000, 700);
            win.center();
            win.setAlwaysOnTop(false);
            win.setResizable(true);
            win.setFullScreenable(true);
            win.focus();
        }
        else if (mode === 'onboarding') {
            win.setResizable(true);
            win.setSize(560, 520);
            win.center();
            win.setAlwaysOnTop(true, 'floating');
            win.setResizable(false);
            win.setFullScreenable(false);
            win.focus();
        }
    });
}
