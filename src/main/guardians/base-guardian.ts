// ============================================================
// JARVIS V3 — Base Guardian Engine
// Abstract skeleton for independent security and context guardians
// ============================================================

import { randomUUID } from 'crypto'
import { EventBus, type ThreatReport, type EventMap } from '../event-bus'
import { PermissionManager } from '../services/permission-manager'
import type { PermissionType } from '../../shared/types'

export abstract class BaseGuardian {
  protected eventBus: {
    publish: typeof EventBus.prototype.publish
    subscribe: typeof EventBus.prototype.subscribe
    unsubscribe: typeof EventBus.prototype.unsubscribe
  }
  protected name: string
  protected active: boolean = true;
  private subscriptions: Array<{ event: keyof EventMap; listener: (...args: any[]) => void }> = [];
  private wrappedListeners: Map<any, any> = new Map();

  protected metrics = {
    eventCount: 0,
    errorCount: 0,
    lastActivationTime: Date.now()
  };

  constructor(name: string) {
    this.name = name;
    
    const realBus = EventBus.getInstance();
    // Intercept subscriptions for active/idle dynamic unloading
    this.eventBus = {
      publish: (event: any, ...args: any[]) => realBus.publish(event, ...args),
      subscribe: (event: any, listener: any) => {
        const wrapped = async (...args: any[]) => {
          this.metrics.eventCount++;
          try {
            const res = listener(...args);
            if (res instanceof Promise) {
              await res;
            }
          } catch (err) {
            this.metrics.errorCount++;
            this.logError(`Error in event listener for "${event}":`, err);
            throw err;
          }
        };
        this.wrappedListeners.set(listener, wrapped);
        realBus.subscribe(event, wrapped, { name: this.name });
        this.subscriptions.push({ event, listener: wrapped });
        return this.eventBus;
      },
      unsubscribe: (event: any, listener: any) => {
        const wrapped = this.wrappedListeners.get(listener) || listener;
        realBus.unsubscribe(event, wrapped);
        this.wrappedListeners.delete(listener);
        this.subscriptions = this.subscriptions.filter(
          (s) => s.event !== event || s.listener !== wrapped
        );
        return this.eventBus;
      }
    } as any;

    this.initialize();
  }

  /** Initialize hooks and event bus subscriptions */
  protected abstract initialize(): void;

  /** Report a security threat to the Risk Engine */
  protected reportThreat(score: number, description: string, details?: Record<string, any>): void {
    if (!this.active) return;

    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (score >= 90) severity = 'critical';
    else if (score >= 70) severity = 'high';
    else if (score >= 40) severity = 'medium';

    const report: ThreatReport = {
      id: randomUUID(),
      guardian: this.name,
      score,
      severity,
      description,
      details,
      timestamp: Date.now()
    };

    this.logWarn(`Threat reported (Score: ${score}): ${description}`);
    EventBus.getInstance().publish('threat:detected', report);
  }

  /** Log an informational message */
  protected log(message: string, ...optionalParams: any[]): void {
    console.log(`[Guardian:${this.name}] ${message}`, ...optionalParams);
  }

  /** Log a warning message */
  protected logWarn(message: string, ...optionalParams: any[]): void {
    console.warn(`[Guardian:${this.name}] ${message}`, ...optionalParams);
  }

  /** Log an error message */
  protected logError(message: string, ...optionalParams: any[]): void {
    console.error(`[Guardian:${this.name}] ${message}`, ...optionalParams);
  }

  /** Clear all active event bus subscriptions for this guardian */
  private clearSubscriptions(): void {
    const realBus = EventBus.getInstance();
    for (const sub of this.subscriptions) {
      realBus.unsubscribe(sub.event, sub.listener);
    }
    this.subscriptions = [];
    this.wrappedListeners.clear();
  }

  /** Toggle active state based on context engine updates */
  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    console.log(`[Guardian:${this.name}] Status changed: ${active ? 'ENABLED' : 'IDLE'}`);
    if (active) {
      this.metrics.lastActivationTime = Date.now();
      this.initialize();
    } else {
      this.clearSubscriptions();
    }
  }

  getName(): string {
    return this.name;
  }

  getMetrics() {
    return { ...this.metrics };
  }

  protected checkPermission(permission: PermissionType): boolean {
    return PermissionManager.getInstance().check(permission) === 'granted';
  }
}

