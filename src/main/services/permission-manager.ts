// ============================================================
// JARVIS V4 — Centralized Permission Manager
// Manages and enforces permissions for OS-level capabilities
// ============================================================

import { randomUUID } from 'crypto';
import { MemoryEngine } from '../engines/memory-engine';
import { PermissionType, PermissionState, PermissionEntry } from '../../shared/types';

export class PermissionManager {
  private static instance: PermissionManager | null = null;
  private memoryEngine: MemoryEngine | null = null;
  private cache: Map<PermissionType, PermissionEntry> = new Map();
  private requestCallback: ((req: { id: string; guardianName: string; permission: PermissionType }) => Promise<PermissionState>) | null = null;

  private constructor() {}

  public static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  /**
   * Initialize with the database engine.
   */
  public initialize(memoryEngine: MemoryEngine): void {
    this.memoryEngine = memoryEngine;
    this.loadAllFromDb();
  }

  /**
   * Set the callback used when a permission request requires user interaction.
   */
  public setRequestCallback(
    callback: (req: { id: string; guardianName: string; permission: PermissionType }) => Promise<PermissionState>
  ): void {
    this.requestCallback = callback;
  }

  /**
   * Check the current state of a permission.
   */
  public check(permission: PermissionType): PermissionState {
    const entry = this.cache.get(permission);
    if (!entry) return 'not_set';

    // Verify temporary grant lifetime (valid for 1 hour or until process exit)
    if (entry.state === 'temporary') {
      const oneHourMs = 3600000;
      if (entry.grantedAt && Date.now() - entry.grantedAt > oneHourMs) {
        entry.state = 'not_set';
        entry.grantedAt = undefined;
        this.savePermission(permission, entry);
      }
    }

    return entry.state;
  }

  /**
   * Request a permission asynchronously. Prompts the user if not set or ask_every_time.
   */
  public async request(guardianName: string, permission: PermissionType): Promise<PermissionState> {
    const state = this.check(permission);
    if (state !== 'not_set' && state !== 'ask_every_time') {
      return state;
    }

    if (this.requestCallback) {
      try {
        const id = randomUUID();
        const result = await this.requestCallback({ id, guardianName, permission });
        
        if (result === 'granted') {
          this.grant(permission);
        } else if (result === 'temporary') {
          this.grantTemporary(permission);
        } else if (result === 'denied') {
          this.deny(permission);
        }
        
        return result;
      } catch (err) {
        console.error(`[PermissionManager] Error during user request prompt for "${permission}":`, err);
        return 'denied';
      }
    }

    // Default to denied if no user prompt handler is registered
    return 'denied';
  }

  /**
   * Permanently grant a permission.
   */
  public grant(permission: PermissionType, scope?: string): void {
    const entry: PermissionEntry = {
      permission,
      state: 'granted',
      grantedAt: Date.now(),
      scope
    };
    this.cache.set(permission, entry);
    this.savePermission(permission, entry);
  }

  /**
   * Temporarily grant a permission.
   */
  public grantTemporary(permission: PermissionType): void {
    const entry: PermissionEntry = {
      permission,
      state: 'temporary',
      grantedAt: Date.now()
    };
    this.cache.set(permission, entry);
    this.savePermission(permission, entry);
  }

  /**
   * Explicitly deny a permission.
   */
  public deny(permission: PermissionType): void {
    const entry: PermissionEntry = {
      permission,
      state: 'denied'
    };
    this.cache.set(permission, entry);
    this.savePermission(permission, entry);
  }

  /**
   * Revoke/reset a permission.
   */
  public revoke(permission: PermissionType): void {
    const entry: PermissionEntry = {
      permission,
      state: 'not_set'
    };
    this.cache.set(permission, entry);
    this.savePermission(permission, entry);
  }

  /**
   * Retrieve all permissions.
   */
  public getAll(): PermissionEntry[] {
    return Array.from(this.cache.values());
  }

  /**
   * Load permissions from SQLite database permissions table.
   */
  private loadAllFromDb(): void {
    if (!this.memoryEngine) return;
    
    try {
      const rows = this.memoryEngine.getPermissions();
      for (const row of rows) {
        this.cache.set(row.permission as PermissionType, {
          permission: row.permission as PermissionType,
          state: row.state as PermissionState,
          scope: row.scope || undefined,
          grantedAt: row.granted_at || undefined
        });
      }
    } catch (e) {
      console.error('[PermissionManager] Failed to load permissions from DB:', e);
    }

    const permissionTypes: PermissionType[] = [
      'microphone', 'camera', 'screen_recording', 'accessibility',
      'automation', 'clipboard', 'downloads', 'browser_extension',
      'notifications', 'file_system'
    ];

    for (const type of permissionTypes) {
      if (!this.cache.has(type)) {
        this.setDefault(type);
      }
    }
  }

  /**
   * Helper to set initial default entry.
   */
  private setDefault(permission: PermissionType): void {
    // For seamless backward compatibility, default to 'granted' unless configured
    const entry: PermissionEntry = {
      permission,
      state: 'granted'
    };
    this.cache.set(permission, entry);
  }

  /**
   * Helper to serialize and save to database.
   */
  private savePermission(permission: PermissionType, entry: PermissionEntry): void {
    if (!this.memoryEngine) return;
    try {
      this.memoryEngine.savePermission(permission, entry.state, entry.scope, entry.grantedAt);
    } catch (e) {
      console.error(`[PermissionManager] Failed to save permission "${permission}" to database:`, e);
    }
  }
}
