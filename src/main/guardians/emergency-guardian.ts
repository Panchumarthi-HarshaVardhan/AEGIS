// ============================================================
// JARVIS V3 — Emergency Guardian
// Monitors conversations/clipboard for extortion, kidnapping threats, and violence,
// automatically activating the secure Emergency Mode Overlay when detected
// ============================================================

import { BaseGuardian } from './base-guardian'

export class EmergencyGuardian extends BaseGuardian {
  constructor() {
    super('EmergencyGuardian')
  }

  protected initialize(): void {
    // Audit clipboard and call transcripts
    this.eventBus.subscribe('clipboard:changed', (text: string) => {
      try {
        this.auditText(text)
      } catch (err) {
        this.logError('Error auditing clipboard text for emergency indicators:', err)
      }
    })

    this.eventBus.subscribe('call:transcript', (text: string) => {
      try {
        this.auditText(text)
      } catch (err) {
        this.logError('Error auditing call transcript for emergency indicators:', err)
      }
    })
  }

  private auditText(text: string): void {
    if (!this.active) return

    const lower = text.toLowerCase()
    
    // Extortion, kidnapping, and blackmail keywords
    const indicators = [
      lower.includes('kidnap') || lower.includes('have your daughter') || lower.includes('have your son'),
      lower.includes('blackmail') || lower.includes('publish your photos') || lower.includes('post your video'),
      lower.includes('transfer bitcoin') || lower.includes('ransom') || lower.includes('or else i will send'),
      lower.includes('hurt you') || lower.includes('know where you live') || lower.includes('kill you')
    ]

    const matchCount = indicators.filter(Boolean).length

    if (matchCount >= 2) {
      // 1. Report threat
      this.reportThreat(98, `🚨 CRITICAL EMERGENCY THREAT DETECTED: Extortion or kidnapping language identified in activity context.`, {
        context_preview: text.substring(0, 100) + '...',
        match_count: matchCount
      })

      // 2. Publish emergency trigger event
      this.eventBus.publish('emergency:triggered', 'Extortion/Blackmail Language Detected', text)
    }
  }
}
