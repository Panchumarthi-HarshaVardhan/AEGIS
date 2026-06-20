// ============================================================
// JARVIS V4 — Trust Engine
// Evaluates composite trust scores for external sources (URLs, downloads, clipboard)
// ============================================================

import { PhishingDetector } from '../security/phishing-detector';
import { SecretScanner } from '../security/secret-scanner';
import { TrustVerdict, TrustSignal } from '../../shared/types';

export class TrustEngine {
  constructor(
    private phishingDetector: PhishingDetector,
    private secretScanner: SecretScanner
  ) {}

  /**
   * Evaluate the trust of a URL by combining reputation, HTTPS encryption, and TLD checks.
   */
  public async evaluateUrl(url: string): Promise<TrustVerdict> {
    const signals: TrustSignal[] = [];
    let score = 100;

    // 1. Phishing reputation check
    try {
      const phishingAnalysis = await this.phishingDetector.analyze(url);
      const penalty = phishingAnalysis.risk_score;
      score -= penalty;

      signals.push({
        type: 'url_reputation',
        description: `Phishing detector risk score: ${penalty}`,
        score: -penalty,
        status: penalty >= 60 ? 'fail' : penalty >= 30 ? 'warning' : 'pass'
      });
    } catch (e) {
      console.error('[TrustEngine] Phishing detector failure:', e);
    }

    // 2. HTTPS/Security check
    const isHttps = url.toLowerCase().startsWith('https://');
    if (!isHttps) {
      score -= 20;
      signals.push({
        type: 'connection_security',
        description: 'Unencrypted HTTP connection detected',
        score: -20,
        status: 'warning'
      });
    } else {
      signals.push({
        type: 'connection_security',
        description: 'Secure HTTPS connection',
        score: 0,
        status: 'pass'
      });
    }

    // 3. TLD risk heuristic
    const urlObj = this.parseUrl(url);
    if (urlObj) {
      const hostname = urlObj.hostname;
      const suspiciousTlds = ['.xyz', '.top', '.club', '.work', '.click', '.buzz', '.gq', '.ml', '.tk'];
      const matchedTld = suspiciousTlds.find(tld => hostname.endsWith(tld));
      
      if (matchedTld) {
        score -= 15;
        signals.push({
          type: 'tld_reputation',
          description: `Suspicious Top Level Domain extension: ${matchedTld}`,
          score: -15,
          status: 'warning'
        });
      }
    }

    score = Math.max(0, Math.min(100, score));

    // Categorize final score
    let category: TrustVerdict['category'] = 'safe';
    if (score < 40) category = 'critical';
    else if (score < 60) category = 'dangerous';
    else if (score < 80) category = 'suspicious';

    const recommendation = category === 'safe'
      ? 'This URL appears safe to visit.'
      : category === 'suspicious'
      ? 'Use caution when interacting with this domain.'
      : 'Avoid entering credentials or sensitive data on this website.';

    return {
      score,
      category,
      signals,
      recommendation
    };
  }

  /**
   * Evaluate the trust/sensitivity of clipboard text by scanning for secrets.
   */
  public evaluateClipboard(text: string): TrustVerdict {
    const signals: TrustSignal[] = [];
    let score = 100;

    const detectedSecrets = this.secretScanner.scan(text);
    if (detectedSecrets.length > 0) {
      // Deduce severity based on detected secret types
      const containsHighRisk = detectedSecrets.some(secret => 
        secret.type.toLowerCase().includes('key') || 
        secret.type.toLowerCase().includes('token') ||
        secret.type.toLowerCase().includes('password')
      );

      const penalty = containsHighRisk ? 40 : 20;
      score -= penalty;

      signals.push({
        type: 'sensitive_content',
        description: `Detected ${detectedSecrets.length} sensitive patterns/credentials in clipboard`,
        score: -penalty,
        status: 'warning'
      });
    } else {
      signals.push({
        type: 'sensitive_content',
        description: 'No sensitive credentials detected',
        score: 0,
        status: 'pass'
      });
    }

    score = Math.max(0, Math.min(100, score));

    let category: TrustVerdict['category'] = 'safe';
    if (score < 80) category = 'suspicious';

    const recommendation = category === 'safe'
      ? 'Clipboard content appears safe for transfer.'
      : 'Clipboard contains sensitive credentials. Avoid pasting into untrusted fields.';

    return {
      score,
      category,
      signals,
      recommendation
    };
  }

  private parseUrl(url: string): URL | null {
    try {
      return new URL(url);
    } catch (e) {
      return null;
    }
  }
}
