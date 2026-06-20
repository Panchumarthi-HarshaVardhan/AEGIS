// ============================================================
// JARVIS V4 — Context Engine
// Manages system power states and selectively enables/disables
// guardians based on user activity, battery, idle, and lock status
// ============================================================

import { BaseGuardian } from './base-guardian';
import { PermissionManager } from '../services/permission-manager';

export type ContextMode =
  | 'development'
  | 'banking'
  | 'meeting'
  | 'entertainment'
  | 'general'
  | 'idle'
  | 'low_power'
  | 'locked';

export class ContextEngine extends BaseGuardian {
  private currentMode: ContextMode = 'general';
  private previousMode: ContextMode = 'general';
  private guardians: Map<string, { setActive: (active: boolean) => void }> = new Map();

  // State variables for system status
  private isLocked: boolean = false;
  private isIdle: boolean = false;
  private isLowPower: boolean = false;

  constructor() {
    super('ContextEngine');
  }

  protected initialize(): void {
    // 1. Listen for active window focus changes to infer context
    this.eventBus.subscribe('window:focused', (appName: string) => {
      this.evaluateAppOrUrlContext(appName, null);
    });

    // 2. Listen for URL changes to detect banking or secure logins
    this.eventBus.subscribe('browser:navigation', (url: string) => {
      this.evaluateAppOrUrlContext(null, url);
    });

    // 3. Listen for idle events
    this.eventBus.subscribe('system:idle', (idleSeconds: number) => {
      this.handleIdleState(idleSeconds);
    });

    // 4. Listen for power state changes
    this.eventBus.subscribe('system:power', (state: 'ac' | 'battery' | 'suspend' | 'resume') => {
      this.handlePowerState(state);
    });

    // 5. Listen for screen lock status
    this.eventBus.subscribe('system:lock', (locked: boolean) => {
      this.handleLockState(locked);
    });

    // 6. Listen for battery percentage levels
    this.eventBus.subscribe('system:battery', (level: number, charging: boolean) => {
      this.handleBatteryState(level, charging);
    });
  }

  /** Register guardians that should be dynamically powered up/down */
  public registerGuardians(guardiansList: any[]): void {
    for (const guardian of guardiansList) {
      if (guardian !== this) {
        this.guardians.set(guardian.getName(), guardian);
      }
    }
    this.applyMode(this.currentMode);
  }

  /** Handle system idle state changes */
  private handleIdleState(idleSeconds: number): void {
    const idleThresholdSeconds = 300; // 5 minutes
    const shouldBeIdle = idleSeconds >= idleThresholdSeconds;

    if (this.isIdle !== shouldBeIdle) {
      this.isIdle = shouldBeIdle;
      this.log(`System idle status changed: ${shouldBeIdle ? 'IDLE' : 'ACTIVE'}`);
      this.updateEffectiveMode();
    }
  }

  /** Handle system power events (AC/Battery/Suspend/Resume) */
  private handlePowerState(state: 'ac' | 'battery' | 'suspend' | 'resume'): void {
    this.log(`Power state changed: ${state}`);
    if (state === 'suspend') {
      this.handleLockState(true);
    } else if (state === 'resume') {
      this.handleLockState(false);
    }
  }

  /** Handle screen lock/unlock status changes */
  private handleLockState(locked: boolean): void {
    if (this.isLocked !== locked) {
      this.isLocked = locked;
      this.log(`Screen lock state changed: ${locked ? 'LOCKED' : 'UNLOCKED'}`);
      this.updateEffectiveMode();
    }
  }

  /** Handle battery updates to determine low power mode */
  private handleBatteryState(level: number, charging: boolean): void {
    // Low power threshold: < 20% battery and not charging
    const shouldBeLowPower = level < 20 && !charging;

    if (this.isLowPower !== shouldBeLowPower) {
      this.isLowPower = shouldBeLowPower;
      this.log(`Low power state changed: ${shouldBeLowPower ? 'LOW_POWER_ACTIVE' : 'NORMAL_POWER'}`);
      this.updateEffectiveMode();
    }
  }

  /** Calculate and apply the effective context mode based on system status */
  private updateEffectiveMode(): void {
    let targetMode: ContextMode = 'general';

    if (this.isLocked) {
      targetMode = 'locked';
    } else if (this.isIdle) {
      targetMode = 'idle';
    } else if (this.isLowPower) {
      targetMode = 'low_power';
    } else {
      targetMode = this.previousMode;
    }

    if (targetMode !== this.currentMode) {
      this.currentMode = targetMode;
      this.log(`Context transitioned to: ${targetMode.toUpperCase()}`);
      this.eventBus.publish('context:changed', targetMode);
      this.applyMode(targetMode);
    }
  }

  /** Check active window or navigation url to switch system state */
  private evaluateAppOrUrlContext(appName: string | null, url: string | null): void {
    // If locked, idle, or low power, we preserve the user context in previousMode
    // so we can revert back to it once the system returns to normal active state.
    let inferredMode: ContextMode = this.previousMode;

    if (appName) {
      const lowerApp = appName.toLowerCase();
      if (
        lowerApp.includes('code') ||
        lowerApp.includes('vscode') ||
        lowerApp.includes('cursor') ||
        lowerApp.includes('xcode') ||
        lowerApp.includes('terminal') ||
        lowerApp.includes('iterm') ||
        lowerApp.includes('intellij') ||
        lowerApp.includes('webstorm')
      ) {
        inferredMode = 'development';
      } else if (
        lowerApp.includes('zoom') ||
        lowerApp.includes('teams') ||
        lowerApp.includes('discord') ||
        lowerApp.includes('slack') ||
        lowerApp.includes('webex') ||
        lowerApp.includes('meet')
      ) {
        inferredMode = 'meeting';
      } else if (
        lowerApp.includes('spotify') ||
        lowerApp.includes('vlc') ||
        lowerApp.includes('youtube')
      ) {
        inferredMode = 'entertainment';
      } else {
        inferredMode = 'general';
      }
    }

    if (url) {
      const lowerUrl = url.toLowerCase();
      if (
        lowerUrl.includes('paypal') ||
        lowerUrl.includes('chase.com') ||
        lowerUrl.includes('wellsfargo') ||
        lowerUrl.includes('bankofamerica') ||
        lowerUrl.includes('stripe') ||
        lowerUrl.includes('checkout') ||
        lowerUrl.includes('onlinebanking') ||
        lowerUrl.includes('paytm') ||
        lowerUrl.includes('bank')
      ) {
        inferredMode = 'banking';
      }
    }

    if (inferredMode !== this.previousMode) {
      this.previousMode = inferredMode;
      // Trigger an update if we are not currently overridden by system status
      if (!this.isLocked && !this.isIdle && !this.isLowPower) {
        this.updateEffectiveMode();
      }
    }
  }

  /** Apply active state masks to all registered guardians */
  private applyMode(mode: ContextMode): void {
    const activeMap: Record<string, boolean> = {
      BrowserGuardian: false,
      ClipboardGuardian: false,
      CredentialGuardian: false,
      DownloadGuardian: false,
      PrivacyGuardian: false,
      DeepfakeGuardian: false,
      FakeNewsGuardian: false,
      CallGuardian: false,
      EmergencyGuardian: false,
      AutomationGuardian: false
    };

    switch (mode) {
      case 'locked':
        // Suspend all active detectors except essential emergency services
        activeMap.EmergencyGuardian = true;
        break;

      case 'idle':
        // Suspend clipboard/keystroke scanning, run passive file/emergency monitors
        activeMap.DownloadGuardian = true;
        activeMap.EmergencyGuardian = true;
        break;

      case 'low_power':
        // Disable resource-heavy ML detectors (deepfake, call analysis)
        activeMap.BrowserGuardian = true;
        activeMap.ClipboardGuardian = true;
        activeMap.CredentialGuardian = true;
        activeMap.DownloadGuardian = true;
        activeMap.AutomationGuardian = true;
        activeMap.EmergencyGuardian = true;
        break;

      case 'development':
        activeMap.CredentialGuardian = true;
        activeMap.ClipboardGuardian = true;
        activeMap.BrowserGuardian = true;
        activeMap.AutomationGuardian = true;
        activeMap.EmergencyGuardian = true;
        break;

      case 'banking':
        activeMap.BrowserGuardian = true;
        activeMap.CredentialGuardian = true;
        activeMap.PrivacyGuardian = true;
        activeMap.ClipboardGuardian = true;
        activeMap.AutomationGuardian = true;
        activeMap.EmergencyGuardian = true;
        break;

      case 'meeting':
        activeMap.CallGuardian = true;
        activeMap.PrivacyGuardian = true;
        activeMap.EmergencyGuardian = true;
        break;

      case 'entertainment':
        activeMap.BrowserGuardian = true;
        activeMap.DeepfakeGuardian = true;
        break;

      case 'general':
      default:
        activeMap.BrowserGuardian = true;
        activeMap.DownloadGuardian = true;
        activeMap.ClipboardGuardian = true;
        activeMap.CredentialGuardian = true;
        activeMap.AutomationGuardian = true;
        activeMap.EmergencyGuardian = true;
        break;
    }

    // Ensure EmergencyGuardian remains active unless entertainment is explicitly active
    if (mode !== 'entertainment') {
      activeMap.EmergencyGuardian = true;
    }

    // Set states on all active guardians
    this.guardians.forEach((guardian, name) => {
      const state = activeMap[name] !== undefined ? activeMap[name] : true;
      guardian.setActive(state);
    });
  }

  public getCurrentMode(): ContextMode {
    return this.currentMode;
  }
}
