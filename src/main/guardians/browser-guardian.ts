// ============================================================
// JARVIS V3 — Browser Guardian
// Listens to browser:navigation events and analyzes domains for phishing
// ============================================================

import { BaseGuardian } from './base-guardian'
import { PhishingDetector } from '../security/phishing-detector'

export class BrowserGuardian extends BaseGuardian {
  private detector: PhishingDetector

  constructor(detector: PhishingDetector) {
    super('BrowserGuardian')
    this.detector = detector
  }

  protected initialize(): void {
    // Subscribe to browser navigation events
    this.eventBus.subscribe('browser:navigation', async (url: string) => {
      if (!this.active) return
      
      try {
        const analysis = await this.detector.analyze(url)
        
        if (analysis.verdict === 'DANGEROUS' || analysis.verdict === 'SUSPICIOUS') {
          const score = analysis.risk_score
          const primarySignal = analysis.signals[0]?.description || 'Suspicious URL pattern'
          
          this.reportThreat(score, `WARNING: Phishing domain detected. URL: "${url}". Reason: ${primarySignal}`, {
            url,
            verdict: analysis.verdict,
            risk_score: score,
            signals: analysis.signals
          })
        }
      } catch (err) {
        this.logError('Error analyzing URL:', err)
      }
    })
  }
}
