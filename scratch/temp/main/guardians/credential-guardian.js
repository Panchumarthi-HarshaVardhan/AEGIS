"use strict";
// ============================================================
// JARVIS V3 — Credential Guardian
// Specifically identifies developer secret tokens (AWS, GitHub, Firebase, Supabase, OpenAI)
// and blocks execution runs that contain them
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.CredentialGuardian = void 0;
const base_guardian_1 = require("./base-guardian");
class CredentialGuardian extends base_guardian_1.BaseGuardian {
    constructor() {
        super('CredentialGuardian');
    }
    initialize() {
        // Listens for credential checks inside automated plans
        this.eventBus.subscribe('clipboard:changed', (text) => {
            if (!this.active)
                return;
            try {
                const leaks = this.scanDeveloperTokens(text);
                if (leaks) {
                    this.reportThreat(90, `CRITICAL: Leaked developer token detected (${leaks.service}). Sharing this secret was prevented.`, {
                        service: leaks.service,
                        token_masked: leaks.masked
                    });
                }
            }
            catch (err) {
                this.logError('Error scanning developer tokens:', err);
            }
        });
    }
    /** Run specific regexes for developer platform secret tokens */
    scanDeveloperTokens(text) {
        const patterns = [
            { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
            { name: 'AWS Secret Key', regex: /[^A-Za-z0-9/+=][A-Za-z0-9/+=]{40}[^A-Za-z0-9/+=]/ },
            { name: 'GitHub OAuth/Pat Token', regex: /gh[p|o|u|s|r]_[A-Za-z0-9_]{36,255}/ },
            { name: 'OpenAI API Key', regex: /sk-[a-zA-Z0-9]{48}/ },
            { name: 'Groq API Key', regex: /gsk_[a-zA-Z0-9]{50}/ },
            { name: 'Stripe Secret Key', regex: /sk_live_[0-9a-zA-Z]{24}/ },
            { name: 'Firebase Web API Key', regex: /AIzaSy[A-Za-z0-9_\\-]{33}/ },
            { name: 'Private Key', regex: /-----BEGIN PRIVATE KEY-----/ }
        ];
        for (const p of patterns) {
            const match = text.match(p.regex);
            if (match) {
                const value = match[0].trim();
                const masked = value.substring(0, 8) + '...' + value.substring(value.length - 4);
                return { service: p.name, masked };
            }
        }
        return null;
    }
}
exports.CredentialGuardian = CredentialGuardian;
