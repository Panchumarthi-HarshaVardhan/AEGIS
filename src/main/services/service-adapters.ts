// ============================================================
// JARVIS V4 — Service Adapters
// Adapter wrappers wrapping legacy V3 engines into the ManagedService interface
// ============================================================

import { join } from 'path';
import { spawn, ChildProcess } from 'child_process';
import { app } from 'electron';
import { existsSync } from 'fs';
import { ManagedService } from './managed-service';
import { MemoryEngine } from '../engines/memory-engine';
import { WSBridge } from '../ws-bridge';
import { EventManager } from '../event-manager';
import { ProviderManager } from '../provider-manager';

export class MemoryService implements ManagedService {
  readonly name = 'MemoryEngine';
  constructor(private engine: MemoryEngine) {}
  async start() {}
  async stop() {
    try {
      this.engine.close();
    } catch (e) {
      console.error('[MemoryService] Error closing database:', e);
    }
  }
  isHealthy() {
    return true;
  }
}

export class WebSocketService implements ManagedService {
  readonly name = 'WSBridge';
  constructor(private bridge: WSBridge) {}
  async start() {
    this.bridge.start();
  }
  async stop() {
    try {
      this.bridge.stop();
    } catch (e) {
      console.error('[WebSocketService] Error stopping WSBridge:', e);
    }
  }
  isHealthy() {
    return true;
  }
}

export class EventManagerService implements ManagedService {
  readonly name = 'EventManager';
  constructor(private em: EventManager) {}
  async start() {
    this.em.start();
  }
  async stop() {
    try {
      this.em.stop();
    } catch (e) {
      console.error('[EventManagerService] Error stopping EventManager:', e);
    }
  }
  isHealthy() {
    return true;
  }
}

export class AIProviderService implements ManagedService {
  readonly name = 'ProviderManager';
  async start() {
    await ProviderManager.getInstance().initialize();
  }
  async stop() {}
  isHealthy() {
    const status = ProviderManager.getInstance().getStatus();
    return status.activeProvider !== 'none';
  }
}

export class PythonBackendService implements ManagedService {
  readonly name = 'PythonBackend';
  private pythonProcess: ChildProcess | null = null;
  private isShuttingDown: boolean = false;
  private restartTimeout: ReturnType<typeof setTimeout> | null = null;

  async start() {
    this.isShuttingDown = false;
    this.spawnProcess();
  }

  private spawnProcess() {
    if (this.isShuttingDown) return;
    
    const pythonScript = join(app.getAppPath(), 'backend/main.py');
    let pythonBin = 'python3';
    const venvPath = join(app.getAppPath(), 'backend', 'venv', 'bin', 'python');
    const venvWinPath = join(app.getAppPath(), 'backend', 'venv', 'Scripts', 'python.exe');

    if (existsSync(venvPath)) {
      pythonBin = venvPath;
    } else if (existsSync(venvWinPath)) {
      pythonBin = venvWinPath;
    }

    console.log(`[PythonBackendService] Spawning Python backend service using ${pythonBin} at: ${pythonScript}`);
    
    // ARCHITECTURAL FIX: Use 'pipe' for stdout and stderr to prevent child exits from closing parent streams.
    this.pythonProcess = spawn(pythonBin, [pythonScript], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      cwd: join(app.getAppPath(), 'backend')
    });

    this.pythonProcess.stdout?.on('data', (data) => {
      // Safely forward logs without risking EPIPE
      const msg = data.toString().trim();
      if (msg) console.log(`[Python:stdout] ${msg}`);
    });

    this.pythonProcess.stderr?.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.error(`[Python:stderr] ${msg}`);
    });

    this.pythonProcess.on('error', (err) => {
      console.error('[PythonBackendService] Failed to start Python backend:', err.message);
    });

    this.pythonProcess.on('exit', (code, signal) => {
      this.pythonProcess = null;
      if (!this.isShuttingDown) {
        console.warn(`[PythonBackendService] Process exited unexpectedly with code ${code} (signal: ${signal}). Restarting in 5s...`);
        // Cleanup and schedule restart
        if (this.restartTimeout) clearTimeout(this.restartTimeout);
        this.restartTimeout = setTimeout(() => this.spawnProcess(), 5000);
      }
    });
  }

  async stop() {
    this.isShuttingDown = true;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (!this.pythonProcess) return;
    
    console.log('[PythonBackendService] Sending shutdown signal to Python backend...');
    try {
      const port = process.env.PORT || '8000';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      await fetch(`http://127.0.0.1:${port}/api/shutdown`, {
        method: 'POST',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      console.log('[PythonBackendService] Graceful shutdown response received from Python backend.');
    } catch (err) {
      console.warn(
        '[PythonBackendService] Python backend graceful shutdown request failed (or timed out):',
        err instanceof Error ? err.message : String(err)
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 300));

    if (this.pythonProcess) {
      try {
        this.pythonProcess.kill('SIGTERM');
        console.log('[PythonBackendService] Sent SIGTERM to Python process.');
      } catch (e) {
        console.error('[PythonBackendService] Error killing Python process:', e);
      }
      this.pythonProcess = null;
    }
  }

  isHealthy() {
    return this.pythonProcess !== null && this.pythonProcess.exitCode === null && !this.isShuttingDown;
  }
}
