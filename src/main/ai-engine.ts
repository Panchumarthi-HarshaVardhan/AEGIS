// ============================================================
// JARVIS V3 — AI Engine Orchestrator
// Coordinates execution flow across specialized agents:
// Intent Agent → Planner Agent → Security Agent → Execution Agent
// ============================================================

import { randomUUID } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { Notification } from 'electron'
import { EventBus } from './event-bus'
import type { IntentEngine } from './engines/intent-engine'
import type { PlannerEngine } from './engines/planner-engine'
import type { ActionEngine } from './engines/action-engine'
import type { MemoryEngine } from './engines/memory-engine'
import type { AutomationGuardian } from './guardians/automation-guardian'
import type { RiskEngine } from './risk-engine'
import type { SecurityEngine } from './engines/security-engine'
import type {
  JarvisResponse,
  ConversationMessage,
  SecurityVerdict,
  ActionResult,
  ApprovalRequest
} from '../shared/types'
import { SimulationEngine } from './engines/simulation-engine'
import { ProviderManager } from './provider-manager'


export class AIEngine {
  private intentAgent: IntentEngine
  private plannerAgent: PlannerEngine
  private securityAgent: AutomationGuardian
  private actionAgent: ActionEngine
  private memoryAgent: MemoryEngine
  private riskEngine: RiskEngine
  private securityEngine: SecurityEngine
  
  // Pending approvals
  private pendingApprovals = new Map<string, {
    resolve: (approved: boolean) => void
    timeout: ReturnType<typeof setTimeout>
  }>()

  constructor(
    intentAgent: IntentEngine,
    plannerAgent: PlannerEngine,
    securityAgent: AutomationGuardian,
    actionAgent: ActionEngine,
    memoryAgent: MemoryEngine,
    riskEngine: RiskEngine,
    securityEngine: SecurityEngine
  ) {
    this.intentAgent = intentAgent
    this.plannerAgent = plannerAgent
    this.securityAgent = securityAgent
    this.actionAgent = actionAgent
    this.memoryAgent = memoryAgent
    this.riskEngine = riskEngine
    this.securityEngine = securityEngine
  }

  /** Run the core multi-agent execution pipeline on a user message */
  async processCommand(
    text: string,
    onApprovalRequired: (request: ApprovalRequest) => void,
    isVoiceInput?: boolean,
    attachmentPath?: string
  ): Promise<JarvisResponse> {
    let promptWithAttachment = text
    let attachmentDetailText = ''
    let attachmentImageBase64: string | undefined
    let attachmentImageMime: string | undefined

    if (attachmentPath && fs.existsSync(attachmentPath)) {
      const fileName = path.basename(attachmentPath)
      try {
        const scanResult = await this.scanFile(attachmentPath)
        
        if (scanResult.status === 'DANGEROUS') {
          // Block immediately
          const report = {
            id: randomUUID(),
            guardian: 'AIEngine',
            score: 95,
            severity: 'high' as const,
            description: `MALWARE INTERCEPTED: Attachment "${fileName}" failed security scan. Reason: ${scanResult.description}`,
            details: { file_name: fileName, file_path: attachmentPath, verdict: 'DANGEROUS' },
            timestamp: Date.now()
          }
          EventBus.getInstance().publish('threat:detected', report)

          if (Notification.isSupported()) {
            new Notification({
              title: '🚨 AEGIS Malware Blocked',
              body: `Attachment "${fileName}" failed safety scan.`
            }).show()
          }

          const blockedMsg: ConversationMessage = {
            id: randomUUID(),
            role: 'assistant',
            content: `🛡️ Security Gateway Blocked Action: Attached file "${fileName}" failed malware check. Scan verdict: DANGEROUS. Reason: ${scanResult.description}`,
            timestamp: Date.now()
          }
          this.memoryAgent.addMessage(blockedMsg)
          return { message: blockedMsg.content }
        } else {
          // Notify safe attachment
          const report = {
            id: randomUUID(),
            guardian: 'AIEngine',
            score: 10,
            severity: 'low' as const,
            description: `Attachment scan completed: "${fileName}" is SAFE. No malware detected.`,
            details: { file_name: fileName, file_path: attachmentPath, verdict: 'SAFE' },
            timestamp: Date.now()
          }
          EventBus.getInstance().publish('threat:detected', report)

          if (Notification.isSupported()) {
            new Notification({
              title: '✅ AEGIS Attachment Scan',
              body: `Attachment "${fileName}" is safe.`
            }).show()
          }

          // 2. Extract content based on extension
          const ext = path.extname(attachmentPath).toLowerCase()
          if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].includes(ext)) {
            // Read image as base64 for direct visual analysis by the LLM vision model
            const mimeMap: Record<string, string> = {
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.webp': 'image/webp',
              '.gif': 'image/gif',
              '.bmp': 'image/bmp'
            }
            attachmentImageBase64 = fs.readFileSync(attachmentPath).toString('base64')
            attachmentImageMime = mimeMap[ext] || 'image/jpeg'
            attachmentDetailText = ` [Image "${fileName}" attached — analyzing visually]`
          } else {
            const docAnalysis = await this.analyzeDoc(attachmentPath)
            if (docAnalysis.success) {
              attachmentDetailText = `\n\n[Attached Document Analysis/Summary of "${fileName}"]:\n${docAnalysis.summary}`
            } else {
              attachmentDetailText = `\n\n[Attached File: ${fileName}]`
            }
          }
          promptWithAttachment = text + attachmentDetailText
        }
      } catch (err) {
        console.error('[AIEngine] Failed processing attachment:', err)
      }
    }

    // 1. Memory Agent: Log user message in history
    const userMsg: ConversationMessage = {
      id: randomUUID(),
      role: 'user',
      content: text + (attachmentDetailText ? ` (Attached: ${path.basename(attachmentPath!)})` : ''),
      timestamp: Date.now()
    }
    this.memoryAgent.addMessage(userMsg)

    // 2. Intent Agent: Classify user goal
    const history = this.memoryAgent.getHistory(6)
    const intent = await this.intentAgent.parseIntent(promptWithAttachment, history)

    // 2.1. Early return for conversational/informational queries
    // If intent is 'unknown', the user is asking a question or chatting — not requesting an action.
    // Use the AI provider to generate a helpful response instead of planning an action.
    // If an image was attached, pass it for direct visual analysis.
    if (intent.intent === 'unknown') {
      const conversationalResponse = await this.generateConversationalResponse(
        promptWithAttachment, history, attachmentImageBase64, attachmentImageMime
      )
      const assistantMsg: ConversationMessage = {
        id: randomUUID(),
        role: 'assistant',
        content: conversationalResponse,
        timestamp: Date.now(),
        intent
      }
      this.memoryAgent.addMessage(assistantMsg)
      return { message: conversationalResponse, intent }
    }

    // 3. Planner Agent: Create step-by-step action plan
    const plan = this.plannerAgent.plan(intent)

    // 3.0. If the plan is a single noop step, return the natural response directly
    if (plan.steps.length === 1 && plan.steps[0].action === 'noop') {
      const noopMsg: ConversationMessage = {
        id: randomUUID(),
        role: 'assistant',
        content: intent.natural_response || "I'm not sure how to help with that. Could you rephrase?",
        timestamp: Date.now(),
        intent
      }
      this.memoryAgent.addMessage(noopMsg)
      return { message: noopMsg.content, intent }
    }

    // 3.1. Verification stage on the plan
    const verificationResult = this.plannerAgent.verify(plan)
    if (!verificationResult.valid) {
      const blockedMsg: ConversationMessage = {
        id: randomUUID(),
        role: 'assistant',
        content: `🛡️ Action Plan Verification Failed: ${verificationResult.errors.join('; ')}`,
        timestamp: Date.now(),
        intent
      }
      this.memoryAgent.addMessage(blockedMsg)
      return { message: blockedMsg.content, intent }
    }

    // 3.2. Simulation stage (dry-run)
    const simulationResult = SimulationEngine.getInstance().simulate(plan)
    if (!simulationResult.safe || simulationResult.blockers.length > 0) {
      const blockedMsg: ConversationMessage = {
        id: randomUUID(),
        role: 'assistant',
        content: `🛡️ Simulation Blocked Execution: ${simulationResult.blockers.join('; ')}`,
        timestamp: Date.now(),
        intent
      }
      this.memoryAgent.addMessage(blockedMsg)
      return { message: blockedMsg.content, intent }
    }

    // 3.5. central SecurityEngine validation (Prompt Injection, secrets scanning, phishing URL checks)
    const inputVerdict = await this.securityEngine.evaluate(intent, promptWithAttachment)
    
    // If prompt injection or critical secret is blocked immediately
    if (!inputVerdict.approved && !inputVerdict.requires_approval) {
      const blockedMsg: ConversationMessage = {
        id: randomUUID(),
        role: 'assistant',
        content: `🛡️ Security Gateway Blocked Action: ${inputVerdict.reason}`,
        timestamp: Date.now(),
        intent,
        security: inputVerdict
      }
      this.memoryAgent.addMessage(blockedMsg)
      return { message: blockedMsg.content, intent, security: inputVerdict }
    }

    // 4. Security Agent / Risk Engine validation (Combine inputs and planned step risks)
    let requiresApproval = inputVerdict.requires_approval
    let maxRisk = inputVerdict.risk_level
    let reasons: string[] = inputVerdict.reason ? [inputVerdict.reason] : []

    for (const step of plan.steps) {
      const verdict = this.securityAgent.evaluateStep(step)
      if (verdict.risk_level > maxRisk) maxRisk = verdict.risk_level
      if (verdict.requires_approval) requiresApproval = true
      if (verdict.reason) reasons.push(verdict.reason)
    }

    if (simulationResult.warnings.length > 0) {
      reasons.push(...simulationResult.warnings)
      requiresApproval = true
    }

    const securityVerdict: SecurityVerdict = {
      approved: maxRisk < 3, // Block risk 3 automatically if no confirmation
      risk_level: maxRisk as any,
      requires_approval: requiresApproval,
      reason: reasons.filter(r => r && r !== 'Approved by security agent').join('; ') || 'Approved by security agent'
    }

    // 5. If blocked, abort immediately
    if (!securityVerdict.approved && !securityVerdict.requires_approval) {
      const blockedMsg: ConversationMessage = {
        id: randomUUID(),
        role: 'assistant',
        content: `🛡️ Security Agent Blocked Action: ${securityVerdict.reason}`,
        timestamp: Date.now(),
        intent,
        security: securityVerdict
      }
      this.memoryAgent.addMessage(blockedMsg)
      return { message: blockedMsg.content, intent, security: securityVerdict }
    }

    // 6. User Approval Engine: Request explicit user confirmation if flagged
    if (securityVerdict.requires_approval) {
      const approvalId = randomUUID()
      const warningText = simulationResult.warnings.length > 0
        ? `\n\nSimulation Warnings:\n- ${simulationResult.warnings.join('\n- ')}`
        : ''
      const approvalRequest: ApprovalRequest = {
        id: approvalId,
        action: intent.intent,
        description: `${intent.natural_response}${warningText}`,
        risk_level: securityVerdict.risk_level,
        timeout_ms: 30000,
        details: intent.entities
      }

      // Fire callback to prompt Electron UI
      onApprovalRequired(approvalRequest)

      // Await confirmation
      const approved = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          this.pendingApprovals.delete(approvalId)
          resolve(false) // auto-deny on timeout
        }, 30000)
        this.pendingApprovals.set(approvalId, { resolve, timeout })
      })

      if (!approved) {
        const deniedMsg: ConversationMessage = {
          id: randomUUID(),
          role: 'assistant',
          content: '❌ Automation execution denied by user.',
          timestamp: Date.now(),
          intent,
          security: securityVerdict
        }
        this.memoryAgent.addMessage(deniedMsg)
        return { message: deniedMsg.content, intent, security: securityVerdict }
      }
    }

    // 7. Execution Agent: Dispatch automation steps
    let lastResult: ActionResult | undefined
    for (const step of plan.steps) {
      const result = await this.actionAgent.execute(step)
      lastResult = result
      if (!result.success) break
    }

    // 8. Log results to Memory Agent
    let responseText = ''
    if (lastResult?.success) {
      if (lastResult.action === 'ocr_screen' || lastResult.action === 'audit_screen_links' || lastResult.action === 'security_status') {
        responseText = lastResult.message
      } else {
        responseText = `✅ ${lastResult.message || intent.natural_response}`
      }
    } else {
      responseText = `❌ Failed: ${lastResult?.error || lastResult?.message || 'Execution failure'}`
    }

    const assistantMsg: ConversationMessage = {
      id: randomUUID(),
      role: 'assistant',
      content: responseText,
      timestamp: Date.now(),
      intent,
      security: securityVerdict,
      action_result: lastResult
    }
    this.memoryAgent.addMessage(assistantMsg)

    return {
      message: responseText,
      intent,
      security: securityVerdict,
      action_result: lastResult
    }
  }


  /** Generate a conversational AI response for non-actionable queries.
   *  When imageBase64 + imageMime are provided the user message is built as a
   *  multi-part vision message so the LLM actually *sees* the attached image. */
  private async generateConversationalResponse(
    text: string,
    history: ConversationMessage[],
    imageBase64?: string,
    imageMime?: string
  ): Promise<string> {
    const systemPrompt = `You are AEGIS Guardian AI, a security-first AI desktop companion. You protect users from deepfakes, phishing, malware, scam calls, and credential leaks.

Your capabilities include:
- 🛡️ Real-time phishing URL detection and blocking
- 🎭 Deepfake audio and video analysis
- 📰 Fake news verification
- 📞 Scam call transcript analysis
- 🔒 Secret/credential leak prevention (API keys, passwords, credit cards)
- 🖥️ Screen content analysis (OCR) and threat auditing
- 🤖 Desktop automation (open apps, play music, search the web, control system settings)
- 📄 Document summarization
- 🦠 File malware scanning

When the user attaches an image, analyze it thoroughly and answer their question about it.
When users ask what you can do, explain your capabilities clearly and concisely.
When users ask general questions, answer helpfully and naturally.
Keep responses concise and professional. Do not use markdown headers. Use emoji sparingly for key points.`

    const messages: any[] = [{ role: 'system', content: systemPrompt }]

    // Include recent conversation context (text-only for history)
    for (const msg of history.slice(-4)) {
      if (msg.role === 'system') continue
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      })
    }

    // Build user message: multi-part vision message when image is attached,
    // plain text otherwise.
    if (imageBase64 && imageMime) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text },
          { type: 'image_url', image_url: { url: `data:${imageMime};base64,${imageBase64}` } }
        ]
      })
    } else {
      messages.push({ role: 'user', content: text })
    }

    try {
      return await ProviderManager.getInstance().getChatCompletion(messages, {
        temperature: 0.7,
        maxTokens: 1024
      })
    } catch (err) {
      console.error('[AIEngine] Conversational response failed:', err)
      return "I'm AEGIS Guardian AI — your security-first desktop companion. I can check URLs for phishing, analyze files for deepfakes, scan for malware, explain your screen, detect scam calls, and automate your desktop. How can I help?"
    }
  }

  /** Resolve a pending user confirmation choice */
  handleApprovalResponse(approvalId: string, approved: boolean): ActionResult {
    const pending = this.pendingApprovals.get(approvalId)
    if (pending) {
      clearTimeout(pending.timeout)
      pending.resolve(approved)
      this.pendingApprovals.delete(approvalId)
      return { success: true, action: 'approve', message: approved ? 'Approved' : 'Denied' }
    }
    return { success: false, action: 'approve', message: 'Approval expired' }
  }

  private async scanFile(filePath: string): Promise<any> {
    const response = await fetch('http://127.0.0.1:8000/api/malware/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath })
    })
    if (!response.ok) throw new Error(`Malware Scan HTTP ${response.status}`)
    return response.json()
  }

  private async extractOcr(filePath: string): Promise<string> {
    const response = await fetch('http://127.0.0.1:8000/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath })
    })
    if (!response.ok) throw new Error(`OCR HTTP ${response.status}`)
    const res = await response.json()
    return res.text || 'No text detected in image.'
  }

  private async analyzeDoc(filePath: string): Promise<any> {
    const response = await fetch('http://127.0.0.1:8000/api/document/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath })
    })
    if (!response.ok) throw new Error(`Document Analysis HTTP ${response.status}`)
    return response.json()
  }
}
