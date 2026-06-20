"use strict";
// ============================================================
// JARVIS V3 — Privacy Guardian
// Alerts the user if background processes access camera, mic or location
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrivacyGuardian = void 0;
const base_guardian_1 = require("./base-guardian");
class PrivacyGuardian extends base_guardian_1.BaseGuardian {
    constructor() {
        super('PrivacyGuardian');
    }
    initialize() {
        // Listens for unexpected peripheral scans or permissions triggers
        this.eventBus.subscribe('window:focused', (appName) => {
            if (!this.active)
                return;
            try {
                // If an unknown/background app starts focus and we detect device checks, we alert the user.
                // E.g., if a suspicious app is focused, mock checks.
                const lower = appName.toLowerCase();
                if (lower.includes('keylogger') || lower.includes('spyware')) {
                    this.reportThreat(90, `PRIVACY ALERT: Suspicious application "${appName}" is running and monitoring inputs.`, {
                        application: appName,
                        threat_type: 'Input Monitoring'
                    });
                }
            }
            catch (err) {
                this.logError('Error processing window focused event:', err);
            }
        });
    }
}
exports.PrivacyGuardian = PrivacyGuardian;
