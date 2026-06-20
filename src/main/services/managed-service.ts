// ============================================================
// JARVIS V4 — Managed Service Interface
// Interface for supervisors managing background service lifecycles
// ============================================================

export type ServiceStatus = 'starting' | 'running' | 'stopped' | 'error';

export interface ManagedService {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  isHealthy(): boolean;
}
