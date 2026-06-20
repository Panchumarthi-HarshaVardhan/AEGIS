// ============================================================
// JARVIS V4 — Service Supervisor Manager
// Central manager overseeing start/stop lifecycles of all background engines
// ============================================================

import { ManagedService } from './managed-service';

export class ServiceManager {
  private static instance: ServiceManager | null = null;
  private services: Map<string, ManagedService> = new Map();
  private startOrder: string[] = [];

  private constructor() {}

  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  /**
   * Register a new managed service.
   * Registration order is preserved for start sequence.
   */
  public register(service: ManagedService): void {
    if (this.services.has(service.name)) {
      console.warn(`[ServiceManager] Service "${service.name}" is already registered. Overwriting.`);
    }
    this.services.set(service.name, service);
    if (!this.startOrder.includes(service.name)) {
      this.startOrder.push(service.name);
    }
    console.log(`[ServiceManager] Registered service: ${service.name}`);
  }

  /**
   * Start all registered services in order.
   */
  public async startAll(): Promise<void> {
    console.log('[ServiceManager] Starting all services...');
    for (const name of this.startOrder) {
      const service = this.services.get(name);
      if (service) {
        try {
          console.log(`[ServiceManager] Starting service: ${name}`);
          await service.start();
        } catch (error) {
          console.error(`[ServiceManager] Failed to start service "${name}":`, error);
        }
      }
    }
    console.log('[ServiceManager] All services started.');
  }

  /**
   * Stop all registered services in reverse order.
   */
  public async stopAll(): Promise<void> {
    console.log('[ServiceManager] Stopping all services in reverse order...');
    const stopOrder = [...this.startOrder].reverse();
    for (const name of stopOrder) {
      const service = this.services.get(name);
      if (service) {
        try {
          console.log(`[ServiceManager] Stopping service: ${name}`);
          await service.stop();
        } catch (error) {
          console.error(`[ServiceManager] Failed to stop service "${name}":`, error);
        }
      }
    }
    console.log('[ServiceManager] All services stopped.');
  }

  /**
   * Restart an individual service.
   */
  public async restart(name: string): Promise<void> {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service "${name}" not found in registry.`);
    }
    console.log(`[ServiceManager] Restarting service: ${name}`);
    try {
      await service.stop();
    } catch (error) {
      console.error(`[ServiceManager] Error stopping service "${name}" during restart:`, error);
    }
    await service.start();
    console.log(`[ServiceManager] Service "${name}" successfully restarted.`);
  }

  /**
   * Get health status map of all services.
   */
  public getHealth(): Map<string, boolean> {
    const healthMap = new Map<string, boolean>();
    for (const [name, service] of this.services.entries()) {
      try {
        healthMap.set(name, service.isHealthy());
      } catch (error) {
        console.error(`[ServiceManager] Error checking health of service "${name}":`, error);
        healthMap.set(name, false);
      }
    }
    return healthMap;
  }

  /**
   * Generates a diagnostic log of all services.
   */
  public getDiagnostics(): string {
    const lines: string[] = ['=== Service Diagnostics ==='];
    for (const [name, service] of this.services.entries()) {
      const status = service.isHealthy() ? 'HEALTHY' : 'UNHEALTHY/DOWN';
      lines.push(`Service: ${name} | Status: ${status}`);
    }
    return lines.join('\n');
  }
}
