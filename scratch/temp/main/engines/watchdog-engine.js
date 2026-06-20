"use strict";
// ============================================================
// JARVIS Guardian AI — Downloads Watchdog Engine
// Watches Downloads directory for malware scans
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
exports.WatchdogEngine = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const electron_1 = require("electron");
const crypto_1 = require("crypto");
/** Extensions indicating active downloads that should be ignored */
const IGNORED_TEMP_EXTENSIONS = new Set([
    '.crdownload', // Chrome
    '.download', // Safari
    '.tmp', // Firefox / generic
    '.part' // Firefox
]);
class WatchdogEngine {
    memoryEngine;
    automation;
    downloadsPath;
    watcher = null;
    scannedFiles = new Set();
    constructor(memoryEngine, automation) {
        this.memoryEngine = memoryEngine;
        this.automation = automation;
        this.downloadsPath = electron_1.app.getPath('downloads');
    }
    /** Start watching the downloads directory */
    start(onAlertCallback) {
        if (this.watcher) {
            console.warn('WatchdogEngine: Already running');
            return;
        }
        console.log(`[Watchdog] Monitoring folder: ${this.downloadsPath}`);
        try {
            this.watcher = fs.watch(this.downloadsPath, (eventType, filename) => {
                if (eventType === 'rename' && filename) {
                    const filePath = path.join(this.downloadsPath, filename);
                    this.handleFileChange(filePath, onAlertCallback).catch((err) => {
                        console.error('[Watchdog] Error handling file change:', err);
                    });
                }
            });
        }
        catch (err) {
            console.error('[Watchdog] Failed to start folder monitoring:', err);
        }
    }
    /** Stop the folder watcher */
    stop() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
            console.log('[Watchdog] Folder monitoring stopped');
        }
    }
    /** Process file rename/addition event */
    async handleFileChange(filePath, onAlertCallback) {
        const ext = path.extname(filePath).toLowerCase();
        // Ignore temp download extensions and folders
        if (IGNORED_TEMP_EXTENSIONS.has(ext))
            return;
        if (!fs.existsSync(filePath))
            return;
        try {
            const stats = fs.statSync(filePath);
            if (stats.isDirectory())
                return;
        }
        catch {
            return;
        }
        // Prevent double-scanning of same file
        if (this.scannedFiles.has(filePath))
            return;
        this.scannedFiles.add(filePath);
        // Wait 500ms to ensure file lock is released by browser download process
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (!fs.existsSync(filePath))
            return;
        console.log(`[Watchdog] New download detected, scanning: ${path.basename(filePath)}`);
        try {
            const scanResult = await this.scanFileViaBackend(filePath);
            if (scanResult.status === 'DANGEROUS') {
                const file_name = path.basename(filePath);
                // 1. Create a security threat event
                const threatEvent = {
                    id: (0, crypto_1.randomUUID)(),
                    type: 'action_blocked', // matches alert type filter
                    severity: 'critical',
                    description: `MALWARE BLOCKED: File "${file_name}" failed safety check. Verdict: ${scanResult.verdict}. Reason: ${scanResult.description}`,
                    timestamp: Date.now(),
                    details: {
                        file_name,
                        file_path: filePath,
                        verdict: scanResult.verdict,
                        risk_score: scanResult.score
                    }
                };
                // 2. Log threat to database
                this.memoryEngine.logSecurityEvent(threatEvent);
                // 3. Trigger alert callback to UI
                onAlertCallback(threatEvent);
                // 4. Show OS notification
                await this.automation.showNotification('🚨 JARVIS Security Shield', `Threat blocked in downloads: ${file_name}`);
                console.warn(`[Watchdog] Security Threat Intercepted: ${file_name}`);
            }
            else {
                console.log(`[Watchdog] Scan completed: ${path.basename(filePath)} is SAFE`);
            }
        }
        catch (err) {
            console.warn(`[Watchdog] Scan error on ${path.basename(filePath)}:`, err);
        }
    }
    /** Make request to local FastAPI scanner */
    async scanFileViaBackend(filePath) {
        const response = await fetch('http://127.0.0.1:8000/api/malware/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_path: filePath })
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }
}
exports.WatchdogEngine = WatchdogEngine;
