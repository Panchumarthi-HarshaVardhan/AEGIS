"use strict";
// ============================================================
// JARVIS V3 — Automation Guardian
// Intercepts all desktop automation steps and enforces user confirmations
// based on action safety levels (Safe, Confirm, Always Blocked)
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationGuardian = void 0;
const base_guardian_1 = require("./base-guardian");
class AutomationGuardian extends base_guardian_1.BaseGuardian {
    constructor() {
        super('AutomationGuardian');
    }
    initialize() { }
    /** Inspect a plan step and return security verdict */
    evaluateStep(step) {
        try {
            if (!this.active) {
                return { approved: true, requires_approval: false, risk_level: 0, reason: '' };
            }
            const action = step.action.toLowerCase();
            const params = JSON.stringify(step.params || {}).toLowerCase();
            // 1. Level 3: Critical (Strictly require confirmation / payments & banking)
            if (action.includes('payment') ||
                action.includes('bank') ||
                action.includes('transfer') ||
                params.includes('credit card') ||
                params.includes('cvv') ||
                params.includes('pin') ||
                params.includes('otp') ||
                params.includes('password')) {
                this.reportThreat(90, `BLOCKED AUTOMATION: Unauthorized banking or sensitive credential action detected: ${step.action}`, { step });
                return {
                    approved: false,
                    requires_approval: true,
                    risk_level: 3,
                    reason: 'Sensitive banking, payment, or OTP access is always blocked from automatic execution.'
                };
            }
            // 2. Level 2 & 1: Requires Approval (file deletes, installs, email sending)
            if (action.includes('delete') ||
                action.includes('remove') ||
                action.includes('uninstall') ||
                action.includes('email') ||
                action.includes('mail') ||
                action.includes('send') ||
                action.includes('install')) {
                this.reportThreat(45, `APPROVAL REQUIRED: Automation requested critical action: ${step.action}`, { step });
                return {
                    approved: true,
                    requires_approval: true,
                    risk_level: 2,
                    reason: `Automation requires approval to modify system software or send communications.`
                };
            }
            // 3. Level 0: Safe (open app, search, play music)
            return {
                approved: true,
                requires_approval: false,
                risk_level: 0,
                reason: ''
            };
        }
        catch (err) {
            this.logError('Error evaluating step safety, failing secure (requiring approval):', err);
            return {
                approved: false,
                requires_approval: true,
                risk_level: 3,
                reason: 'Error evaluating step safety. Security engine failed secure.'
            };
        }
    }
}
exports.AutomationGuardian = AutomationGuardian;
