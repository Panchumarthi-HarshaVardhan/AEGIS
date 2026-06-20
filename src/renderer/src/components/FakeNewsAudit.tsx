// ============================================================
// AEGIS UI — Fake News Audit Panel
// Pastes in text for claim-based credibility checks
// ============================================================

import React, { useState } from 'react'
import * as Icons from './Icons'

interface ClaimDetail {
  claim: string
  evidence: string
  status: 'VERIFIED' | 'DISPROVEN' | 'UNVERIFIED'
  confidence: number
}

interface FakeNewsResult {
  verdict: 'CREDIBLE' | 'UNVERIFIED_CLAIMS' | 'HIGHLY_SUSPICIOUS' | 'ERROR'
  risk_score: number
  claims: ClaimDetail[]
  summary: string
}

const FakeNewsAudit: React.FC = () => {
  const [text, setText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<FakeNewsResult | null>(null)

  const handleAudit = async (): Promise<void> => {
    if (!text.trim() || isLoading) return
    setIsLoading(true)
    setResult(null)

    try {
      const auditRes = await window.electronAPI.checkFakeNews(text)
      setResult(auditRes)
    } catch (err) {
      console.error('[FakeNewsAudit] Audit call failed:', err)
      setResult({
        verdict: 'ERROR',
        risk_score: 0,
        claims: [],
        summary: `Audit execution failed: ${err instanceof Error ? err.message : String(err)}`
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getVerdictClass = (verdict: string): string => {
    switch (verdict) {
      case 'CREDIBLE':
        return 'badge-safe'
      case 'UNVERIFIED_CLAIMS':
        return 'badge-warning'
      case 'HIGHLY_SUSPICIOUS':
      default:
        return 'badge-danger'
    }
  }

  const getClaimStatusClass = (status: string): string => {
    switch (status) {
      case 'VERIFIED':
        return 'low' // green border
      case 'UNVERIFIED':
        return 'medium' // orange border
      case 'DISPROVEN':
      default:
        return 'high' // red border
    }
  }

  return (
    <div className="security-dashboard animate-fade-in">
      <h2>
        <Icons.Newspaper size={20} className="stat-card-icon" />
        Fake News & Claim Audit
      </h2>
      <p className="text-muted" style={{ marginBottom: '20px', marginTop: '-12px', fontSize: '13px' }}>
        Extracts factual claims from articles and cross-references them against verified public knowledge consensus.
      </p>

      {/* Audit Input Form */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <textarea
          className="input-glass"
          style={{
            width: '100%',
            height: '140px',
            resize: 'none',
          }}
          placeholder="Paste article text or claim sentences here to audit..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isLoading}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAudit}
            disabled={isLoading || !text.trim()}
          >
            {isLoading ? (
              <>
                <Icons.Sparkle size={14} style={{ animation: 'spin 2s linear infinite' }} />
                Auditing Claims...
              </>
            ) : (
              'Verify Article'
            )}
          </button>
        </div>
      </div>

      {/* Result presentation */}
      {result && (
        <div className="animate-scale-in">
          {/* Top row cards */}
          <div className="stat-cards" style={{ marginBottom: '20px' }}>
            <div className="stat-card">
              <Icons.Activity size={24} className="stat-card-icon" />
              <span className="stat-card-value">{result.risk_score}/100</span>
              <span className="stat-card-label">Misinformation Score</span>
            </div>

            <div className="stat-card">
              <Icons.Document size={24} className="stat-card-icon" />
              <span style={{ fontSize: '14px', marginTop: '8px', display: 'inline-block' }}>
                <span className={`badge ${getVerdictClass(result.verdict)}`}>
                  {result.verdict.replace('_', ' ')}
                </span>
              </span>
              <span className="stat-card-label">Credibility Verdict</span>
            </div>

            <div className="stat-card">
              <Icons.Search size={24} className="stat-card-icon" />
              <span className="stat-card-value">{result.claims.length}</span>
              <span className="stat-card-label">Audited assertions</span>
            </div>
          </div>

          {/* Verdict summary */}
          <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '10px', color: 'var(--aegis-text-secondary)' }}>
              Executive Audit Summary
            </h3>
            <p style={{ fontSize: '13px', lineHeight: '1.55', color: 'var(--aegis-text-primary)' }}>{result.summary}</p>
          </div>

          {/* Factual assertions breakdown list */}
          {result.claims.length > 0 && (
            <div className="event-timeline">
              <div className="event-timeline-title">Factual Breakdown Details</div>
              {result.claims.map((claim, idx) => (
                <div key={idx} className={`event-item ${getClaimStatusClass(claim.status)}`}>
                  <div className="event-icon">
                    {claim.status === 'VERIFIED' ? <Icons.CheckCircle size={16} /> : claim.status === 'UNVERIFIED' ? <Icons.AlertTriangle size={16} /> : <Icons.XCircle size={16} />}
                  </div>
                  <div className="event-content">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--aegis-text-primary)' }}>
                        "{claim.claim}"
                      </strong>
                      <span className="event-timestamp" style={{ textTransform: 'uppercase', fontSize: '10px', fontWeight: 600 }}>
                        {claim.status} ({Math.round(claim.confidence * 100)}% conf)
                      </span>
                    </div>
                    <div className="event-description" style={{ marginTop: '6px', fontSize: '12px' }}>
                      {claim.evidence}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default FakeNewsAudit
