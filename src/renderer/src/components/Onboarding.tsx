// ============================================================
// AEGIS UI — Onboarding & Permissions Setup
// Apple-style first-run setup wizard
// ============================================================

import React, { useState } from 'react'
import * as Icons from './Icons'

interface OnboardingProps {
  onComplete: () => void
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [voiceCallsEnabled, setVoiceCallsEnabled] = useState(true)
  const [screenOcrEnabled, setScreenOcrEnabled] = useState(true)
  const [clipboardBrowserEnabled, setClipboardBrowserEnabled] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const handleConfirm = async (): Promise<void> => {
    if (!termsAccepted || isSaving) return
    setIsSaving(true)

    try {
      // Save preferences persistently in SQLite via IPC
      await window.electronAPI.setPreference('onboarding_completed', 'true')
      await window.electronAPI.setPreference('permission_voice_calls', voiceCallsEnabled ? 'true' : 'false')
      await window.electronAPI.setPreference('permission_screen_ocr', screenOcrEnabled ? 'true' : 'false')
      await window.electronAPI.setPreference('permission_clipboard_browser', clipboardBrowserEnabled ? 'true' : 'false')
      
      onComplete()
    } catch (err) {
      console.error('[Onboarding] Failed to save setup configurations:', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="onboarding-wrapper">
      <div className="onboarding-card animate-scale-in">
        {/* Header Section */}
        <div className="onboarding-header">
          <Icons.Shield size={32} className="onboarding-logo" />
          <h2>Welcome to AEGIS</h2>
          <p className="onboarding-subtitle">Privacy-First AI Operating Companion & Security Copilot</p>
        </div>

        {/* Content Area */}
        <div className="onboarding-body">
          
          {/* Section 1: Terms and Conditions */}
          <div className="onboarding-section">
            <label className="onboarding-section-title">Terms & Conditions</label>
            <div className="terms-scroll-box">
              <p>
                AEGIS runs as a localized system companion. By enabling protection, you authorize AEGIS to monitor key system events locally, including file downloads, clipboard modifications, browser navigation logs, and active application focus swaps. 
              </p>
              <p style={{ marginTop: '8px' }}>
                All sensitive information scans, developer API credential scanning, and screen OCR captures occur strictly locally in your device RAM and SQLite logs. We do not transmit passwords, credentials, or raw audio call logs to remote servers. Natural language processing is routed securely through local or chosen cloud LLM APIs.
              </p>
            </div>
            <label className="onboarding-checkbox-label" htmlFor="accept-terms">
              <input
                id="accept-terms"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <span>I accept the AEGIS Terms and Conditions</span>
            </label>
          </div>

          {/* Section 2: Permissions Configuration */}
          <div className="onboarding-section" style={{ marginTop: '12px' }}>
            <label className="onboarding-section-title">Configure System Security Permissions</label>
            
            <div className="permission-items">
              
              {/* Permission Item 1 */}
              <div className="permission-item">
                <div className="permission-info">
                  <div className="permission-name">Voice & Video Call Auditing</div>
                  <div className="permission-desc">Allows Call Guardian to process call transcripts locally to flag potential bank fraud and OTP scams.</div>
                </div>
                <label className="switch" htmlFor="toggle-voice">
                  <input
                    id="toggle-voice"
                    type="checkbox"
                    checked={voiceCallsEnabled}
                    onChange={(e) => setVoiceCallsEnabled(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              {/* Permission Item 2 */}
              <div className="permission-item">
                <div className="permission-info">
                  <div className="permission-name">Screen Capture & OCR</div>
                  <div className="permission-desc">Allows capturing the desktop area to perform local text OCR extraction when requested.</div>
                </div>
                <label className="switch" htmlFor="toggle-screen">
                  <input
                    id="toggle-screen"
                    type="checkbox"
                    checked={screenOcrEnabled}
                    onChange={(e) => setScreenOcrEnabled(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              {/* Permission Item 3 */}
              <div className="permission-item">
                <div className="permission-info">
                  <div className="permission-name">Clipboard & Browser Monitoring</div>
                  <div className="permission-desc">Monitors clipboard additions for credential leaks and audits browser navigations for phishing.</div>
                </div>
                <label className="switch" htmlFor="toggle-clipboard">
                  <input
                    id="toggle-clipboard"
                    type="checkbox"
                    checked={clipboardBrowserEnabled}
                    onChange={(e) => setClipboardBrowserEnabled(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="onboarding-footer">
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px' }}
            disabled={!termsAccepted || isSaving}
            onClick={handleConfirm}
          >
            {isSaving ? 'Configuring System...' : 'Confirm & Launch AEGIS'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Onboarding
