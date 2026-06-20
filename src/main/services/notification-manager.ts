// ============================================================
// JARVIS V4 — Notification Manager
// Tiered notification routing, deduplication, and rate-limiting
// ============================================================

import { BrowserWindow } from 'electron';
import { SecurityEvent } from '../../shared/types';

export type NotificationLevel = 'passive' | 'toast' | 'floating_alert' | 'fullscreen_alert' | 'emergency';

export class NotificationManager {
  private static instance: NotificationManager | null = null;
  private mainWindow: BrowserWindow | null = null;
  
  // Tracks timestamps of sent notifications in the last 30-second window for rate-limiting
  private sentTimestamps: number[] = [];
  
  // Tracks cooldown windows: Map of "guardianName:eventType" -> lastSentTimestamp
  private cooldowns: Map<string, number> = new Map();
  
  // Priority queue for pending notifications
  private queue: SecurityEvent[] = [];
  private processingQueue: boolean = false;

  private constructor() {}

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  public setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win;
  }

  /**
   * Routes a security event through the rate-limited, priority-queued notification manager.
   */
  public notify(event: SecurityEvent): void {
    const level = this.getNotificationLevel(event.severity);
    
    // 1. Passive alerts are logged in background only
    if (level === 'passive') {
      console.log(`[NotificationManager] Passive alert logged (no UI toast): ${event.description}`);
      return;
    }

    // 2. Deduplication check (60-second cooldown per guardian/type key)
    const guardian = (event.details?.guardian as string) || 'unknown';
    const cooldownKey = `${guardian}:${event.type}`;
    const lastSent = this.cooldowns.get(cooldownKey) || 0;
    const now = Date.now();
    
    if (now - lastSent < 60000) {
      console.log(`[NotificationManager] Cooldown active for "${cooldownKey}". Suppressing UI notification.`);
      return;
    }

    // 3. Enqueue and trigger queue processing
    this.enqueue(event);
  }

  private getNotificationLevel(severity: string): NotificationLevel {
    switch (severity) {
      case 'silent':
        return 'passive';
      case 'low':
        return 'toast';
      case 'medium':
        return 'floating_alert';
      case 'high':
        return 'fullscreen_alert';
      case 'critical':
        return 'emergency';
      default:
        return 'toast';
    }
  }

  private getSeverityPriority(severity: string): number {
    switch (severity) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  private enqueue(event: SecurityEvent): void {
    this.queue.push(event);
    
    // Sort queue: higher severity priority first, then by timestamp oldest first
    this.queue.sort((a, b) => {
      const pDiff = this.getSeverityPriority(b.severity) - this.getSeverityPriority(a.severity);
      if (pDiff !== 0) return pDiff;
      return a.timestamp - b.timestamp;
    });

    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processingQueue) return;
    this.processingQueue = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      // Keep only stamps within the last 30 seconds
      this.sentTimestamps = this.sentTimestamps.filter(t => now - t < 30000);

      // Enforce rate limit: max 3 notifications per 30 seconds
      if (this.sentTimestamps.length >= 3) {
        // Sleep for 1 second before re-evaluating the queue
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      const event = this.queue.shift();
      if (event) {
        this.dispatch(event);
        this.sentTimestamps.push(Date.now());
        
        const guardian = (event.details?.guardian as string) || 'unknown';
        const cooldownKey = `${guardian}:${event.type}`;
        this.cooldowns.set(cooldownKey, Date.now());
      }
    }

    this.processingQueue = false;
  }

  private dispatch(event: SecurityEvent): void {
    if (!this.mainWindow) {
      console.warn('[NotificationManager] Main window reference not set. Dropping warning.');
      return;
    }

    try {
      this.mainWindow.webContents.send('jarvis:security-alert', event);
    } catch (e) {
      console.error('[NotificationManager] Failed to send IPC security alert:', e);
    }
  }
}
