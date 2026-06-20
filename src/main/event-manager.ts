// ============================================================
// JARVIS V4 — Event Manager
// Listens to operating system events (clipboard, active windows,
// battery, idle times, lock states, network status) and routes
// them to the central Event Bus
// ============================================================

import { clipboard, powerMonitor, net } from 'electron';
import { EventBus } from './event-bus';
import { spawn, exec, ChildProcess } from 'child_process';

export class EventManager {
  private eventBus: EventBus;
  private clipboardInterval: ReturnType<typeof setInterval> | null = null;
  private windowInterval: ReturnType<typeof setInterval> | null = null;
  private networkInterval: ReturnType<typeof setInterval> | null = null;
  private batteryInterval: ReturnType<typeof setInterval> | null = null;
  private idleInterval: ReturnType<typeof setInterval> | null = null;
  
  private windowProcess: ChildProcess | null = null;
  private lastClipboardText: string = '';
  private lastFocusedApp: string = '';
  private lastOnline: boolean = true;

  // Power monitor listeners stored for clean removal
  private powerListeners: Record<string, () => void> = {};

  constructor() {
    this.eventBus = EventBus.getInstance();
    this.lastOnline = net.online;
  }

  /** Start listening for system input and power state events */
  public start(): void {
    console.log('[EventManager] Starting system monitors...');

    // 1. Monitor Clipboard changes every 1s
    this.lastClipboardText = clipboard.readText();
    this.clipboardInterval = setInterval(() => {
      try {
        const text = clipboard.readText();
        if (text && text !== this.lastClipboardText) {
          this.lastClipboardText = text;
          this.eventBus.publish('clipboard:changed', text);
        }
      } catch (err) {
        console.error('[EventManager] Clipboard monitoring error:', err);
      }
    }, 1000);

    // 2. Monitor Active Window changes
    this.eventBus.subscribe('window:focused', (appName) => {
      this.lastFocusedApp = appName;
    });

    this.startActiveWindowTracking();

    // 3. Monitor Network connectivity changes every 5s
    this.networkInterval = setInterval(() => {
      try {
        const online = net.online;
        if (online !== this.lastOnline) {
          this.lastOnline = online;
          this.eventBus.publish('system:network', online);
        }
      } catch (err) {
        console.error('[EventManager] Network monitoring error:', err);
      }
    }, 5000);

    // 4. Monitor System Idle state every 5s
    this.idleInterval = setInterval(() => {
      try {
        const idleSeconds = powerMonitor.getSystemIdleTime();
        this.eventBus.publish('system:idle', idleSeconds);
      } catch (err) {
        console.error('[EventManager] Idle monitoring error:', err);
      }
    }, 5000);

    // 5. Monitor Battery levels and Power source state
    this.powerListeners['on-ac'] = () => {
      this.eventBus.publish('system:power', 'ac');
      this.checkBattery();
    };
    this.powerListeners['on-battery'] = () => {
      this.eventBus.publish('system:power', 'battery');
      this.checkBattery();
    };
    this.powerListeners['suspend'] = () => {
      this.eventBus.publish('system:power', 'suspend');
    };
    this.powerListeners['resume'] = () => {
      this.eventBus.publish('system:power', 'resume');
    };
    this.powerListeners['lock-screen'] = () => {
      this.eventBus.publish('system:lock', true);
    };
    this.powerListeners['unlock-screen'] = () => {
      this.eventBus.publish('system:lock', false);
    };

    // Register power monitor event listeners
    for (const [event, handler] of Object.entries(this.powerListeners)) {
      powerMonitor.on(event as any, handler);
    }

    // Run first check and set periodic battery polling (every 60s)
    this.checkBattery();
    this.batteryInterval = setInterval(() => {
      this.checkBattery();
    }, 60000);
  }

  /** Stop background system polling loops and cleanup listeners */
  public stop(): void {
    // Clear intervals
    if (this.clipboardInterval) {
      clearInterval(this.clipboardInterval);
      this.clipboardInterval = null;
    }
    if (this.windowInterval) {
      clearInterval(this.windowInterval);
      this.windowInterval = null;
    }
    if (this.networkInterval) {
      clearInterval(this.networkInterval);
      this.networkInterval = null;
    }
    if (this.batteryInterval) {
      clearInterval(this.batteryInterval);
      this.batteryInterval = null;
    }
    if (this.idleInterval) {
      clearInterval(this.idleInterval);
      this.idleInterval = null;
    }

    // Stop spawned window process
    if (this.windowProcess) {
      this.windowProcess.kill();
      this.windowProcess = null;
    }

    // Remove power monitor event listeners
    for (const [event, handler] of Object.entries(this.powerListeners)) {
      powerMonitor.removeListener(event as any, handler);
    }
    this.powerListeners = {};

    console.log('[EventManager] System monitors stopped');
  }

  /** Run platform-specific window tracking mechanisms */
  private startActiveWindowTracking(): void {
    if (process.env.JARVIS_PERF_MODE === 'true') {
      return;
    }

    const platform = process.platform;

    if (platform === 'darwin') {
      const appleScript = `
        set lastApp to ""
        repeat
          try
            tell application "System Events" to set appName to name of first application process whose frontmost is true
            if appName is not lastApp then
              set lastApp to appName
              log appName
            end if
          end try
          delay 2
        end repeat
      `;

      try {
        this.windowProcess = spawn('osascript', ['-e', appleScript]);

        const handleData = (data: Buffer): void => {
          const raw = data.toString();
          const lines = raw.split('\n');
          for (const line of lines) {
            const appName = line.trim().replace(/^\(\*|\*\)$/g, '').trim();
            if (appName && appName !== this.lastFocusedApp) {
              this.eventBus.publish('window:focused', appName);
            }
          }
        };

        this.windowProcess.stderr?.on('data', handleData);
        this.windowProcess.stdout?.on('data', handleData);

        this.windowProcess.on('error', (err) => {
          console.error('[EventManager] macOS Window tracking process error:', err);
        });
      } catch (err) {
        console.error('[EventManager] Failed to spawn macOS window tracking process:', err);
      }
    } else if (platform === 'win32') {
      // Query Windows foreground process name using PowerShell wrapper
      const psCommand = `powershell -NoProfile -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport(\\\"user32.dll\\\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\\\"user32.dll\\\")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId); }'; $hwnd = [Win32]::GetForegroundWindow(); $pid = 0; [Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid); if ($pid -gt 0) { (Get-Process -Id $pid).ProcessName }"`;

      this.windowInterval = setInterval(() => {
        exec(psCommand, (err, stdout) => {
          if (!err && stdout) {
            const appName = stdout.trim();
            if (appName && appName !== this.lastFocusedApp) {
              this.eventBus.publish('window:focused', appName);
            }
          }
        });
      }, 2000);
    } else if (platform === 'linux') {
      // Query active window using xdotool
      this.windowInterval = setInterval(() => {
        exec('xdotool getactivewindow getwindowpid', (err, stdout) => {
          if (!err && stdout) {
            const pid = stdout.trim();
            if (pid) {
              exec(`cat /proc/${pid}/comm`, (err2, stdout2) => {
                if (!err2 && stdout2) {
                  const appName = stdout2.trim();
                  if (appName && appName !== this.lastFocusedApp) {
                    this.eventBus.publish('window:focused', appName);
                  }
                }
              });
            }
          }
        });
      }, 2000);
    }
  }

  /** Read current battery state and publish status */
  private checkBattery(): void {
    try {
      const pm = powerMonitor as any;
      if (typeof pm.getBatteryInfo === 'function' && typeof pm.isOnBattery === 'function') {
        const info = pm.getBatteryInfo();
        const isCharging = !pm.isOnBattery();
        this.eventBus.publish('system:battery', info.percent, isCharging);
      } else {
        // Fallback: check onBatteryPower property if present
        const isOnBattery = pm.onBatteryPower;
        if (isOnBattery !== undefined) {
          this.eventBus.publish('system:battery', 50, !isOnBattery);
        }
      }
    } catch (e) {
      // Battery querying is not supported on desktops or some setups; fail silently
    }
  }

  public getLastClipboardText(): string {
    return this.lastClipboardText;
  }

  public getLastFocusedApp(): string {
    return this.lastFocusedApp;
  }
}
