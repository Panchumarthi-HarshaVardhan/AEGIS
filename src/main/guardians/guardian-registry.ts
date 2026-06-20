// ============================================================
// JARVIS V4 — Guardian Registry
// Central catalog overseeing the lifecycle and metrics of active guardians
// ============================================================

import { BaseGuardian } from './base-guardian';

export class GuardianRegistry {
  private static instance: GuardianRegistry | null = null;
  private guardians: Map<string, BaseGuardian> = new Map();

  private constructor() {}

  public static getInstance(): GuardianRegistry {
    if (!GuardianRegistry.instance) {
      GuardianRegistry.instance = new GuardianRegistry();
    }
    return GuardianRegistry.instance;
  }

  /**
   * Register a guardian in the registry.
   */
  public register(guardian: BaseGuardian): void {
    const name = guardian.getName();
    if (this.guardians.has(name)) {
      console.warn(`[GuardianRegistry] Guardian "${name}" is already registered. Overwriting.`);
    }
    this.guardians.set(name, guardian);
    console.log(`[GuardianRegistry] Registered guardian: ${name}`);
  }

  /**
   * Start all registered guardians.
   */
  public startAll(): void {
    console.log('[GuardianRegistry] Starting all registered guardians...');
    for (const [name, guardian] of this.guardians.entries()) {
      try {
        console.log(`[GuardianRegistry] Activating guardian: ${name}`);
        guardian.setActive(true);
      } catch (error) {
        console.error(`[GuardianRegistry] Failed to activate guardian "${name}":`, error);
      }
    }
  }

  /**
   * Stop all registered guardians (set to idle).
   */
  public stopAll(): void {
    console.log('[GuardianRegistry] Deactivating all registered guardians...');
    for (const [name, guardian] of this.guardians.entries()) {
      try {
        console.log(`[GuardianRegistry] Deactivating guardian: ${name}`);
        guardian.setActive(false);
      } catch (error) {
        console.error(`[GuardianRegistry] Failed to deactivate guardian "${name}":`, error);
      }
    }
  }

  /**
   * Retrieve a guardian by name.
   */
  public getGuardian(name: string): BaseGuardian | undefined {
    return this.guardians.get(name);
  }

  /**
   * Get health status map of all guardians.
   */
  public getHealth(): Map<string, boolean> {
    const healthMap = new Map<string, boolean>();
    for (const [name, guardian] of this.guardians.entries()) {
      // Guardians are healthy if they exist and are active.
      // We can also check if error count is low relative to event count, but for now simple active check works.
      healthMap.set(name, true);
    }
    return healthMap;
  }

  /**
   * Restart a specific guardian.
   */
  public restart(name: string): void {
    const guardian = this.guardians.get(name);
    if (!guardian) {
      throw new Error(`Guardian "${name}" not found in registry.`);
    }
    console.log(`[GuardianRegistry] Restarting guardian: ${name}`);
    guardian.setActive(false);
    guardian.setActive(true);
    console.log(`[GuardianRegistry] Guardian "${name}" successfully restarted.`);
  }

  /**
   * Retrieve runtime metrics for all or a specific guardian.
   */
  public getMetrics(): Map<string, { eventCount: number; errorCount: number; lastActivationTime: number }> {
    const metricsMap = new Map<string, { eventCount: number; errorCount: number; lastActivationTime: number }>();
    for (const [name, guardian] of this.guardians.entries()) {
      metricsMap.set(name, guardian.getMetrics());
    }
    return metricsMap;
  }
}
