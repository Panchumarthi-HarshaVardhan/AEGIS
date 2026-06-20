// ============================================================
// JARVIS V3 — Automation Guardian
// Intercepts all desktop automation steps and enforces user confirmations
// based on action safety levels (Safe, Confirm, Always Blocked)
// ============================================================

import { BaseGuardian } from './base-guardian'
import type { ActionStep } from '../engines/planner-engine'
import type { RiskLevel } from '../../shared/types'

export interface AutomationVerdict {
  approved: boolean
  requires_approval: boolean
  risk_level: RiskLevel
  reason: string
}

export class AutomationGuardian extends BaseGuardian {
  constructor() {
    super('AutomationGuardian')
  }

  protected initialize(): void {}

  /** Inspect a plan step and return security verdict */
  evaluateStep(step: ActionStep): AutomationVerdict {
    try {
      if (!this.active) {
        return { approved: true, requires_approval: false, risk_level: 0, reason: '' }
      }

      const action = step.action.toLowerCase()
      const params = JSON.stringify(step.params || {}).toLowerCase()

      // 1. Level 3: Critical (Strictly require confirmation / payments & banking)
      if (
        action.includes('payment') ||
        action.includes('bank') ||
        action.includes('transfer') ||
        params.includes('credit card') ||
        params.includes('cvv') ||
        params.includes('pin') ||
        params.includes('otp') ||
        params.includes('password')
      ) {
        this.reportThreat(90, `BLOCKED AUTOMATION: Unauthorized banking or sensitive credential action detected: ${step.action}`, { step })
        return {
          approved: false,
          requires_approval: true,
          risk_level: 3,
          reason: 'Sensitive banking, payment, or OTP access is always blocked from automatic execution.'
        }
      }

      // 2. Enforce system power state changes approval
      if (action === 'system_power') {
        const powerAction = (step.params.action || '').toLowerCase()
        this.reportThreat(75, `APPROVAL REQUIRED: Automation requested system power action: ${powerAction}`, { step })
        return {
          approved: true,
          requires_approval: true,
          risk_level: 2,
          reason: `Automation requires approval to execute system power operation: "${powerAction}".`
        }
      }

      // 3. Enforce risky utility applications opening approval
      if (action === 'open_app') {
        const appName = (step.params.app_name || step.params.name || '').toLowerCase()
        const riskyApps = new Set([
          'terminal', 'iterm', 'warp', 'console', 'shell', 
          'activity monitor', 'disk utility', 'keychain access', 
          'system settings', 'system preferences', 'installer'
        ])
        if (riskyApps.has(appName)) {
          this.reportThreat(50, `APPROVAL REQUIRED: Automation requested to open a system utility application: ${appName}`, { step })
          return {
            approved: true,
            requires_approval: true,
            risk_level: 1,
            reason: `Automation requires approval to open system utility application: "${appName}".`
          }
        }
      }

      // 4. Enforce script/executable opening approval
      if (action === 'file_open') {
        const filePath = (step.params.file_path || step.params.query || '').toLowerCase()
        const executableExts = ['.sh', '.bash', '.zsh', '.command', '.app', '.dmg', '.pkg', '.exe', '.bat', '.cmd', '.vbs', '.js', '.py', '.pl', '.rb']
        const isExecutable = executableExts.some(ext => filePath.endsWith(ext))
        if (isExecutable) {
          this.reportThreat(70, `APPROVAL REQUIRED: Automation requested to open script/executable file: ${filePath}`, { step })
          return {
            approved: true,
            requires_approval: true,
            risk_level: 2,
            reason: `Automation requires approval to run script or installer file: "${filePath}".`
          }
        }
      }

      // 5. Level 2 & 1: Requires Approval (file deletes, copies, installs, email sending)
      if (
        action.includes('delete') ||
        action.includes('remove') ||
        action.includes('uninstall') ||
        action.includes('copy') ||
        action.includes('email') ||
        action.includes('mail') ||
        action.includes('send') ||
        action.includes('install')
      ) {
        this.reportThreat(45, `APPROVAL REQUIRED: Automation requested critical action: ${step.action}`, { step })
        return {
          approved: true,
          requires_approval: true,
          risk_level: 2,
          reason: `Automation requires approval to modify system files, software, or send communications.`
        }
      }

      // 6. Level 0: Safe (open app, search, play music)
      return {
        approved: true,
        requires_approval: false,
        risk_level: 0,
        reason: ''
      }
    } catch (err) {
      this.logError('Error evaluating step safety, failing secure (requiring approval):', err)
      return {
        approved: false,
        requires_approval: true,
        risk_level: 3,
        reason: 'Error evaluating step safety. Security engine failed secure.'
      }
    }
  }
}
