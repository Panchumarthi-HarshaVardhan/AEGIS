"use strict";
// ============================================================
// JARVIS V3 — Risk Engine
// Compiles individual threat scores, calculates overall risk levels,
// and manages warning notifications to minimize user disturbance
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskEngine = void 0;
const event_bus_1 = require("./event-bus");
class RiskEngine {
    eventBus;
    memoryEngine;
    alertCallback = null;
    threatScores = new Map();
    maxScore = 0;
    decayTimeouts = new Map();
    constructor(memoryEngine) {
        this.eventBus = event_bus_1.EventBus.getInstance();
        this.memoryEngine = memoryEngine;
        this.initialize();
    }
    initialize() {
        // Listen for threat alerts from active guardians
        this.eventBus.subscribe('threat:detected', (report) => {
            this.threatScores.set(report.guardian, report.score);
            this.recalculateRisk();
            // Handle threat decay: set a 15-second timeout to clear the threat
            const existingTimeout = this.decayTimeouts.get(report.guardian);
            if (existingTimeout) {
                clearTimeout(existingTimeout);
            }
            const timeout = setTimeout(() => {
                this.clearThreat(report.guardian);
            }, 15000);
            this.decayTimeouts.set(report.guardian, timeout);
            // 1. Log threat as security event in DB
            const secEvent = {
                id: report.id,
                type: this.mapGuardianToEventType(report.guardian),
                severity: report.severity,
                description: report.description,
                timestamp: report.timestamp,
                details: report.details
            };
            this.memoryEngine.logSecurityEvent(secEvent);
            // 2. Determine if we should trigger a slide-in UI notification toast
            if (report.score >= 40 && this.alertCallback) {
                this.alertCallback(secEvent);
            }
        });
    }
    /** Register callback to push active warnings directly to the Electron overlay window */
    registerAlertCallback(callback) {
        this.alertCallback = callback;
    }
    /** Reset threat logs for a specific guardian */
    clearThreat(guardianName) {
        const timeout = this.decayTimeouts.get(guardianName);
        if (timeout) {
            clearTimeout(timeout);
            this.decayTimeouts.delete(guardianName);
        }
        this.threatScores.delete(guardianName);
        this.recalculateRisk();
    }
    /** Compute overall threat score based on highest current score */
    recalculateRisk() {
        let highest = 0;
        this.threatScores.forEach((score) => {
            if (score > highest)
                highest = score;
        });
        this.maxScore = highest;
        console.log(`[RiskEngine] Recalculated System Threat Level: ${this.maxScore}/100`);
    }
    getOverallRisk() {
        return this.maxScore;
    }
    mapGuardianToEventType(guardian) {
        switch (guardian) {
            case 'ClipboardGuardian':
            case 'CredentialGuardian':
                return 'secret_detected';
            case 'BrowserGuardian':
                return 'phishing_blocked';
            case 'EmergencyGuardian':
                return 'prompt_injection'; // fallback classification
            default:
                return 'action_blocked';
        }
    }
}
exports.RiskEngine = RiskEngine;
