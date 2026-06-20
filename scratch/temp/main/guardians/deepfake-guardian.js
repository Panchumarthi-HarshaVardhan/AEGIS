"use strict";
// ============================================================
// JARVIS V3 — Deepfake Guardian
// Dispatches media scans to identify audio/video synthetic manipulation
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
exports.DeepfakeGuardian = void 0;
const base_guardian_1 = require("./base-guardian");
const path = __importStar(require("path"));
class DeepfakeGuardian extends base_guardian_1.BaseGuardian {
    constructor() {
        super('DeepfakeGuardian');
    }
    initialize() {
        // Registers to manual deepfake check requests or file downloads
        this.eventBus.subscribe('download:completed', async (filePath) => {
            if (!this.active)
                return;
            const ext = path.extname(filePath).toLowerCase();
            const isMedia = ['.mp4', '.avi', '.mov', '.mp3', '.wav'].includes(ext);
            if (!isMedia)
                return;
            try {
                const result = await this.scanDeepfake(filePath, ext);
                if (result.success && result.confidence > 0.7) {
                    const score = Math.round(result.confidence * 100);
                    this.reportThreat(score, `DEEPFAKE DETECTED: Synthetically modified media detected at "${path.basename(filePath)}". Confidence: ${score}%`, {
                        file_name: path.basename(filePath),
                        file_path: filePath,
                        confidence: result.confidence,
                        explanation: result.explanation
                    });
                }
            }
            catch (err) {
                this.logWarn('Scan failed:', err);
            }
        });
    }
    async scanDeepfake(filePath, ext) {
        const isAudio = ['.mp3', '.wav'].includes(ext);
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
        return response.json();
    }
}
exports.DeepfakeGuardian = DeepfakeGuardian;
