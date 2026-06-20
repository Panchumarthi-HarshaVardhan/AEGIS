// ============================================================
// JARVIS V3 — Call Guardian
// Analyzes call transcript dialogue in real-time using Groq Llama 3
// to flag bank impersonation, OTP theft, and support scams
// ============================================================

import { BaseGuardian } from './base-guardian'
import type Groq from 'groq-sdk'
import { ProviderManager } from '../provider-manager'

export interface ScamVerdict {
  scam_detected: boolean
  confidence: number // 0-100
  scam_type: string
  reason: string
}

export class CallGuardian extends BaseGuardian {
  private groq: Groq | null = null

  constructor() {
    super('CallGuardian')
  }

  protected initialize(): void {
    // Listens for active call transcript updates
    this.eventBus.subscribe('call:transcript', async (text: string) => {
      if (!this.active) return

      try {
        const verdict = await this.evaluateTranscript(text)
        if (verdict.scam_detected && verdict.confidence >= 50) {
          this.reportThreat(verdict.confidence, `🚨 Possible Scam Detected: "${verdict.scam_type}". Reason: ${verdict.reason}`, {
            scam_type: verdict.scam_type,
            reason: verdict.reason,
            confidence: verdict.confidence
          })
        }
      } catch (err) {
        this.logError('Transcript scan error:', err)
      }
    })
  }

  /** Send conversation dialog to active LLM to classify scam status, or fallback to regex */
  private async evaluateTranscript(text: string): Promise<ScamVerdict> {
    const providerManager = ProviderManager.getInstance()
    const status = providerManager.getStatus()

    if (status.activeProvider === 'none') {
      return this.runRegexFallback(text)
    }

    const prompt = `Analyze this dialogue transcript of a voice/video call between a user and a caller. Determine if the caller is trying to perform a scam, coercion, or fraud (e.g. Bank Impersonation, OTP/Verification code requests, Tech Support scam, Investment/Crypto fraud, Gift Card demands, Remote Access Software install requests, Romance/Extortion attempts, Kidnapping scams, Money Mule setups).

Dialogue transcript:
"${text}"

Respond STRICTLY in JSON format with these exact fields:
{
  "scam_detected": boolean,
  "confidence": number (an integer from 0 to 100),
  "scam_type": "string (name of the detected scam, or empty if none)",
  "reason": "string (short 1-sentence explanation of why it is flagged, or empty if none)"
}`

    try {
      if (status.activeProvider === 'groq') {
        if (!this.groq) {
          const apiKey = process.env.GROQ_API_KEY || ''
          const GroqSdk = require('groq-sdk')
          this.groq = new GroqSdk({ apiKey }) as Groq
        }
        const response = await this.groq!.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'You are a cybersecurity scanner that identifies phone scam dialogues. Be objective. Always classify threats as Possible, Likely, or High Confidence, never absolute.' },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1
        })

        const content = response.choices[0]?.message?.content || '{}'
        return JSON.parse(content) as ScamVerdict
      } else if (status.activeProvider === 'ollama') {
        const response = await fetch('http://127.0.0.1:11434/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: status.models.completion,
            messages: [
              { role: 'system', content: 'You are a cybersecurity scanner that identifies phone scam dialogues. Be objective. Always classify threats as Possible, Likely, or High Confidence, never absolute.' },
              { role: 'user', content: prompt }
            ],
            stream: false,
            options: {
              temperature: 0.1
            },
            format: 'json'
          }),
          signal: AbortSignal.timeout(30000)
        })

        if (!response.ok) {
          throw new Error(`Ollama responded with status: ${response.status}`)
        }

        const data = (await response.json()) as { message?: { content?: string } }
        const content = data.message?.content || '{}'
        return JSON.parse(content) as ScamVerdict
      }
    } catch (err) {
      this.logWarn('LLM scan failed, falling back to regex:', err)
      return this.runRegexFallback(text)
    }

    return { scam_detected: false, confidence: 0, scam_type: '', reason: '' }
  }

  /** Rule-based regex fallback for offline operation */
  private runRegexFallback(text: string): ScamVerdict {
    const lower = text.toLowerCase()
    const hasOTP = lower.includes('otp') || lower.includes('verification code') || lower.includes('code sent')
    const hasBank = lower.includes('bank') || lower.includes('chase') || lower.includes('support') || lower.includes('security department')
    const hasCard = lower.includes('gift card') || lower.includes('anydesk') || lower.includes('teamviewer')
    
    if (hasOTP && (hasBank || hasCard)) {
      return {
        scam_detected: true,
        confidence: 85,
        scam_type: hasOTP ? 'Credential/OTP Theft' : 'Tech Support / Remote Access Scam',
        reason: 'Dialogue contains request for OTP/verification code alongside banking/support keywords.'
      }
    }
    return { scam_detected: false, confidence: 0, scam_type: '', reason: '' }
  }
}
