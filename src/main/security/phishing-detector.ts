// ============================================================
// JARVIS Guardian AI — Phishing Detector
// Multi-layer URL phishing analysis engine
// ============================================================

import type { PhishingAnalysis, PhishingSignal } from '../../shared/types'

/** Maximum composite risk score */
const MAX_SCORE = 100

/** Suspicious TLDs commonly used in phishing */
const SUSPICIOUS_TLDS: ReadonlySet<string> = new Set([
  '.xyz', '.top', '.club', '.work', '.click',
  '.buzz', '.gq', '.ml', '.tk', '.cf', '.ga'
])

/** Known URL shortener domains */
const URL_SHORTENERS: ReadonlySet<string> = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly',
  'is.gd', 'buff.ly', 'rb.gy', 'shorturl.at', 'tiny.cc'
])

/** Suspicious keywords in URL paths */
const SUSPICIOUS_PATH_KEYWORDS: ReadonlyArray<string> = [
  'login', 'signin', 'sign-in', 'verify', 'verification',
  'account', 'secure', 'update', 'confirm', 'banking',
  'password', 'credential', 'authenticate', 'wallet',
  'suspend', 'limited', 'unusual', 'alert', 'locked'
]

/** Brand names to check for impersonation, mapped to their official domains */
const OFFICIAL_DOMAINS: ReadonlyMap<string, ReadonlyArray<string>> = new Map([
  ['google', ['google.com', 'google.co.uk', 'google.co.in', 'googleapis.com', 'gstatic.com']],
  ['facebook', ['facebook.com', 'fb.com', 'fbcdn.net', 'meta.com']],
  ['amazon', ['amazon.com', 'amazon.co.uk', 'amazon.co.jp', 'amazonaws.com', 'aws.amazon.com']],
  ['apple', ['apple.com', 'icloud.com', 'appleid.apple.com']],
  ['microsoft', ['microsoft.com', 'live.com', 'outlook.com', 'office.com', 'azure.com']],
  ['paypal', ['paypal.com', 'paypal.me']],
  ['netflix', ['netflix.com']],
  ['instagram', ['instagram.com']],
  ['twitter', ['twitter.com', 'x.com', 't.co']],
  ['linkedin', ['linkedin.com']],
  ['chase', ['chase.com', 'jpmorgan.com']],
  ['wellsfargo', ['wellsfargo.com', 'wf.com']],
  ['citibank', ['citibank.com', 'citi.com', 'citigroup.com']]
])

/**
 * Multi-layer phishing detection engine.
 *
 * Analyzes URLs across six independent detection layers to produce a
 * composite risk score and verdict. Each layer contributes weighted
 * signals that are summed and capped at 100.
 *
 * **Layers:**
 * 1. URL Pattern Analysis — structural anomalies
 * 2. Brand Impersonation — Levenshtein distance from known brands
 * 3. TLD Risk — suspicious top-level domains
 * 4. Homograph/Punycode — internationalized domain abuse
 * 5. URL Shortener — link obfuscation
 * 6. HTTPS Check — missing encryption
 *
 * @example
 * ```ts
 * const detector = new PhishingDetector()
 * const result = await detector.analyze('http://g00gle.xyz/login')
 * console.log(result.verdict) // 'DANGEROUS'
 * console.log(result.risk_score) // 85
 * ```
 */
export class PhishingDetector {
  private cache = new Map<string, PhishingAnalysis>()
  private readonly maxCacheSize = 500

  /**
   * Performs multi-layer phishing analysis on a URL.
   *
   * @param url - The URL to analyze
   * @returns Phishing analysis with risk score, verdict, and signal details
   */
  async analyze(url: string): Promise<PhishingAnalysis> {
    if (this.cache.has(url)) {
      return this.cache.get(url)!
    }

    const result = await this.performAnalysis(url)

    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) this.cache.delete(firstKey)
    }
    this.cache.set(url, result)

    return result
  }

  private async performAnalysis(url: string): Promise<PhishingAnalysis> {
    const signals: PhishingSignal[] = []

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`)
    } catch {
      return {
        url,
        risk_score: 50,
        verdict: 'SUSPICIOUS',
        signals: [{
          type: 'invalid_url',
          description: 'URL could not be parsed — may be malformed',
          severity: 'medium',
          score: 20
        }]
      }
    }

    // Layer 1: URL Pattern Analysis
    signals.push(...this.analyzeUrlPatterns(parsedUrl, url))

    // Layer 2: Brand Impersonation
    signals.push(...this.analyzeBrandImpersonation(parsedUrl))

    // Layer 3: TLD Risk
    signals.push(...this.analyzeTldRisk(parsedUrl))

    // Layer 4: Homograph/Punycode Detection
    signals.push(...this.analyzeHomograph(parsedUrl))

    // Layer 5: URL Shortener Detection
    signals.push(...this.analyzeUrlShortener(parsedUrl))

    // Layer 6: HTTPS Check
    signals.push(...this.analyzeHttps(parsedUrl))

    // Compute composite score, capped at MAX_SCORE
    const rawScore = signals.reduce((sum, s) => sum + s.score, 0)
    const riskScore = Math.min(rawScore, MAX_SCORE)

    // Determine verdict
    let verdict: PhishingAnalysis['verdict']
    if (riskScore >= 60) {
      verdict = 'DANGEROUS'
    } else if (riskScore >= 30) {
      verdict = 'SUSPICIOUS'
    } else {
      verdict = 'SAFE'
    }

    return { url, risk_score: riskScore, verdict, signals }
  }

  // ─── Layer 1: URL Pattern Analysis ──────────────────────────

  /**
   * Analyzes structural URL patterns for phishing indicators.
   * @param parsedUrl - The parsed URL object
   * @param rawUrl - The original raw URL string
   * @returns Array of signals from pattern analysis
   */
  private analyzeUrlPatterns(parsedUrl: URL, rawUrl: string): PhishingSignal[] {
    const signals: PhishingSignal[] = []
    const hostname = parsedUrl.hostname

    // IP address as hostname
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith('[')) {
      signals.push({
        type: 'ip_address_host',
        description: 'URL uses an IP address instead of a domain name',
        severity: 'high',
        score: 25
      })
    }

    // Excessive subdomains (> 3 levels)
    const subdomainCount = hostname.split('.').length - 2
    if (subdomainCount > 3) {
      signals.push({
        type: 'excessive_subdomains',
        description: `URL has ${subdomainCount} subdomain levels (suspicious: >3)`,
        severity: 'medium',
        score: 15
      })
    }

    // @ symbol in URL (used to obscure the real destination)
    if (rawUrl.includes('@') && !parsedUrl.username) {
      signals.push({
        type: 'at_symbol',
        description: 'URL contains @ symbol which can be used to obscure the real destination',
        severity: 'high',
        score: 20
      })
    } else if (parsedUrl.username) {
      signals.push({
        type: 'credentials_in_url',
        description: 'URL contains embedded credentials',
        severity: 'high',
        score: 25
      })
    }

    // Suspicious keywords in path
    const pathLower = parsedUrl.pathname.toLowerCase()
    for (const keyword of SUSPICIOUS_PATH_KEYWORDS) {
      if (pathLower.includes(keyword)) {
        signals.push({
          type: 'suspicious_path_keyword',
          description: `URL path contains suspicious keyword "${keyword}"`,
          severity: 'medium',
          score: 10
        })
        break // Only flag once for path keywords
      }
    }

    // URL length > 200
    if (rawUrl.length > 200) {
      signals.push({
        type: 'excessive_length',
        description: `URL is unusually long (${rawUrl.length} characters)`,
        severity: 'low',
        score: 10
      })
    }

    // Hyphen abuse (> 3 hyphens in hostname)
    const hyphenCount = (hostname.match(/-/g) ?? []).length
    if (hyphenCount > 3) {
      signals.push({
        type: 'hyphen_abuse',
        description: `Hostname contains ${hyphenCount} hyphens (suspicious: >3)`,
        severity: 'medium',
        score: 15
      })
    }

    return signals
  }

  // ─── Layer 2: Brand Impersonation ───────────────────────────

  /**
   * Checks for brand impersonation using Levenshtein distance.
   *
   * Compares hostname parts against known brand names. If the distance
   * is 1-2 (close but not exact), and it's not an official domain,
   * it's flagged as potential brand impersonation.
   *
   * @param parsedUrl - The parsed URL object
   * @returns Array of brand impersonation signals
   */
  private analyzeBrandImpersonation(parsedUrl: URL): PhishingSignal[] {
    const signals: PhishingSignal[] = []
    const hostname = parsedUrl.hostname.toLowerCase()

    for (const [brand, officialDomains] of OFFICIAL_DOMAINS) {
      // Skip if this IS an official domain
      if (officialDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
        continue
      }

      // Check each hostname segment against the brand name
      const hostParts = hostname.replace(/\.[^.]+$/, '').split('.')
      for (const part of hostParts) {
        // Remove common suffixes/prefixes for comparison
        const cleanPart = part.replace(/[-_]/g, '')
        const distance = this.levenshtein(cleanPart, brand)

        if (distance >= 1 && distance <= 2) {
          signals.push({
            type: 'brand_impersonation',
            description: `Hostname "${hostname}" closely resembles "${brand}" (edit distance: ${distance})`,
            severity: 'high',
            score: 30
          })
          break // One match per brand is enough
        }
      }
    }

    return signals
  }

  // ─── Layer 3: TLD Risk ──────────────────────────────────────

  /**
   * Checks if the URL uses a suspicious top-level domain.
   * @param parsedUrl - The parsed URL object
   * @returns Array of TLD risk signals
   */
  private analyzeTldRisk(parsedUrl: URL): PhishingSignal[] {
    const hostname = parsedUrl.hostname.toLowerCase()

    for (const tld of SUSPICIOUS_TLDS) {
      if (hostname.endsWith(tld)) {
        return [{
          type: 'suspicious_tld',
          description: `Domain uses suspicious TLD "${tld}"`,
          severity: 'medium',
          score: 15
        }]
      }
    }

    return []
  }

  // ─── Layer 4: Homograph / Punycode Detection ────────────────

  /**
   * Detects internationalized domain names (IDN) that may be
   * homograph attacks using punycode (xn-- prefix).
   * @param parsedUrl - The parsed URL object
   * @returns Array of homograph detection signals
   */
  private analyzeHomograph(parsedUrl: URL): PhishingSignal[] {
    const hostname = parsedUrl.hostname.toLowerCase()

    if (hostname.includes('xn--')) {
      return [{
        type: 'homograph_attack',
        description: 'Domain uses Punycode (internationalized characters) which can impersonate legitimate domains',
        severity: 'high',
        score: 25
      }]
    }

    return []
  }

  // ─── Layer 5: URL Shortener Detection ───────────────────────

  /**
   * Detects known URL shortener services that may obscure
   * the true destination of a link.
   * @param parsedUrl - The parsed URL object
   * @returns Array of URL shortener signals
   */
  private analyzeUrlShortener(parsedUrl: URL): PhishingSignal[] {
    const hostname = parsedUrl.hostname.toLowerCase()

    if (URL_SHORTENERS.has(hostname)) {
      return [{
        type: 'url_shortener',
        description: `URL uses shortener service "${hostname}" — true destination is hidden`,
        severity: 'medium',
        score: 15
      }]
    }

    return []
  }

  // ─── Layer 6: HTTPS Check ──────────────────────────────────

  /**
   * Checks if the URL uses HTTPS. Non-HTTPS URLs receive a
   * penalty score as they lack encryption.
   * @param parsedUrl - The parsed URL object
   * @returns Array of HTTPS check signals
   */
  private analyzeHttps(parsedUrl: URL): PhishingSignal[] {
    if (parsedUrl.protocol !== 'https:') {
      return [{
        type: 'no_https',
        description: 'URL does not use HTTPS — connection is not encrypted',
        severity: 'medium',
        score: 10
      }]
    }

    return []
  }

  // ─── Utility: Levenshtein Distance ─────────────────────────

  /**
   * Calculates the Levenshtein (edit) distance between two strings.
   *
   * Uses the Wagner-Fischer dynamic programming algorithm.
   * The edit distance is the minimum number of single-character
   * insertions, deletions, or substitutions needed to transform
   * string `a` into string `b`.
   *
   * @param a - First string
   * @param b - Second string
   * @returns The edit distance between the two strings
   */
  private levenshtein(a: string, b: string): number {
    const m = a.length
    const n = b.length

    // Edge cases
    if (m === 0) return n
    if (n === 0) return m

    // Create a 2D matrix
    const dp: number[][] = Array.from({ length: m + 1 }, () =>
      new Array<number>(n + 1).fill(0)
    )

    // Initialize first column and row
    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j

    // Fill the matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,       // deletion
          dp[i][j - 1] + 1,       // insertion
          dp[i - 1][j - 1] + cost  // substitution
        )
      }
    }

    return dp[m][n]
  }
}
