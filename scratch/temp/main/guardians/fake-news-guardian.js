"use strict";
// ============================================================
// JARVIS V3 — Fake News Guardian
// Extracts claims from text feeds and validates them against source indexes
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.FakeNewsGuardian = void 0;
const base_guardian_1 = require("./base-guardian");
class FakeNewsGuardian extends base_guardian_1.BaseGuardian {
    constructor() {
        super('FakeNewsGuardian');
    }
    initialize() {
        // Listens for claim text audits
        this.eventBus.subscribe('clipboard:changed', async (text) => {
            if (!this.active)
                return;
            // Only audit longer blocks of text that look like articles or news claims (e.g. >120 chars)
            if (text.length < 120 || text.split(' ').length < 15)
                return;
            try {
                const result = await this.scanFakeNews(text);
                if (result.verdict === 'FALSE' || result.verdict === 'MISLEADING') {
                    const score = result.risk_score || 75;
                    this.reportThreat(score, `MISINFORMATION WARNING: Copied text contains verified false claims. Summary: ${result.summary}`, {
                        verdict: result.verdict,
                        summary: result.summary,
                        claims: result.claims
                    });
                }
            }
            catch (err) {
                this.logWarn('Scan failed:', err);
            }
        });
    }
    async scanFakeNews(text) {
        const response = await fetch('http://127.0.0.1:8000/api/fake-news', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);
        return response.json();
    }
}
exports.FakeNewsGuardian = FakeNewsGuardian;
