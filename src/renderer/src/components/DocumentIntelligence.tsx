// ============================================================
// AEGIS UI — Document Intelligence Panel
// Upload PDF/DOCX files for summarization and security audits
// ============================================================

import React, { useState } from 'react'
import * as Icons from './Icons'

interface DocumentResult {
  success: boolean
  file_name: string
  file_size_bytes: number
  text_length: number
  summary: string
  security: {
    approved: boolean
    reason: string
  }
  error?: string
}

const DocumentIntelligence: React.FC = () => {
  const [filePath, setFilePath] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<DocumentResult | null>(null)

  const handleAnalyze = async (): Promise<void> => {
    if (!filePath.trim() || isLoading) return
    setIsLoading(true)
    setResult(null)

    // Normalize path
    const cleanedPath = filePath.trim().replace(/^['"]|['"]$/g, '')

    try {
      const docRes = await window.electronAPI.summarizeDocument(cleanedPath)
      setResult(docRes)
    } catch (err) {
      console.error('[DocumentIntelligence] Analysis failed:', err)
      setResult({
        success: false,
        file_name: '',
        file_size_bytes: 0,
        text_length: 0,
        summary: '',
        security: { approved: true, reason: '' },
        error: `Document analysis execution failed: ${err instanceof Error ? err.message : String(err)}`
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

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const mb = bytes / (1024 * 1024)
    if (mb > 1) return `${mb.toFixed(2)} MB`
    const kb = bytes / 1024
    return `${kb.toFixed(1)} KB`
  }

  return (
    <div className="security-dashboard animate-fade-in">
      <h2>
        <Icons.Document size={20} className="stat-card-icon" />
        Document Intelligence & Audit
      </h2>
      <p className="text-muted" style={{ marginBottom: '20px', marginTop: '-12px', fontSize: '13px' }}>
        Extracts document text (PDF, DOCX, slides) to perform AI-driven summaries and runs safety audits for hidden prompt injection threats.
      </p>

      {/* Drag & Drop portal */}
      <div
        className="dropzone-container"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <Icons.Download size={40} className="dropzone-icon" style={{ margin: '0 auto 12px' }} />
        <p style={{ fontSize: '14px', color: 'var(--aegis-text-secondary)' }}>
          Drag and drop PDF or Word documents here, or enter the local path below:
        </p>

        <div style={{ display: 'flex', gap: '8px', maxWidth: '600px', margin: '20px auto 0' }}>
          <input
            type="text"
            className="input-glass"
            style={{ flex: 1 }}
            placeholder="/Users/username/Documents/resume.pdf"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={isLoading || !filePath.trim()}
          >
            {isLoading ? 'Reading...' : 'Analyze Document'}
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
              {/* Stats Cards */}
              <div className="stat-cards" style={{ marginBottom: '20px' }}>
                <div className="stat-card">
                  <Icons.Activity size={24} className="stat-card-icon" />
                  <span className="stat-card-value">{formatBytes(result.file_size_bytes)}</span>
                  <span className="stat-card-label">Document File Size</span>
                </div>

                <div className="stat-card">
                  <Icons.Shield size={24} className="stat-card-icon" />
                  <span style={{ fontSize: '14px', marginTop: '8px', display: 'inline-block' }}>
                    <span className={`badge ${result.security.approved ? 'badge-safe' : 'badge-danger'}`}>
                      {result.security.approved ? 'CLEARED' : 'THREAT BLOCKED'}
                    </span>
                  </span>
                  <span className="stat-card-label">Security Clearance</span>
                </div>

                <div className="stat-card">
                  <Icons.Document size={24} className="stat-card-icon" />
                  <span className="stat-card-value" style={{ fontSize: '22px', marginTop: '4px' }}>
                    {result.text_length}
                  </span>
                  <span className="stat-card-label">Characters Extracted</span>
                </div>
              </div>

              {/* Security alerts details if injection detected */}
              {!result.security.approved && (
                <div
                  className="glass-panel"
                  style={{
                    padding: '16px',
                    background: 'rgba(255, 69, 58, 0.08)',
                    borderLeft: '4px solid var(--aegis-red)',
                    color: 'var(--aegis-text-primary)',
                    fontSize: '13px',
                    marginBottom: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <strong style={{ color: 'var(--aegis-red)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <Icons.AlertTriangle size={16} />
                    Document Security Warning:
                  </strong>
                  <p>{result.security.reason}</p>
                </div>
              )}

              {/* Document Summary display */}
              <div className="glass-panel" style={{ padding: '24px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                <h3 style={{ fontSize: '14px', color: 'var(--aegis-text-secondary)', marginBottom: '14px', borderBottom: '1px solid var(--aegis-separator)', paddingBottom: '8px' }}>
                  AI Analysis & Content Report
                </h3>
                <div style={{ fontSize: '13px', color: 'var(--aegis-text-primary)' }}>
                  {result.summary}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default DocumentIntelligence
