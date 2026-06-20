"use strict";
// ============================================================
// JARVIS V3 — Context Engine
// Manages system power states and selectively enables guardians
// based on user activity (Banking, Meetings, Development, etc.)
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextEngine = void 0;
const base_guardian_1 = require("./base-guardian");
class ContextEngine extends base_guardian_1.BaseGuardian {
    currentMode = 'general';
    guardians = new Map();
    constructor() {
        super('ContextEngine');
    }
    initialize() {
        // 1. Listen for active window focus changes to infer context
        this.eventBus.subscribe('window:focused', (appName) => {
            this.evaluateContext(appName, null);
        });
        // 2. Listen for URL changes to detect banking or secure logins
        this.eventBus.subscribe('browser:navigation', (url) => {
            this.evaluateContext(null, url);
        });
    }
    /** Register guardians that should be dynamically powered up/down */
    registerGuardians(guardiansList) {
        for (const guardian of guardiansList) {
            if (guardian !== this) {
                this.guardians.set(guardian.getName(), guardian);
            }
        }
        this.applyMode(this.currentMode);
    }
    /** Check active window or navigation url to switch system state */
    evaluateContext(appName, url) {
        let targetMode = this.currentMode;
        if (appName) {
            const lowerApp = appName.toLowerCase();
            if (lowerApp.includes('code') ||
                lowerApp.includes('vscode') ||
                lowerApp.includes('cursor') ||
                lowerApp.includes('xcode') ||
                lowerApp.includes('terminal') ||
                lowerApp.includes('iterm') ||
                lowerApp.includes('intellij') ||
                lowerApp.includes('webstorm')) {
                targetMode = 'development';
            }
            else if (lowerApp.includes('zoom') ||
                lowerApp.includes('teams') ||
                lowerApp.includes('discord') ||
                lowerApp.includes('slack') ||
                lowerApp.includes('webex') ||
                lowerApp.includes('meet')) {
                targetMode = 'meeting';
            }
            else if (lowerApp.includes('spotify') || lowerApp.includes('vlc') || lowerApp.includes('youtube')) {
                targetMode = 'entertainment';
            }
        }
        if (url) {
            const lowerUrl = url.toLowerCase();
            if (lowerUrl.includes('paypal') ||
                lowerUrl.includes('chase.com') ||
                lowerUrl.includes('wellsfargo') ||
                lowerUrl.includes('bankofamerica') ||
                lowerUrl.includes('stripe') ||
                lowerUrl.includes('checkout') ||
                lowerUrl.includes('onlinebanking') ||
                lowerUrl.includes('paytm') ||
                lowerUrl.includes('bank')) {
                targetMode = 'banking';
            }
        }
        if (targetMode !== this.currentMode) {
            this.currentMode = targetMode;
            console.log(`[ContextEngine] Mode transitioned to: ${targetMode.toUpperCase()}`);
            this.eventBus.publish('context:changed', targetMode);
            this.applyMode(targetMode);
        }
    }
    /** Apply active state masks to all registered guardians */
    applyMode(mode) {
        const activeMap = {
            BrowserGuardian: false,
            ClipboardGuardian: false,
            CredentialGuardian: false,
            DownloadGuardian: false,
            PrivacyGuardian: false,
            DeepfakeGuardian: false,
            FakeNewsGuardian: false,
            CallGuardian: false,
            EmergencyGuardian: false,
            AutomationGuardian: false
        };
        switch (mode) {
            case 'development':
                activeMap.CredentialGuardian = true;
                activeMap.ClipboardGuardian = true;
                activeMap.BrowserGuardian = true;
                activeMap.AutomationGuardian = true;
                break;
            case 'banking':
                activeMap.BrowserGuardian = true;
                activeMap.CredentialGuardian = true;
                activeMap.PrivacyGuardian = true;
                activeMap.ClipboardGuardian = true;
                activeMap.AutomationGuardian = true;
                break;
            case 'meeting':
                activeMap.CallGuardian = true;
                activeMap.PrivacyGuardian = true;
                activeMap.EmergencyGuardian = true;
                break;
            case 'entertainment':
                activeMap.BrowserGuardian = true;
                activeMap.DeepfakeGuardian = true;
                break;
            case 'general':
            default:
                // In general mode, run standard system safety guardians
                activeMap.BrowserGuardian = true;
                activeMap.DownloadGuardian = true;
                activeMap.ClipboardGuardian = true;
                activeMap.CredentialGuardian = true;
                activeMap.AutomationGuardian = true;
                activeMap.EmergencyGuardian = true;
                break;
        }
        // Always keep EmergencyGuardian alive in most contexts just in case
        if (mode !== 'entertainment') {
            activeMap.EmergencyGuardian = true;
        }
        // Set states on all active guardians
        this.guardians.forEach((guardian, name) => {
            const state = activeMap[name] !== undefined ? activeMap[name] : true;
            guardian.setActive(state);
        });
    }
    getCurrentMode() {
        return this.currentMode;
    }
}
exports.ContextEngine = ContextEngine;
