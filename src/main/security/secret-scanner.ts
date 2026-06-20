// ============================================================
// JARVIS Guardian AI — Secret Scanner
// Regex-based detection of secrets, credentials, and PII
// ============================================================

import type { DetectedSecret } from '../../shared/types'

/** Severity level for detected secrets */
type SecretSeverity = 'low' | 'medium' | 'high' | 'critical'

/** Pattern definition for a scannable secret type */
interface SecretPattern {
  /** Human-readable name of the secret type */
  name: string
  /** Regular expression to match the secret */
  regex: RegExp
  /** Risk severity if this secret is exposed */
  severity: SecretSeverity
}

/** Entropy threshold for high-entropy string detection */
const ENTROPY_THRESHOLD = 4.5
/** Minimum string length for entropy analysis */
const ENTROPY_MIN_LENGTH = 20

/** All secret patterns to scan for */
const SECRET_PATTERNS: ReadonlyArray<SecretPattern> = [
  // --- API Keys & Tokens ---
  {
    name: 'OpenAI API Key',
    regex: /sk-[A-Za-z0-9]{20,}/g,
    severity: 'critical'
  },
  {
    name: 'Groq API Key',
    regex: /gsk_[A-Za-z0-9]{20,}/g,
    severity: 'critical'
  },
  {
    name: 'AWS Access Key',
    regex: /AKIA[0-9A-Z]{16}/g,
    severity: 'critical'
  },
  {
    name: 'GitHub Personal Access Token',
    regex: /ghp_[A-Za-z0-9]{36,}/g,
    severity: 'critical'
  },
  {
    name: 'GitHub OAuth Token',
    regex: /gho_[A-Za-z0-9]{36,}/g,
    severity: 'critical'
  },
  {
    name: 'GitHub App Token',
    regex: /ghs_[A-Za-z0-9]{36,}/g,
    severity: 'critical'
  },
  {
    name: 'GitHub Fine-Grained PAT',
    regex: /github_pat_[A-Za-z0-9_]{30,}/g,
    severity: 'critical'
  },
  {
    name: 'Generic API Key',
    regex: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?([A-Za-z0-9\-_]{20,})['"]?/gi,
    severity: 'high'
  },

  // --- Passwords ---
  {
    name: 'Password in Assignment',
    regex: /(?:password|passwd|pwd)\s*[:=]\s*['"]?([^\s'"]{6,})['"]?/gi,
    severity: 'high'
  },
  {
    name: 'Password in URL',
    regex: /:\/\/[^:]+:([^@]{6,})@/g,
    severity: 'critical'
  },

  // --- OTP Codes ---
  {
    name: 'OTP Code',
    regex: /\b(?:otp|code|verification|verify)\s*[:=]?\s*(\d{6})\b/gi,
    severity: 'medium'
  },

  // --- Financial / PII ---
  {
    name: 'Credit Card Number',
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    severity: 'critical'
  },
  {
    name: 'SSN (US Social Security Number)',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    severity: 'critical'
  }
]

/**
 * Scans text for embedded secrets, credentials, and sensitive data.
 *
 * Combines pattern-based detection (regex) with Shannon entropy analysis
 * to find API keys, tokens, passwords, credit cards, SSNs, and other
 * sensitive values that should never be transmitted or logged.
 *
 * @example
 * ```ts
 * const scanner = new SecretScanner()
 * const secrets = scanner.scan('My API key is sk-abc123def456ghi789jkl0')
 * // secrets[0].type === 'OpenAI API Key'
 * // secrets[0].masked_value === 'sk-a...l0'
 * ```
 */
export class SecretScanner {
  /**
   * Scans the given text for secrets and sensitive data.
   *
   * Runs all regex patterns and Shannon entropy analysis against the input.
   * Detected secrets are returned with masked values and position information.
   *
   * @param text - The text to scan for secrets
   * @returns Array of detected secrets with type, masked value, and position
   */
  scan(text: string): DetectedSecret[] {
    if (!text || text.length === 0) {
      return []
    }

    const detectedSecrets: DetectedSecret[] = []
    const seenPositions = new Set<string>()

    // Phase 1: Pattern-based detection
    for (const pattern of SECRET_PATTERNS) {
      // Reset regex lastIndex for global patterns
      pattern.regex.lastIndex = 0

      let match: RegExpExecArray | null
      while ((match = pattern.regex.exec(text)) !== null) {
        // Use the captured group if present, otherwise the full match
        const matchedValue = match[1] ?? match[0]
        const startPos = match[1]
          ? match.index + match[0].indexOf(match[1])
          : match.index
        const endPos = startPos + matchedValue.length

        const posKey = `${startPos}:${endPos}`
        if (seenPositions.has(posKey)) continue
        seenPositions.add(posKey)

        detectedSecrets.push({
          type: pattern.name,
          pattern: pattern.severity,
          masked_value: this.maskValue(matchedValue),
          position: { start: startPos, end: endPos }
        })
      }
    }

    // Phase 2: High-entropy string detection
    const entropySecrets = this.scanHighEntropyStrings(text, seenPositions)
    detectedSecrets.push(...entropySecrets)

    return detectedSecrets
  }

  /**
   * Finds high-entropy strings that may be secrets not caught by patterns.
   *
   * Splits the text into tokens and checks each for Shannon entropy above
   * the threshold. Only considers tokens longer than ENTROPY_MIN_LENGTH chars
   * that look like they could be keys/tokens (alphanumeric with special chars).
   *
   * @param text - The full text to analyze
   * @param seenPositions - Set of already-detected positions to skip
   * @returns Array of entropy-detected secrets
   */
  private scanHighEntropyStrings(
    text: string,
    seenPositions: Set<string>
  ): DetectedSecret[] {
    const results: DetectedSecret[] = []

    // Match potential token/key-like strings (alphanumeric with dashes/underscores)
    const tokenRegex = /[A-Za-z0-9\-_+/=]{20,}/g
    let match: RegExpExecArray | null

    while ((match = tokenRegex.exec(text)) !== null) {
      const token = match[0]
      const start = match.index
      const end = start + token.length
      const posKey = `${start}:${end}`

      // Skip if already detected by pattern matching
      if (seenPositions.has(posKey)) continue

      // Only analyze strings meeting the minimum length requirement
      if (token.length < ENTROPY_MIN_LENGTH) continue

      const entropy = this.calculateShannonEntropy(token)
      if (entropy > ENTROPY_THRESHOLD) {
        seenPositions.add(posKey)
        results.push({
          type: 'High-Entropy String (Potential Secret)',
          pattern: 'high',
          masked_value: this.maskValue(token),
          position: { start, end }
        })
      }
    }

    return results
  }

  /**
   * Calculates the Shannon entropy of a string.
   *
   * Higher entropy indicates more randomness, which is characteristic
   * of cryptographic keys, tokens, and passwords.
   *
   * @param str - The string to calculate entropy for
   * @returns Shannon entropy value (bits per character)
   */
  private calculateShannonEntropy(str: string): number {
    if (str.length === 0) return 0

    const freq = new Map<string, number>()
    for (const char of str) {
      freq.set(char, (freq.get(char) ?? 0) + 1)
    }

    let entropy = 0
    const len = str.length

    for (const count of freq.values()) {
      const p = count / len
      if (p > 0) {
        entropy -= p * Math.log2(p)
      }
    }

    return entropy
  }

  /**
   * Masks a sensitive value, showing only the first 4 and last 2 characters.
   *
   * @param value - The secret value to mask
   * @returns Masked string (e.g., "sk-a...l0")
   */
  private maskValue(value: string): string {
    if (value.length <= 6) {
      return '*'.repeat(value.length)
    }

    const prefix = value.slice(0, 4)
    const suffix = value.slice(-2)
    return `${prefix}...${suffix}`
  }
}
