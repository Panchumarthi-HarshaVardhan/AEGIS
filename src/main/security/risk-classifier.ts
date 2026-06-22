// ============================================================
// JARVIS Guardian AI — Risk Classifier
// Determines risk levels and approval requirements for actions
// ============================================================

import type { ParsedIntent, RiskLevel } from '../../shared/types'

/** Result of risk classification */
export interface RiskClassification {
  /** Risk level: 0=auto, 1=confirm, 2=always confirm, 3=never auto */
  level: RiskLevel
  /** Whether the user must explicitly approve this action */
  requires_approval: boolean
  /** Human-readable explanation for the risk assessment */
  reason: string
}

/** Domains considered safe for auto-open (Level 0) */
const SAFE_DOMAINS: ReadonlySet<string> = new Set([
  'google.com',
  'youtube.com',
  'wikipedia.org',
  'github.com',
  'stackoverflow.com',
  'developer.mozilla.org',
  'apple.com',
  'microsoft.com',
  'docs.google.com',
  'drive.google.com',
  'notion.so',
  'figma.com',
  'spotify.com',
  'reddit.com',
  'medium.com',
  'linkedin.com'
])

/** Actions that escalate file_operation risk to Level 1 */
const LEVEL1_FILE_ACTIONS: ReadonlySet<string> = new Set([
  'download',
  'delete',
  'remove',
  'move',
  'rename',
  'install',
  'uninstall'
])

/** Actions that always require Level 2 confirmation */
const LEVEL2_ACTIONS: ReadonlySet<string> = new Set([
  'send_email',
  'send',
  'email',
  'upload',
  'post',
  'share',
  'publish',
  'tweet'
])

/** Keywords in entities or actions that trigger Level 3 (critical) */
const LEVEL3_KEYWORDS: ReadonlySet<string> = new Set([
  'bank',
  'banking',
  'payment',
  'pay',
  'transfer',
  'transaction',
  'password',
  'otp',
  'crypto',
  'bitcoin',
  'ethereum',
  'wallet',
  'credit_card',
  'creditcard',
  'wire',
  'venmo',
  'paypal',
  'zelle'
])

/**
 * Classifies the risk level of parsed intents.
 *
 * Evaluates the intent type, extracted entities, and specific action
 * keywords to determine how risky an operation is and whether it
 * requires explicit user approval before execution.
 *
 * Risk Levels:
 * - **0 (Auto)**: Safe actions like opening apps, playing music, browsing safe URLs
 * - **1 (Confirm)**: Moderate actions like file downloads, deletions, software installs
 * - **2 (Always Confirm)**: Sensitive actions like sending emails, uploading, posting
 * - **3 (Never Auto)**: Critical actions involving banking, payments, credentials
 *
 * @example
 * ```ts
 * const classifier = new RiskClassifier()
 * const risk = classifier.classify(parsedIntent)
 * if (risk.requires_approval) {
 *   await promptUser(risk.reason)
 * }
 * ```
 */
export class RiskClassifier {
  /**
   * Classifies the risk level of a parsed intent.
   *
   * Evaluates the intent type and its entities to determine the
   * appropriate risk level and whether user approval is required.
   *
   * @param intent - The parsed intent to classify
   * @returns Risk classification with level, approval requirement, and reason
   */
  classify(intent: ParsedIntent): RiskClassification {
    const action = (intent.entities.action ?? '').toLowerCase()
    if (intent.intent === 'system_control' && (action === 'ocr_screen' || action === 'audit_screen_links')) {
      return {
        level: 0,
        requires_approval: false,
        reason: `System control "${action}" is a safe security check`
      }
    }

    // Always check for Level 3 (critical) keywords first — highest priority
    const criticalCheck = this.checkCriticalKeywords(intent)
    if (criticalCheck) return criticalCheck

    // Check for Level 2 (sensitive) actions
    const sensitiveCheck = this.checkSensitiveActions(intent)
    if (sensitiveCheck) return sensitiveCheck

    // Evaluate based on intent type
    switch (intent.intent) {
      case 'open_app':
        return this.classifyOpenApp(intent)

      case 'play_music':
        return {
          level: 0,
          requires_approval: false,
          reason: 'Playing music is a safe action'
        }

      case 'open_url':
        return this.classifyOpenUrl(intent)

      case 'search_web':
        return {
          level: 0,
          requires_approval: false,
          reason: 'Web search is a safe, read-only action'
        }

      case 'search_product':
        return {
          level: 0,
          requires_approval: false,
          reason: 'Product search is a safe, read-only action'
        }

      case 'file_operation':
        return this.classifyFileOperation(intent)

      case 'summarize':
        return this.classifySummarize(intent)

      case 'system_control':
        return this.classifySystemControl(intent)

      case 'unknown':
        return {
          level: 0,
          requires_approval: false,
          reason: 'Unknown intent — no action to execute'
        }

      default:
        return {
          level: 1,
          requires_approval: true,
          reason: 'Unrecognized intent type requires confirmation'
        }
    }
  }

  /**
   * Checks all entity values and the action for Level 3 critical keywords.
   * @param intent - The parsed intent
   * @returns RiskClassification if critical keywords found, null otherwise
   */
  private checkCriticalKeywords(intent: ParsedIntent): RiskClassification | null {
    const valuesToCheck = [
      ...Object.values(intent.entities),
      intent.intent
    ]

    for (const value of valuesToCheck) {
      const lower = value.toLowerCase()
      for (const keyword of LEVEL3_KEYWORDS) {
        if (lower.includes(keyword)) {
          return {
            level: 3,
            requires_approval: true,
            reason: `Critical action detected: involves "${keyword}" — requires explicit approval`
          }
        }
      }
    }

    return null
  }

  /**
   * Checks for Level 2 sensitive actions in entities.
   * @param intent - The parsed intent
   * @returns RiskClassification if sensitive action found, null otherwise
   */
  private checkSensitiveActions(intent: ParsedIntent): RiskClassification | null {
    const action = (intent.entities.action ?? '').toLowerCase()

    if (LEVEL2_ACTIONS.has(action)) {
      return {
        level: 2,
        requires_approval: true,
        reason: `Sensitive action "${action}" requires user confirmation`
      }
    }

    // Check for upload/send keywords in any entity value
    const allValues = Object.values(intent.entities).join(' ').toLowerCase()
    for (const sensitiveAction of LEVEL2_ACTIONS) {
      if (allValues.includes(sensitiveAction)) {
        return {
          level: 2,
          requires_approval: true,
          reason: `Action involves "${sensitiveAction}" which requires user confirmation`
        }
      }
    }

    return null
  }

  /**
   * Classifies risk for open_app intents.
   * @param intent - The parsed intent
   * @returns Risk classification
   */
  private classifyOpenApp(intent: ParsedIntent): RiskClassification {
    const appName = (intent.entities.app_name ?? '').toLowerCase()

    // Terminal/shell apps are slightly riskier
    const riskyApps = new Set(['terminal', 'iterm', 'warp', 'console', 'shell'])
    if (riskyApps.has(appName)) {
      return {
        level: 1,
        requires_approval: true,
        reason: `Opening "${appName}" provides shell access — confirming with user`
      }
    }

    return {
      level: 0,
      requires_approval: false,
      reason: `Opening "${appName || 'application'}" is a safe action`
    }
  }

  /**
   * Classifies risk for open_url intents.
   * Checks the URL domain against the safe domains list.
   * @param intent - The parsed intent
   * @returns Risk classification
   */
  private classifyOpenUrl(intent: ParsedIntent): RiskClassification {
    const url = intent.entities.url ?? ''

    try {
      const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname
      const domain = this.extractRootDomain(hostname)

      if (SAFE_DOMAINS.has(domain)) {
        return {
          level: 0,
          requires_approval: false,
          reason: `"${domain}" is a recognized safe domain`
        }
      }
    } catch {
      // Invalid URL — can't verify domain safety
    }

    return {
      level: 0,
      requires_approval: false,
      reason: `Opening URL is generally safe`
    }
  }

  /**
   * Classifies risk for file_operation intents.
   * @param intent - The parsed intent
   * @returns Risk classification
   */
  private classifyFileOperation(intent: ParsedIntent): RiskClassification {
    const action = (intent.entities.action ?? '').toLowerCase()
    const filePath = (intent.entities.file_path ?? '').toLowerCase()

    // Enforce approval for executables and scripts being opened
    const executableExts = ['.sh', '.bash', '.zsh', '.command', '.app', '.dmg', '.pkg', '.exe', '.bat', '.cmd', '.vbs', '.js', '.py', '.pl', '.rb']
    const isExecutable = executableExts.some(ext => filePath.endsWith(ext))
    if (isExecutable) {
      return {
        level: 2,
        requires_approval: true,
        reason: `Opening an executable or script file ("${filePath}") requires user confirmation`
      }
    }

    if (LEVEL1_FILE_ACTIONS.has(action)) {
      return {
        level: 1,
        requires_approval: true,
        reason: `File operation "${action}" modifies the filesystem — requires confirmation`
      }
    }

    // Read-only file operations (list, search, read)
    return {
      level: 0,
      requires_approval: false,
      reason: 'Read-only file operation is safe'
    }
  }

  /**
   * Classifies risk for summarize intents.
   * Checks if summarization involves uploading data.
   * @param intent - The parsed intent
   * @returns Risk classification
   */
  private classifySummarize(intent: ParsedIntent): RiskClassification {
    const allValues = Object.values(intent.entities).join(' ').toLowerCase()

    if (allValues.includes('upload') || allValues.includes('send')) {
      return {
        level: 2,
        requires_approval: true,
        reason: 'Summarization involves data upload — requires confirmation'
      }
    }

    return {
      level: 0,
      requires_approval: false,
      reason: 'Local summarization is a safe action'
    }
  }

  /**
   * Classifies risk for system_control intents.
   * @param intent - The parsed intent
   * @returns Risk classification
   */
  private classifySystemControl(intent: ParsedIntent): RiskClassification {
    const action = (intent.entities.action ?? '').toLowerCase()

    if (action === 'automate_app') {
      const appName = (intent.entities.app_name ?? '').toLowerCase()
      const blacklisted = [
        'keychain', 'system settings', 'systemsettings', 'system preferences', 'systempreferences',
        'app store', 'appstore', '1password', 'bitwarden', 'lastpass', 'dashlane', 'keeper',
        'terminal', 'iterm', 'warp', 'console', 'activity monitor', 'activitymonitor',
        'paypal', 'stripe', 'venmo', 'ledger', 'coinbase', 'banking'
      ]

      if (blacklisted.some(item => appName.includes(item))) {
        return {
          level: 3,
          requires_approval: true,
          reason: `Critical block: Automation of sensitive app "${intent.entities.app_name}" is prohibited to protect security and payments.`
        }
      }

      return {
        level: 0,
        requires_approval: false,
        reason: `Requesting GUI automation in the application "${intent.entities.app_name}".`
      }
    }

    // Safe system controls
    const safeControls = new Set([
      'set_volume',
      'brightness',
      'dark_mode',
      'light_mode',
      'mute',
      'unmute',
      'ocr_screen',
      'audit_screen_links',
      'scan_for_malware',
      'set_alarm',
      'set_reminder',
      'security_status'
    ])

    if (safeControls.has(action)) {
      return {
        level: 0,
        requires_approval: false,
        reason: `System control "${action}" is a safe adjustment`
      }
    }

    // Risky system controls
    const riskyControls = new Set([
      'shutdown',
      'restart',
      'sleep',
      'logout',
      'lock'
    ])

    if (riskyControls.has(action)) {
      return {
        level: 1,
        requires_approval: true,
        reason: `System control "${action}" affects system state — requires confirmation`
      }
    }

    return {
      level: 1,
      requires_approval: true,
      reason: 'Unknown system control action requires confirmation'
    }
  }

  /**
   * Extracts the root domain (e.g., "google.com") from a full hostname.
   * @param hostname - Full hostname like "www.docs.google.com"
   * @returns Root domain like "google.com"
   */
  private extractRootDomain(hostname: string): string {
    const parts = hostname.split('.')
    if (parts.length <= 2) return hostname
    return parts.slice(-2).join('.')
  }
}
