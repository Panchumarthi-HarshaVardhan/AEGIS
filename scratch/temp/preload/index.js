"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electronAPI = {
    // --- Commands ---
    sendCommand: (text) => electron_1.ipcRenderer.invoke('jarvis:command', text),
    approveAction: (approvalId, approved) => electron_1.ipcRenderer.invoke('jarvis:approve', approvalId, approved),
    // --- Voice ---
    transcribeAudio: (audioBuffer) => electron_1.ipcRenderer.invoke('jarvis:transcribe', audioBuffer),
    // --- Security ---
    analyzeUrl: (url) => electron_1.ipcRenderer.invoke('jarvis:analyze-url', url),
    getSecurityEvents: () => electron_1.ipcRenderer.invoke('jarvis:security-events'),
    // --- System ---
    getSystemStatus: () => electron_1.ipcRenderer.invoke('jarvis:status'),
    getConversationHistory: () => electron_1.ipcRenderer.invoke('jarvis:history'),
    // --- Advanced ML Auditing ---
    checkFakeNews: (text) => electron_1.ipcRenderer.invoke('jarvis:fake-news-check', text),
    checkDeepfake: (filePath) => electron_1.ipcRenderer.invoke('jarvis:deepfake-check', filePath),
    summarizeDocument: (filePath) => electron_1.ipcRenderer.invoke('jarvis:document-summarize', filePath),
    ocrScreen: () => electron_1.ipcRenderer.invoke('jarvis:ocr-screen'),
    // --- Window Modes (V2) ---
    setWindowMode: (mode) => electron_1.ipcRenderer.invoke('jarvis:set-window-mode', mode),
    getPreference: (key) => electron_1.ipcRenderer.invoke('jarvis:get-preference', key),
    setPreference: (key, value) => electron_1.ipcRenderer.invoke('jarvis:set-preference', key, value),
    onTogglePalette: (callback) => {
        const handler = () => callback();
        electron_1.ipcRenderer.on('jarvis:toggle-palette', handler);
        return () => electron_1.ipcRenderer.removeListener('jarvis:toggle-palette', handler);
    },
    // --- Events (Main → Renderer subscriptions) ---
    onSecurityAlert: (callback) => {
        const handler = (_e, event) => callback(event);
        electron_1.ipcRenderer.on('jarvis:security-alert', handler);
        return () => electron_1.ipcRenderer.removeListener('jarvis:security-alert', handler);
    },
    onApprovalRequired: (callback) => {
        const handler = (_e, request) => callback(request);
        electron_1.ipcRenderer.on('jarvis:approval-required', handler);
        return () => electron_1.ipcRenderer.removeListener('jarvis:approval-required', handler);
    },
    onStatusUpdate: (callback) => {
        const handler = (_e, status) => callback(status);
        electron_1.ipcRenderer.on('jarvis:status-update', handler);
        return () => electron_1.ipcRenderer.removeListener('jarvis:status-update', handler);
    },
    onEmergencyTriggered: (callback) => {
        const handler = (_e, reason, transcript) => callback(reason, transcript);
        electron_1.ipcRenderer.on('jarvis:emergency-triggered', handler);
        return () => electron_1.ipcRenderer.removeListener('jarvis:emergency-triggered', handler);
    }
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
