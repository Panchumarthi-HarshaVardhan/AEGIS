// ============================================================
// JARVIS V3 — Fake News Guardian
// Extracts claims from text feeds and validates them against source indexes
// ============================================================

import { BaseGuardian } from './base-guardian'

export class FakeNewsGuardian extends BaseGuardian {
  constructor() {
    super('FakeNewsGuardian')
  }

  protected initialize(): void {
    // Listens for claim text audits
    this.eventBus.subscribe('clipboard:changed', async (text: string) => {
      if (!this.active) return
      
      // Only audit longer blocks of text that look like articles or news claims (e.g. >120 chars)
      if (text.length < 120 || text.split(' ').length < 15) return
      
      try {
        const result = await this.scanFakeNews(text)
        if (result.verdict === 'FALSE' || result.verdict === 'MISLEADING') {
          const score = result.risk_score || 75
          this.reportThreat(score, `MISINFORMATION WARNING: Copied text contains verified false claims. Summary: ${result.summary}`, {
            verdict: result.verdict,
            summary: result.summary,
            claims: result.claims
          })
        }
      } catch (err) {
        this.logWarn('Scan failed:', err)
      }
    })
  }

  private async scanFakeNews(text: string): Promise<any> {
    const response = await fetch('http://127.0.0.1:8000/api/fake-news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }
}
