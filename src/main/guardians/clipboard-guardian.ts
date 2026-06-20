// ============================================================
// JARVIS V3 — Clipboard Guardian
// Watches clipboard content for credentials and password exposures
// ============================================================

import { BaseGuardian } from './base-guardian'
import { SecretScanner } from '../security/secret-scanner'

export class ClipboardGuardian extends BaseGuardian {
  private scanner: SecretScanner

  constructor(scanner: SecretScanner) {
    super('ClipboardGuardian')
    this.scanner = scanner
  }

  protected initialize(): void {
    // Subscribe to clipboard updates
    this.eventBus.subscribe('clipboard:changed', (text: string) => {
      if (!this.active) return

      try {
        const detected = this.scanner.scan(text)
        if (detected.length > 0) {
          const primarySecret = detected[0]
          const score = primarySecret.type.includes('API') || primarySecret.type.includes('Key') ? 85 : 60
          
          this.reportThreat(score, `EXPOSURE PREVENTED: Copied text contains secret credentials (${primarySecret.type}). Masked: ${primarySecret.masked_value}`, {
            secrets: detected,
            text_length: text.length
          })
        }
      } catch (err) {
        this.logError('Error scanning clipboard text:', err)
      }
    })
  }
}
