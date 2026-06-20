"use strict";
// ============================================================
// JARVIS V3 — Download Guardian
// Watches the OS Downloads directory and triggers malware and YARA scans
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
exports.DownloadGuardian = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const electron_1 = require("electron");
const base_guardian_1 = require("./base-guardian");
const IGNORED_TEMP_EXTENSIONS = new Set([
    '.crdownload', // Chrome
    '.download', // Safari
    '.tmp', // Firefox / generic
    '.part' // Firefox
]);
class DownloadGuardian extends base_guardian_1.BaseGuardian {
    constructor() {
        super('DownloadGuardian');
    }
    initialize() {
        if (this.downloadsPath === undefined)
            this.downloadsPath = '';
        if (this.watcher === undefined)
            this.watcher = null;
        if (this.scannedFiles === undefined)
            this.scannedFiles = new Set();
        // Start watching downloads directory
        this.startWatcher();
    }
    startWatcher() {
        if (this.watcher) {
            this.stop();
        }
        try {
            this.downloadsPath = electron_1.app.getPath('downloads');
        }
        catch (err) {
            this.logWarn('app.getPath("downloads") failed, trying fallback:', err);
        }
        if (!this.downloadsPath) {
            const os = require('os');
            this.downloadsPath = path.join(os.homedir(), 'Downloads');
        }
        this.log(`Watching downloads: ${this.downloadsPath}`);
        try {
            this.watcher = fs.watch(this.downloadsPath, (eventType, filename) => {
                if (eventType === 'rename' && filename) {
                    const filePath = path.join(this.downloadsPath, filename);
                    this.handleFileChange(filePath).catch((err) => {
                        this.logError('Error scanning file:', err);
                    });
                }
            });
        }
        catch (err) {
            this.logError('Failed to watch downloads folder:', err);
        }
    }
    /** Close file watcher on shutdown */
    stop() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }
    setActive(active) {
        super.setActive(active);
        if (!active) {
            this.stop();
        }
    }
    async handleFileChange(filePath) {
        const ext = path.extname(filePath).toLowerCase();
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
        if (this.scannedFiles.has(filePath))
            return;
        this.scannedFiles.add(filePath);
        // Wait 500ms for browser to release lock
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (!fs.existsSync(filePath))
            return;
        this.log(`File completed download, scanning: ${path.basename(filePath)}`);
        this.eventBus.publish('download:completed', filePath);
        try {
            const scanResult = await this.scanFileViaBackend(filePath);
            if (scanResult.status === 'DANGEROUS') {
                const score = scanResult.score || 95;
                this.reportThreat(score, `MALWARE INTERCEPTED: Downloaded file "${path.basename(filePath)}" failed security check. Reason: ${scanResult.description}`, {
                    file_name: path.basename(filePath),
                    file_path: filePath,
                    verdict: scanResult.verdict,
                    risk_score: score
                });
            }
        }
        catch (err) {
            this.logWarn(`Scan connection error on ${path.basename(filePath)}:`, err);
        }
    }
    async scanFileViaBackend(filePath) {
        const response = await fetch('http://127.0.0.1:8000/api/malware/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_path: filePath })
        });
        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);
        return response.json();
    }
}
exports.DownloadGuardian = DownloadGuardian;
