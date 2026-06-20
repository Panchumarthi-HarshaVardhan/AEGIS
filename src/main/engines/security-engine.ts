// ============================================================
// JARVIS Guardian AI — Security Engine
// Central security gateway for all actions
// ============================================================

import type { SecretScanner } from '../security/secret-scanner'
import type { RiskClassifier, RiskClassification } from '../security/risk-classifier'
import type { PhishingDetector } from '../security/phishing-detector'
import type { ParsedIntent, SecurityVerdict, DetectedSecret, RiskLevel } from '../../shared/types'

/**
 * Patterns commonly used in prompt injection attacks.
 * Each entry is a regex and a human-readable description.
 */
const PROMPT_INJECTION_PATTERNS: ReadonlyArray<{ regex: RegExp; description: string }> = [
  {
    regex: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/i,
    description: 'Attempt to override system instructions'
  },
  {
    regex: /system\s*:\s*(override|reset|change|modify|update|ignore)/i,
    description: 'Fake system command injection'
  },
  {
    regex: /\bdo\s+not\s+follow\s+(your|the|any)\s+(instructions?|rules?|guidelines?)/i,
    description: 'Instruction suppression attempt'
  },
  {
    regex: /you\s+are\s+now\s+(a|an|the)\s+/i,
    description: 'Role reassignment attempt'
  },
  {
    regex: /\bnew\s+(instructions?|rules?|role|persona)\s*:/i,
    description: 'New instruction injection'
  },
  {
    regex: /forget\s+(everything|all|your)\s+(you|instructions?|rules?|know)/i,
    description: 'Memory wipe attempt'
  },
  {
    regex: /\bact\s+as\s+(if\s+)?(you\s+)?(are|were)\s+/i,
    description: 'Persona override attempt'
  },
  {
    regex: /\bpretend\s+(that\s+)?(you\s+)?(are|have|can)/i,
    description: 'Pretense-based injection attempt'
  },
  {
    regex: /\bjailbreak/i,
    description: 'Explicit jailbreak keyword'
  },
  {
    regex: /\bDAN\b.*\b(mode|prompt|do anything)/i,
    description: '"Do Anything Now" jailbreak pattern'
  },
  {
    regex: /\[system\]|\[admin\]|\[root\]|\[sudo\]/i,
    description: 'Fake privilege escalation tags'
  },
  {
    regex: /reveal\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?)/i,
    description: 'System prompt extraction attempt'
  }
]

/**
 * Central security gateway for JARVIS Guardian AI.
 *
 * Evaluates every user intent through multiple security layers before
 * allowing execution. Combines prompt injection detection, secret scanning,
 * risk classification, and phishing analysis into a unified SecurityVerdict.
 *
 * @example
 * ```ts
 * const security = new SecurityEngine(secretScanner, riskClassifier, phishingDetector)
 * const verdict = await security.evaluate(parsedIntent, rawUserInput)
 * if (!verdict.approved) {
 *   console.warn('Blocked:', verdict.reason)
 * }
 * ```
 */
export class SecurityEngine {
  private readonly secretScanner: SecretScanner
  private readonly riskClassifier: RiskClassifier
  private readonly phishingDetector: PhishingDetector

  /**
   * Creates a new SecurityEngine instance.
   *
   * @param secretScanner - Scanner for detecting secrets in text
   * @param riskClassifier - Classifier for determining intent risk levels
   * @param phishingDetector - Detector for analyzing URL phishing risk
   */
  constructor(
    secretScanner: SecretScanner,
    riskClassifier: RiskClassifier,
    phishingDetector: PhishingDetector
  ) {
    this.secretScanner = secretScanner
    this.riskClassifier = riskClassifier
    this.phishingDetector = phishingDetector
  }

  /**
   * Evaluates a parsed intent and raw input through all security layers.
   *
   * The evaluation pipeline:
   * 1. **Prompt Injection Detection** — blocks manipulative inputs immediately
   * 2. **Secret Scanning** — detects embedded credentials/PII in raw input
   * 3. **Risk Classification** — determines action risk level and approval needs
   * 4. **Phishing Analysis** — checks any URLs in the intent for phishing indicators
   *
   * @param intent - The parsed intent from the IntentEngine
   * @param rawInput - The raw, unprocessed user input string
   * @returns Security verdict with approval status, risk level, and details
   */
  async evaluate(intent: ParsedIntent, rawInput: string): Promise<SecurityVerdict> {
    // Layer 1: Prompt Injection Detection
    const injectionResult = this.detectPromptInjection(rawInput)
    if (injectionResult) {
      return {
        approved: false,
        risk_level: 3,
        requires_approval: false,
        reason: `Prompt injection detected: ${injectionResult}`,
        blocked_secrets: []
      }
    }

    // Layer 2: Secret Scanning
    const detectedSecrets = this.secretScanner.scan(rawInput)
    if (detectedSecrets.length > 0) {
      const criticalSecrets = detectedSecrets.filter(
        (s) => s.pattern === 'critical'
      )

      if (criticalSecrets.length > 0) {
        return {
          approved: false,
          risk_level: 3,
          requires_approval: false,
          reason: `Critical secrets detected in input: ${criticalSecrets.map((s) => s.type).join(', ')}`,
          blocked_secrets: detectedSecrets
        }
      }

      // Non-critical secrets: allow but flag and require approval
      const riskClassification = this.riskClassifier.classify(intent)
      const effectiveRisk = Math.max(riskClassification.level, 2) as RiskLevel

      return {
        approved: false,
        risk_level: effectiveRisk,
        requires_approval: true,
        reason: `Sensitive data detected in input: ${detectedSecrets.map((s) => s.type).join(', ')}. User approval required.`,
        blocked_secrets: detectedSecrets
      }
    }

    // Layer 3: Risk Classification
    const riskClassification = this.riskClassifier.classify(intent)

    // Layer 4: Phishing Analysis (if URL present)
    const phishingResult = await this.analyzeUrlIfPresent(intent)

    // Combine risk from classification and phishing analysis
    let finalRiskLevel = riskClassification.level
    let finalRequiresApproval = riskClassification.requires_approval
    let finalReason = riskClassification.reason

    if (phishingResult) {
      if (phishingResult.verdict === 'DANGEROUS') {
        return {
          approved: false,
          risk_level: 3,
          requires_approval: false,
          reason: `Phishing threat detected: URL "${phishingResult.url}" scored ${phishingResult.risk_score}/100`,
          phishing_result: phishingResult
        }
      }

      if (phishingResult.verdict === 'SUSPICIOUS') {
        finalRiskLevel = Math.max(finalRiskLevel, 2) as RiskLevel
        finalRequiresApproval = true
        finalReason = `${finalReason}. URL flagged as suspicious (score: ${phishingResult.risk_score}/100).`
      }
    }

    // Determine final approval
    const approved = finalRiskLevel === 0 && !finalRequiresApproval

    return {
      approved,
      risk_level: finalRiskLevel,
      requires_approval: finalRequiresApproval,
      reason: finalReason,
      blocked_secrets: [],
      phishing_result: phishingResult ?? undefined
    }
  }

  /**
   * Detects prompt injection patterns in raw user input.
   *
   * @param input - The raw user input string
   * @returns Description of the detected injection pattern, or null if clean
   */
  private detectPromptInjection(input: string): string | null {
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.regex.test(input)) {
        return pattern.description
      }
    }
    return null
  }

  /**
   * Runs phishing analysis if the intent contains a URL entity.
   *
   * @param intent - The parsed intent to check for URLs
   * @returns PhishingAnalysis if a URL was found and analyzed, null otherwise
   */
  private async analyzeUrlIfPresent(intent: ParsedIntent) {
    const url = intent.entities.url
    if (!url) return null

    try {
      return await this.phishingDetector.analyze(url)
    } catch (error) {
      console.error('SecurityEngine: Phishing analysis failed:', error)
      return null
    }
  }
}
