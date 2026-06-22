// ============================================================
// AEGIS — First-Run Onboarding Wizard
// Glass card wizard: terms acceptance, permission toggles, get started
// ============================================================

import { useState } from 'react'

interface OnboardingProps {
  onComplete: () => void
}

interface Permission {
  key: string
  name: string
  desc: string
  icon: React.ReactNode
  default: boolean
}

const PERMISSIONS: Permission[] = [
  {
    key: 'screen_monitoring',
    name: 'Screen Monitoring',
    desc: 'Analyze on-screen content to detect phishing and social engineering in real time.',
    default: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
      </svg>
    )
  },
  {
    key: 'clipboard_monitoring',
    name: 'Clipboard Monitoring',
    desc: 'Scan clipboard contents to warn about malicious links and exposed credentials.',
    default: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" />
      </svg>
    )
  },
  {
    key: 'network_protection',
    name: 'Network Protection',
    desc: 'Monitor network traffic to block connections to known malicious endpoints.',
    default: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    )
  }
]

function Onboarding({ onComplete }: OnboardingProps): React.JSX.Element {
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [permissions, setPermissions] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PERMISSIONS.map((p) => [p.key, p.default]))
  )

  const togglePermission = (key: string): void => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleGetStarted = async (): Promise<void> => {
    try {
      await window.electronAPI.setPreference('onboarding_completed', 'true')
      // Persist individual permission choices
      for (const [key, enabled] of Object.entries(permissions)) {
        await window.electronAPI.setPreference(key, String(enabled))
      }
    } catch (err) {
      console.error('[Onboarding] Failed to save preferences:', err)
    }
    onComplete()
  }

  return (
    <div className="onboarding-wrapper">
      <div className="onboarding-card">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="onboarding-header">
          <div className="onboarding-logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path
                d="M20 3L6 10v10c0 9.05 5.97 17.52 14 19.5 8.03-1.98 14-10.45 14-19.5V10L20 3z"
                fill="currentColor"
                opacity="0.15"
              />
              <path
                d="M20 3L6 10v10c0 9.05 5.97 17.52 14 19.5 8.03-1.98 14-10.45 14-19.5V10L20 3z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
                fill="none"
              />
              <path
                d="M20 12v8M20 24h.01"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h2>Welcome to AEGIS</h2>
          <span className="onboarding-subtitle">
            Your AI-powered security companion for real-time threat detection and privacy protection.
          </span>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="onboarding-body">
          {/* Terms & Privacy */}
          <div className="onboarding-section">
            <span className="onboarding-section-title">Terms &amp; Privacy</span>
            <div className="terms-scroll-box">
              AEGIS processes data locally on your device. Screen captures, clipboard content, and
              network metadata are analyzed in real time and never transmitted to external servers.
              All threat detection models run on-device. You may revoke any permission at any time
              from Settings. By continuing, you acknowledge that AEGIS will monitor the enabled
              data sources below solely for security analysis and that you have read and agree to
              the privacy policy.
            </div>
            <label className="onboarding-checkbox-label">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              I agree to the terms and privacy policy
            </label>
          </div>

          {/* Permissions */}
          <div className="onboarding-section">
            <span className="onboarding-section-title">Permissions</span>
            <div className="permission-items">
              {PERMISSIONS.map((perm) => (
                <div className="permission-item" key={perm.key}>
                  <div className="permission-info">
                    <span className="permission-name">{perm.name}</span>
                    <span className="permission-desc">{perm.desc}</span>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={permissions[perm.key]}
                      onChange={() => togglePermission(perm.key)}
                    />
                    <span className="slider round" />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="onboarding-footer">
          <button
            className="btn btn-primary"
            disabled={!termsAccepted}
            onClick={handleGetStarted}
            style={{ width: '100%' }}
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  )
}

export default Onboarding
