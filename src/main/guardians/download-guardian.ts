// ============================================================
// JARVIS V3 — Download Guardian
// Watches the OS Downloads directory and triggers malware and YARA scans
// ============================================================

import * as fs from 'fs'
import * as path from 'path'
import { app, Notification } from 'electron'
import { BaseGuardian } from './base-guardian'
import { EventBus } from '../event-bus'

const IGNORED_TEMP_EXTENSIONS = new Set([
  '.crdownload', // Chrome
  '.download',   // Safari
  '.tmp',        // Firefox / generic
  '.part'        // Firefox
])

export class DownloadGuardian extends BaseGuardian {
  private declare downloadsPath: string
  private declare watcher: fs.FSWatcher | null
  private declare scannedFiles: Set<string>

  constructor() {
    super('DownloadGuardian')
  }

  protected initialize(): void {
    if (this.downloadsPath === undefined) this.downloadsPath = ''
    if (this.watcher === undefined) this.watcher = null
    if (this.scannedFiles === undefined) this.scannedFiles = new Set()

    // Start watching downloads directory
    this.startWatcher()
  }

  private startWatcher(): void {
    if (this.watcher) {
      this.stop()
    }

    try {
      this.downloadsPath = app.getPath('downloads')
    } catch (err) {
      this.logWarn('app.getPath("downloads") failed, trying fallback:', err)
    }

    if (!this.downloadsPath) {
      const os = require('os')
      this.downloadsPath = path.join(os.homedir(), 'Downloads')
    }

    this.log(`Watching downloads: ${this.downloadsPath}`)
    try {
      this.watcher = fs.watch(this.downloadsPath, (eventType, filename) => {
        if (eventType === 'rename' && filename) {
          const filePath = path.join(this.downloadsPath, filename)
          this.handleFileChange(filePath).catch((err) => {
            this.logError('Error scanning file:', err)
          })
        }
      })
    } catch (err) {
      this.logError('Failed to watch downloads folder:', err)
    }
  }

  /** Close file watcher on shutdown */
  stop(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }

  override setActive(active: boolean): void {
    super.setActive(active)
    if (!active) {
      this.stop()
    }
  }

  private async handleFileChange(filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase()
    if (IGNORED_TEMP_EXTENSIONS.has(ext)) return
    if (!fs.existsSync(filePath)) return

    try {
      const stats = fs.statSync(filePath)
      if (stats.isDirectory()) return
    } catch {
      return
    }

    if (this.scannedFiles.has(filePath)) return
    this.scannedFiles.add(filePath)

    // Wait 500ms for browser to release lock
    await new Promise((resolve) => setTimeout(resolve, 500))
    if (!fs.existsSync(filePath)) return

    this.log(`File completed download, scanning: ${path.basename(filePath)}`)
    this.eventBus.publish('download:completed', filePath)

    try {
      const scanResult = await this.scanFileViaBackend(filePath)
      const fileName = path.basename(filePath)
      
      if (scanResult.status === 'DANGEROUS') {
        const score = scanResult.score || 95
        this.reportThreat(score, `MALWARE INTERCEPTED: Downloaded file "${fileName}" failed security check. Reason: ${scanResult.description}`, {
          file_name: fileName,
          file_path: filePath,
          verdict: scanResult.verdict,
          risk_score: score
        })

        if (Notification.isSupported()) {
          new Notification({
            title: '🚨 AEGIS Malware Blocked',
            body: `Downloaded file "${fileName}" failed safety scan.`
          }).show()
        }
      } else {
        // Safe download notification
        const report = {
          id: require('crypto').randomUUID(),
          guardian: this.name,
          score: 10, // low severity score
          severity: 'low' as const,
          description: `Download scan completed: "${fileName}" is SAFE. No threats detected.`,
          details: {
            file_name: fileName,
            file_path: filePath,
            verdict: 'SAFE'
          },
          timestamp: Date.now()
        }
        EventBus.getInstance().publish('threat:detected', report)

        if (Notification.isSupported()) {
          new Notification({
            title: '✅ AEGIS File Scan',
            body: `Downloaded file "${fileName}" is safe.`
          }).show()
        }
      }
    } catch (err) {
      this.logWarn(`Scan connection error on ${path.basename(filePath)}:`, err)
    }
  }

  private async scanFileViaBackend(filePath: string): Promise<any> {
    const response = await fetch('http://127.0.0.1:8000/api/malware/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath })
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }
}
