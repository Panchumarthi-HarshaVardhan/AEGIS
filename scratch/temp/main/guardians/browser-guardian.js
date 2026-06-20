"use strict";
// ============================================================
// JARVIS V3 — Browser Guardian
// Listens to browser:navigation events and analyzes domains for phishing
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserGuardian = void 0;
const base_guardian_1 = require("./base-guardian");
class BrowserGuardian extends base_guardian_1.BaseGuardian {
    detector;
    constructor(detector) {
        super('BrowserGuardian');
        this.detector = detector;
    }
    initialize() {
        // Subscribe to browser navigation events
        this.eventBus.subscribe('browser:navigation', async (url) => {
            if (!this.active)
                return;
            try {
                const analysis = await this.detector.analyze(url);
                if (analysis.verdict === 'DANGEROUS' || analysis.verdict === 'SUSPICIOUS') {
                    const score = analysis.risk_score;
                    const primarySignal = analysis.signals[0]?.description || 'Suspicious URL pattern';
                    this.reportThreat(score, `WARNING: Phishing domain detected. URL: "${url}". Reason: ${primarySignal}`, {
                        url,
                        verdict: analysis.verdict,
                        risk_score: score,
                        signals: analysis.signals
                    });
                }
            }
            catch (err) {
                this.logError('Error analyzing URL:', err);
            }
        });
    }
}
exports.BrowserGuardian = BrowserGuardian;
