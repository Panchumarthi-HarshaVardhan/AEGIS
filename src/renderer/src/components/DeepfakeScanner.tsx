// ============================================================
// AEGIS UI — Deepfake Scanner Panel
// Drag/drop media files for synthetic face/voice detection
// ============================================================

import React, { useState } from 'react'
import * as Icons from './Icons'

interface DeepfakeResult {
  success: boolean
  type: 'video' | 'audio'
  verdict: 'AUTHENTIC' | 'SUSPICIOUS' | 'DEEPFAKE' | 'CLONED_AUDIO'
  probability: number
  metadata: Record<string, any>
  reasons: string[]
  error?: string
}

const DeepfakeScanner: React.FC = () => {
  const [filePath, setFilePath] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<DeepfakeResult | null>(null)

  const handleScan = async (): Promise<void> => {
    if (!filePath.trim() || isLoading) return
    setIsLoading(true)
    setResult(null)

    // Normalize path (strip quotes if any)
    const cleanedPath = filePath.trim().replace(/^['"]|['"]$/g, '')

    try {
      const scanRes = await window.electronAPI.checkDeepfake(cleanedPath)
      setResult(scanRes)
    } catch (err) {
      console.error('[DeepfakeScanner] Scan call failed:', err)
      setResult({
        success: false,
        type: 'video',
        verdict: 'AUTHENTIC',
        probability: 0,
        metadata: {},
        reasons: [],
        error: `Deepfake scan execution failed: ${err instanceof Error ? err.message : String(err)}`
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle local drag-and-drop file path extraction
  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (file as any).path) {
      setFilePath((file as any).path)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
  }

  const getVerdictClass = (verdict: string): string => {
    switch (verdict) {
      case 'AUTHENTIC':
        return 'badge-safe'
      case 'SUSPICIOUS':
        return 'badge-warning'
      case 'DEEPFAKE':
      case 'CLONED_AUDIO':
      default:
        return 'badge-danger'
    }
  }

  return (
    <div className="security-dashboard animate-fade-in">
      <h2>
        <Icons.Scan size={20} className="stat-card-icon" />
        Synthetic Media & Deepfake Scanner
      </h2>
      <p className="text-muted" style={{ marginBottom: '20px', marginTop: '-12px', fontSize: '13px' }}>
        Performs spectral analysis on voice files or frequency artifact audits on face frames to identify synthetic generation.
      </p>

      {/* Drag & Drop portal */}
      <div
        className="dropzone-container"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <Icons.Download size={40} className="dropzone-icon" style={{ margin: '0 auto 12px' }} />
        <p style={{ fontSize: '14px', color: 'var(--aegis-text-secondary)' }}>
          Drag and drop video (MP4/MOV) or audio (MP3/WAV) files here, or enter the local path below:
        </p>

        <div style={{ display: 'flex', gap: '8px', maxWidth: '600px', margin: '20px auto 0' }}>
          <input
            type="text"
            className="input-glass"
            style={{ flex: 1 }}
            placeholder="/Users/username/Movies/clip.mp4"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleScan}
            disabled={isLoading || !filePath.trim()}
          >
            {isLoading ? 'Scanning...' : 'Scan File'}
          </button>
        </div>
      </div>

      {/* Results details */}
      {result && (
        <div className="animate-scale-in">
          {result.error ? (
            <div
              className="glass-panel"
              style={{
                padding: '16px',
                borderLeft: '4px solid var(--aegis-red)',
                color: 'var(--aegis-red)',
                fontSize: '14px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}
            >
              <Icons.AlertTriangle size={16} />
              {result.error}
            </div>
          ) : (
            <>
              {/* Stats row */}
              <div className="stat-cards" style={{ marginBottom: '20px' }}>
                <div className="stat-card">
                  <Icons.Activity size={24} className="stat-card-icon" />
                  <span className="stat-card-value">
                    {Math.round(result.probability * 100)}%
                  </span>
                  <span className="stat-card-label">Manipulation Probability</span>
                </div>

                <div className="stat-card">
                  <Icons.Newspaper size={24} className="stat-card-icon" />
                  <span style={{ fontSize: '14px', marginTop: '8px', display: 'inline-block' }}>
                    <span className={`badge ${getVerdictClass(result.verdict)}`}>
                      {result.verdict.replace('_', ' ')}
                    </span>
                  </span>
                  <span className="stat-card-label">Scanner Verdict</span>
                </div>

                <div className="stat-card">
                  <Icons.Shield size={24} className="stat-card-icon" />
                  <span className="stat-card-value" style={{ fontSize: '18px', marginTop: '10px' }}>
                    {result.type.toUpperCase()}
                  </span>
                  <span className="stat-card-label">Media Type</span>
                </div>
              </div>

              {/* Reasons timeline list */}
              <div className="event-timeline">
                <div className="event-timeline-title">Audit Log Findings</div>
                {result.reasons.map((reason, idx) => (
                  <div
                    key={idx}
                    className={`event-item ${
                      result.verdict === 'AUTHENTIC' ? 'low' : result.verdict === 'SUSPICIOUS' ? 'medium' : 'high'
                    }`}
                  >
                    <div className="event-icon">
                      {result.verdict === 'AUTHENTIC' ? <Icons.CheckCircle size={16} /> : <Icons.AlertTriangle size={16} />}
                    </div>
                    <div className="event-content">
                      <div className="event-description" style={{ fontSize: '13px', color: 'var(--aegis-text-primary)' }}>
                        {reason}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Metadata log table */}
              <div className="glass-panel" style={{ padding: '20px', marginTop: '24px' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--aegis-text-secondary)' }}>
                  File Meta Specifications
                </h3>
                <table className="table-container">
                  <tbody>
                    {Object.entries(result.metadata).map(([key, val]) => (
                      <tr key={key} className="table-row">
                        <td className="table-cell-key">
                          {key.replace('_', ' ')}
                        </td>
                        <td className="table-cell-val">
                          {String(val)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default DeepfakeScanner
