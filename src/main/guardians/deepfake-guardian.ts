// ============================================================
// JARVIS V3 — Deepfake Guardian
// Dispatches media scans to identify audio/video synthetic manipulation
// ============================================================

import { BaseGuardian } from './base-guardian'
import * as path from 'path'

export class DeepfakeGuardian extends BaseGuardian {
  constructor() {
    super('DeepfakeGuardian')
  }

  protected initialize(): void {
    // Registers to manual deepfake check requests or file downloads
    this.eventBus.subscribe('download:completed', async (filePath: string) => {
      if (!this.active) return
      
      const ext = path.extname(filePath).toLowerCase()
      const isMedia = ['.mp4', '.avi', '.mov', '.mp3', '.wav'].includes(ext)
      if (!isMedia) return
      
      try {
        const result = await this.scanDeepfake(filePath, ext)
        if (result.success && result.confidence > 0.7) {
          const score = Math.round(result.confidence * 100)
          this.reportThreat(score, `DEEPFAKE DETECTED: Synthetically modified media detected at "${path.basename(filePath)}". Confidence: ${score}%`, {
            file_name: path.basename(filePath),
            file_path: filePath,
            confidence: result.confidence,
            explanation: result.explanation
          })
        }
      } catch (err) {
        this.logWarn('Scan failed:', err)
      }
    })
  }

  private async scanDeepfake(filePath: string, ext: string): Promise<any> {
    const isAudio = ['.mp3', '.wav'].includes(ext)
    const endpoint = isAudio
      ? 'http://127.0.0.1:8000/api/deepfake/audio'
      : 'http://127.0.0.1:8000/api/deepfake/video'

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath })
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }
}
