// ============================================================
// JARVIS V4 — Risk Engine
// Compiles individual threat scores, calculates overall risk levels,
// tracks history, and manages notifications to prevent fatigue.
// ============================================================

import { EventBus, type ThreatReport } from './event-bus';
import type { MemoryEngine } from './engines/memory-engine';
import type { SecurityEvent } from '../shared/types';
import { randomUUID } from 'crypto';

export class RiskEngine {
  private eventBus: EventBus;
  private memoryEngine: MemoryEngine;
  private alertCallback: ((event: SecurityEvent) => void) | null = null;
  
  // Stores active threat scores and their reporting timestamps per guardian
  private threatScores: Map<string, { score: number; timestamp: number }> = new Map();
  private maxScore: number = 0;
  private decayTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  // Notification fatigue cooldown tracker: Map of "guardianName:eventType" -> lastAlertTimestamp
  private lastAlertTimes: Map<string, number> = new Map();
  
  // Threat history buffer capped at last 50 events
  private historyBuffer: SecurityEvent[] = [];

  constructor(memoryEngine: MemoryEngine) {
    this.eventBus = EventBus.getInstance();
    this.memoryEngine = memoryEngine;
    this.initialize();
  }

  private initialize(): void {
    // Listen for threat alerts from active guardians
    this.eventBus.subscribe('threat:detected', (report: ThreatReport) => {
      this.threatScores.set(report.guardian, { score: report.score, timestamp: report.timestamp });
      this.recalculateRisk();

      // Handle threat decay: set a 15-second timeout to clear the active threat level
      const existingTimeout = this.decayTimeouts.get(report.guardian);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      const timeout = setTimeout(() => {
        this.clearThreat(report.guardian);
      }, 15000);
      this.decayTimeouts.set(report.guardian, timeout);

      // 1. Log threat as security event in DB
      const eventType = this.mapGuardianToEventType(report.guardian);
      const secEvent: SecurityEvent = {
        id: report.id,
        type: eventType,
        severity: report.severity,
        description: report.description,
        timestamp: report.timestamp,
        details: report.details
      };
      
      this.memoryEngine.logSecurityEvent(secEvent);

      // 2. Track in-memory history buffer (cap at 50)
      this.historyBuffer.push(secEvent);
      if (this.historyBuffer.length > 50) {
        this.historyBuffer.shift();
      }

      // 3. Suppress notification if silent or within duplicate cooldown window (60s)
      if (report.severity === 'silent') {
        this.log(`Silent threat logged (Score: ${report.score}): ${report.description}`);
        return;
      }

      const cooldownKey = `${report.guardian}:${eventType}`;
      const lastAlertTime = this.lastAlertTimes.get(cooldownKey) || 0;
      const now = Date.now();
      
      if (now - lastAlertTime < 60000) {
        this.log(`Suppressing duplicate alert for ${cooldownKey} within 60s cooldown window.`);
        return;
      }

      this.lastAlertTimes.set(cooldownKey, now);

      // Trigger UI overlay callback for alerts above the warning threshold (score >= 40)
      if (report.score >= 40 && this.alertCallback) {
        this.alertCallback(secEvent);
      }
    });
  }

  /** Register callback to push active warnings directly to the Electron overlay window */
  public registerAlertCallback(callback: (event: SecurityEvent) => void): void {
    this.alertCallback = callback;
  }

  /** Reset threat logs for a specific guardian */
  public clearThreat(guardianName: string): void {
    const timeout = this.decayTimeouts.get(guardianName);
    if (timeout) {
      clearTimeout(timeout);
      this.decayTimeouts.delete(guardianName);
    }
    this.threatScores.delete(guardianName);
    this.recalculateRisk();
  }

  /** Compute overall threat score based on highest current score */
  private recalculateRisk(): void {
    let highest = 0;
    this.threatScores.forEach((threat) => {
      if (threat.score > highest) highest = threat.score;
    });
    this.maxScore = highest;
    this.log(`Recalculated System Threat Level: ${this.maxScore}/100`);
  }

  public getOverallRisk(): number {
    return this.maxScore;
  }

  /** Retrieve active system threat status level */
  public getThreatLevel(): 'safe' | 'elevated' | 'high' | 'critical' {
    if (this.maxScore >= 90) return 'critical';
    if (this.maxScore >= 70) return 'high';
    if (this.maxScore >= 40) return 'elevated';
    return 'safe';
  }

  /** Compile active threats and reports with timestamps */
  public getAggregatedReport(): Array<{ guardian: string; score: number; timestamp: number }> {
    const report: Array<{ guardian: string; score: number; timestamp: number }> = [];
    this.threatScores.forEach((val, key) => {
      report.push({
        guardian: key,
        score: val.score,
        timestamp: val.timestamp
      });
    });
    return report;
  }

  /** Retrieve the list of recent buffered security events */
  public getHistory(): SecurityEvent[] {
    return [...this.historyBuffer];
  }

  private mapGuardianToEventType(guardian: string): SecurityEvent['type'] {
    switch (guardian) {
      case 'ClipboardGuardian':
      case 'CredentialGuardian':
        return 'secret_detected';
      case 'BrowserGuardian':
        return 'phishing_blocked';
      case 'EmergencyGuardian':
        return 'prompt_injection';
      default:
        return 'action_blocked';
    }
  }

  private log(msg: string): void {
    console.log(`[RiskEngine] ${msg}`);
  }
}
