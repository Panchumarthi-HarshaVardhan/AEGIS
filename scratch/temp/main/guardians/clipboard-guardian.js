"use strict";
// ============================================================
// JARVIS V3 — Clipboard Guardian
// Watches clipboard content for credentials and password exposures
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClipboardGuardian = void 0;
const base_guardian_1 = require("./base-guardian");
class ClipboardGuardian extends base_guardian_1.BaseGuardian {
    scanner;
    constructor(scanner) {
        super('ClipboardGuardian');
        this.scanner = scanner;
    }
    initialize() {
        // Subscribe to clipboard updates
        this.eventBus.subscribe('clipboard:changed', (text) => {
            if (!this.active)
                return;
            try {
                const detected = this.scanner.scan(text);
                if (detected.length > 0) {
                    const primarySecret = detected[0];
                    const score = primarySecret.type.includes('API') || primarySecret.type.includes('Key') ? 85 : 60;
                    this.reportThreat(score, `EXPOSURE PREVENTED: Copied text contains secret credentials (${primarySecret.type}). Masked: ${primarySecret.masked_value}`, {
                        secrets: detected,
                        text_length: text.length
                    });
                }
            }
            catch (err) {
                this.logError('Error scanning clipboard text:', err);
            }
        });
    }
}
exports.ClipboardGuardian = ClipboardGuardian;
