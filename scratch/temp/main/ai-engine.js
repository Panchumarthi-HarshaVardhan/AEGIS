"use strict";
// ============================================================
// JARVIS V3 — AI Engine Orchestrator
// Coordinates execution flow across specialized agents:
// Intent Agent → Planner Agent → Security Agent → Execution Agent
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIEngine = void 0;
const crypto_1 = require("crypto");
class AIEngine {
    intentAgent;
    plannerAgent;
    securityAgent;
    actionAgent;
    memoryAgent;
    riskEngine;
    securityEngine;
    // Pending approvals
    pendingApprovals = new Map();
    constructor(intentAgent, plannerAgent, securityAgent, actionAgent, memoryAgent, riskEngine, securityEngine) {
        this.intentAgent = intentAgent;
        this.plannerAgent = plannerAgent;
        this.securityAgent = securityAgent;
        this.actionAgent = actionAgent;
        this.memoryAgent = memoryAgent;
        this.riskEngine = riskEngine;
        this.securityEngine = securityEngine;
    }
    /** Run the core multi-agent execution pipeline on a user message */
    async processCommand(text, onApprovalRequired) {
        // 1. Memory Agent: Log user message in history
        const userMsg = {
            id: (0, crypto_1.randomUUID)(),
            role: 'user',
            content: text,
            timestamp: Date.now()
        };
        this.memoryAgent.addMessage(userMsg);
        // 2. Intent Agent: Classify user goal
        const intent = await this.intentAgent.parseIntent(text);
        // 3. Planner Agent: Create step-by-step action plan
        const plan = this.plannerAgent.plan(intent);
        // 3.5. central SecurityEngine validation (Prompt Injection, secrets scanning, phishing URL checks)
        const inputVerdict = await this.securityEngine.evaluate(intent, text);
        // If prompt injection or critical secret is blocked immediately
        if (!inputVerdict.approved && !inputVerdict.requires_approval) {
            const blockedMsg = {
                id: (0, crypto_1.randomUUID)(),
                role: 'assistant',
                content: `🛡️ Security Gateway Blocked Action: ${inputVerdict.reason}`,
                timestamp: Date.now(),
                intent,
                security: inputVerdict
            };
            this.memoryAgent.addMessage(blockedMsg);
            return { message: blockedMsg.content, intent, security: inputVerdict };
        }
        // 4. Security Agent / Risk Engine validation (Combine inputs and planned step risks)
        let requiresApproval = inputVerdict.requires_approval;
        let maxRisk = inputVerdict.risk_level;
        let reasons = inputVerdict.reason ? [inputVerdict.reason] : [];
        for (const step of plan.steps) {
            const verdict = this.securityAgent.evaluateStep(step);
            if (verdict.risk_level > maxRisk)
                maxRisk = verdict.risk_level;
            if (verdict.requires_approval)
                requiresApproval = true;
            if (verdict.reason)
                reasons.push(verdict.reason);
        }
        const securityVerdict = {
            approved: maxRisk < 3, // Block risk 3 automatically if no confirmation
            risk_level: maxRisk,
            requires_approval: requiresApproval,
            reason: reasons.filter(r => r && r !== 'Approved by security agent').join('; ') || 'Approved by security agent'
        };
        // 5. If blocked, abort immediately
        if (!securityVerdict.approved && !securityVerdict.requires_approval) {
            const blockedMsg = {
                id: (0, crypto_1.randomUUID)(),
                role: 'assistant',
                content: `🛡️ Security Agent Blocked Action: ${securityVerdict.reason}`,
                timestamp: Date.now(),
                intent,
                security: securityVerdict
            };
            this.memoryAgent.addMessage(blockedMsg);
            return { message: blockedMsg.content, intent, security: securityVerdict };
        }
        // 6. User Approval Engine: Request explicit user confirmation if flagged
        if (securityVerdict.requires_approval) {
            const approvalId = (0, crypto_1.randomUUID)();
            const approvalRequest = {
                id: approvalId,
                action: intent.intent,
                description: intent.natural_response,
                risk_level: securityVerdict.risk_level,
                timeout_ms: 30000,
                details: intent.entities
            };
            // Fire callback to prompt Electron UI
            onApprovalRequired(approvalRequest);
            // Await confirmation
            const approved = await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    this.pendingApprovals.delete(approvalId);
                    resolve(false); // auto-deny on timeout
                }, 30000);
                this.pendingApprovals.set(approvalId, { resolve, timeout });
            });
            if (!approved) {
                const deniedMsg = {
                    id: (0, crypto_1.randomUUID)(),
                    role: 'assistant',
                    content: '❌ Automation execution denied by user.',
                    timestamp: Date.now(),
                    intent,
                    security: securityVerdict
                };
                this.memoryAgent.addMessage(deniedMsg);
                return { message: deniedMsg.content, intent, security: securityVerdict };
            }
        }
        // 7. Execution Agent: Dispatch automation steps
        let lastResult;
        for (const step of plan.steps) {
            const result = await this.actionAgent.execute(step);
            lastResult = result;
            if (!result.success)
                break;
        }
        // 8. Log results to Memory Agent
        const responseText = lastResult?.success
            ? `✅ ${intent.natural_response}`
            : `❌ Failed: ${lastResult?.error || 'Execution failure'}`;
        const assistantMsg = {
            id: (0, crypto_1.randomUUID)(),
            role: 'assistant',
            content: responseText,
            timestamp: Date.now(),
            intent,
            security: securityVerdict,
            action_result: lastResult
        };
        this.memoryAgent.addMessage(assistantMsg);
        return {
            message: responseText,
            intent,
            security: securityVerdict,
            action_result: lastResult
        };
    }
    /** Resolve a pending user confirmation choice */
    handleApprovalResponse(approvalId, approved) {
        const pending = this.pendingApprovals.get(approvalId);
        if (pending) {
            clearTimeout(pending.timeout);
            pending.resolve(approved);
            this.pendingApprovals.delete(approvalId);
            return { success: true, action: 'approve', message: approved ? 'Approved' : 'Denied' };
        }
        return { success: false, action: 'approve', message: 'Approval expired' };
    }
}
exports.AIEngine = AIEngine;
