// ============================================================
// JARVIS V3 — AI Engine Orchestrator
// Coordinates execution flow across specialized agents:
// Intent Agent → Planner Agent → Security Agent → Execution Agent
// ============================================================

import { randomUUID } from 'crypto'
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
    onApprovalRequired: (request: ApprovalRequest) => void
  ): Promise<JarvisResponse> {
    // 1. Memory Agent: Log user message in history
    const userMsg: ConversationMessage = {
      id: randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    }
    this.memoryAgent.addMessage(userMsg)

    // 2. Intent Agent: Classify user goal
    const history = this.memoryAgent.getHistory(6)
    const intent = await this.intentAgent.parseIntent(text, history)

    // 3. Planner Agent: Create step-by-step action plan
    const plan = this.plannerAgent.plan(intent)

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
    const inputVerdict = await this.securityEngine.evaluate(intent, text)
    
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
    const responseText = lastResult?.success
      ? `✅ ${intent.natural_response}`
      : `❌ Failed: ${lastResult?.error || 'Execution failure'}`

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
}
