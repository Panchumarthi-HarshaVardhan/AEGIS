// ============================================================
// JARVIS Guardian AI — Downloads Watchdog Engine
// Watches Downloads directory for malware scans
// ============================================================

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { randomUUID } from 'crypto'
import type { MemoryEngine } from './memory-engine'
import type { AutomationProvider } from '../automation/automation-provider'
import type { SecurityEvent } from '../../shared/types'

/** Extensions indicating active downloads that should be ignored */
const IGNORED_TEMP_EXTENSIONS = new Set([
  '.crdownload', // Chrome
  '.download',   // Safari
  '.tmp',        // Firefox / generic
  '.part'        // Firefox
])

export class WatchdogEngine {
  private memoryEngine: MemoryEngine
  private automation: AutomationProvider
  private downloadsPath: string
  private watcher: fs.FSWatcher | null = null
  private scannedFiles: Set<string> = new Set()

  constructor(memoryEngine: MemoryEngine, automation: AutomationProvider) {
    this.memoryEngine = memoryEngine
    this.automation = automation
    this.downloadsPath = app.getPath('downloads')
  }

  /** Start watching the downloads directory */
  start(onAlertCallback: (event: SecurityEvent) => void): void {
    if (this.watcher) {
      console.warn('WatchdogEngine: Already running')
      return
    }

    console.log(`[Watchdog] Monitoring folder: ${this.downloadsPath}`)

    try {
      this.watcher = fs.watch(this.downloadsPath, (eventType, filename) => {
        if (eventType === 'rename' && filename) {
          const filePath = path.join(this.downloadsPath, filename)
          this.handleFileChange(filePath, onAlertCallback).catch((err) => {
            console.error('[Watchdog] Error handling file change:', err)
          })
        }
      })
    } catch (err) {
      console.error('[Watchdog] Failed to start folder monitoring:', err)
    }
  }

  /** Stop the folder watcher */
  stop(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
      console.log('[Watchdog] Folder monitoring stopped')
    }
  }

  /** Process file rename/addition event */
  private async handleFileChange(
    filePath: string,
    onAlertCallback: (event: SecurityEvent) => void
  ): Promise<void> {
    const ext = path.extname(filePath).toLowerCase()
    
    // Ignore temp download extensions and folders
    if (IGNORED_TEMP_EXTENSIONS.has(ext)) return
    if (!fs.existsSync(filePath)) return
    
    try {
      const stats = fs.statSync(filePath)
      if (stats.isDirectory()) return
    } catch {
      return
    }

    // Prevent double-scanning of same file
    if (this.scannedFiles.has(filePath)) return
    this.scannedFiles.add(filePath)

    // Wait 500ms to ensure file lock is released by browser download process
    await new Promise((resolve) => setTimeout(resolve, 500))

    if (!fs.existsSync(filePath)) return

    console.log(`[Watchdog] New download detected, scanning: ${path.basename(filePath)}`)

    try {
      const scanResult = await this.scanFileViaBackend(filePath)
      
      if (scanResult.status === 'DANGEROUS') {
        const file_name = path.basename(filePath)
        
        // 1. Create a security threat event
        const threatEvent: SecurityEvent = {
          id: randomUUID(),
          type: 'action_blocked', // matches alert type filter
          severity: 'critical',
          description: `MALWARE BLOCKED: File "${file_name}" failed safety check. Verdict: ${scanResult.verdict}. Reason: ${scanResult.description}`,
          timestamp: Date.now(),
          details: {
            file_name,
            file_path: filePath,
            verdict: scanResult.verdict,
            risk_score: scanResult.score
          }
        }

        // 2. Log threat to database
        this.memoryEngine.logSecurityEvent(threatEvent)

        // 3. Trigger alert callback to UI
        onAlertCallback(threatEvent)

        // 4. Show OS notification
        await this.automation.showNotification(
          '🚨 JARVIS Security Shield',
          `Threat blocked in downloads: ${file_name}`
        )

        console.warn(`[Watchdog] Security Threat Intercepted: ${file_name}`)
      } else {
        console.log(`[Watchdog] Scan completed: ${path.basename(filePath)} is SAFE`)
      }
    } catch (err) {
      console.warn(`[Watchdog] Scan error on ${path.basename(filePath)}:`, err)
    }
  }

  /** Make request to local FastAPI scanner */
  private async scanFileViaBackend(filePath: string): Promise<any> {
    const response = await fetch('http://127.0.0.1:8000/api/malware/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  }
}
