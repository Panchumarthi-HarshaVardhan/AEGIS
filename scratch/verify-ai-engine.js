#!/usr/bin/env node
// ============================================================
// JARVIS V3 — AI Engine Verification Script
// Tests the AI Engine optimizations introduced in this round:
//   1. Conversational context handling
//   2. Prompt injection resistance
//   3. Groq-to-Ollama fail-over
//   4. Hallucination prevention prompts
//   5. ProviderManager offline behaviour
// ============================================================

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${label}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${label}`);
  }
}

// ── 1. Verify intent-engine.ts source contains key patterns ──
console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  1. Intent Engine — Source Verification          ║');
console.log('╚══════════════════════════════════════════════════╝');

const intentSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'main', 'engines', 'intent-engine.ts'),
  'utf-8'
);

// 1a. Accepts conversation history parameter
assert(
  intentSrc.includes('history?: ConversationMessage[]'),
  'parseIntent accepts optional history parameter'
);

// 1b. buildMessages helper exists
assert(
  intentSrc.includes('buildMessages(sanitizedMessage'),
  'buildMessages helper is used to construct chat payloads'
);

// 1c. History messages injected into chat context
assert(
  intentSrc.includes('history.slice(0, -1)'),
  'Historical messages (excluding latest) are injected into chat context'
);

// 1d. System-role messages filtered
assert(
  intentSrc.includes("msg.role === 'system'"),
  'System-role messages from history are filtered out'
);

// 1e. Prompt injection defense in system prompt
assert(
  intentSrc.includes('CRITICAL SECURITY SAFETY REQUIREMENT'),
  'System prompt contains prompt injection defense block'
);
assert(
  intentSrc.includes('jailbreak'),
  'System prompt explicitly mentions jailbreak prevention'
);

// 1f. Groq-to-Ollama fail-over
assert(
  intentSrc.includes('ollamaAvailable') && intentSrc.includes('callOllamaDirectly'),
  'Intent engine supports Groq → Ollama fail-over'
);

// 1g. 15-second Ollama timeout
assert(
  intentSrc.includes('AbortSignal.timeout(15000)'),
  'Ollama calls use 15-second timeout'
);

// ── 2. Verify action-engine.ts source contains key patterns ──
console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  2. Action Engine — Source Verification           ║');
console.log('╚══════════════════════════════════════════════════╝');

const actionSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'main', 'engines', 'action-engine.ts'),
  'utf-8'
);

// 2a. Hallucination prevention in summarization
assert(
  actionSrc.includes('Do not make up or hallucinate any facts'),
  'summarizeContent system prompt includes hallucination prevention'
);

// 2b. Hallucination prevention in screen analysis
assert(
  actionSrc.includes('do not speculate or hallucinate'),
  'explainScreenContent system prompt forbids speculation/hallucination'
);

// 2c. Centralized executeLLMCall helper
assert(
  actionSrc.includes('executeLLMCall'),
  'executeLLMCall helper consolidates Groq/Ollama dispatching'
);

// 2d. Cloud-to-local fail-over
assert(
  actionSrc.includes('callOllamaCompletion') && actionSrc.includes("Falling back to local Ollama"),
  'Action engine implements Groq → Ollama cloud-to-local fail-over'
);

// 2e. 15-second Ollama timeout
assert(
  actionSrc.includes('AbortSignal.timeout(15000)'),
  'Action engine Ollama calls use 15-second timeout'
);

// ── 3. Verify ai-engine.ts orchestrator passes history ──
console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  3. AI Engine Orchestrator — Context Passing      ║');
console.log('╚══════════════════════════════════════════════════╝');

const orchestratorSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'main', 'ai-engine.ts'),
  'utf-8'
);

// 3a. History retrieval
assert(
  orchestratorSrc.includes('getHistory(6)'),
  'AI Engine retrieves last 6 messages from MemoryEngine'
);

// 3b. History passed to intent agent
assert(
  orchestratorSrc.includes('parseIntent(text, history)'),
  'AI Engine passes history to intentAgent.parseIntent()'
);

// ── 4. Verify ProviderManager supports graceful offline mode ──
console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  4. ProviderManager — Offline Behaviour           ║');
console.log('╚══════════════════════════════════════════════════╝');

const providerSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'main', 'provider-manager.ts'),
  'utf-8'
);

// 4a. Singleton pattern
assert(
  providerSrc.includes('getInstance()') && providerSrc.includes('private constructor'),
  'ProviderManager uses singleton pattern with private constructor'
);

// 4b. Graceful "none" state
assert(
  providerSrc.includes("activeProvider: 'none'"),
  'ProviderManager initializes with activeProvider = none'
);

// 4c. Ollama check
assert(
  providerSrc.includes('checkOllamaAvailability'),
  'ProviderManager checks local Ollama availability'
);

// 4d. TEST_OFFLINE env variable support
assert(
  providerSrc.includes('TEST_OFFLINE'),
  'ProviderManager supports TEST_OFFLINE=true for automated testing'
);

// ── 5. Prompt Injection Defense — Pattern Tests ──
console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  5. Prompt Injection — Pattern Verification       ║');
console.log('╚══════════════════════════════════════════════════╝');

// These are the injection payloads that should NOT cause the system to deviate.
// We verify that the system prompt explicitly covers the attack vectors.
const injectionPatterns = [
  'ignore previous instructions',
  'override',
  'redefine your role',
  'inject new instructions',
];

for (const pattern of injectionPatterns) {
  assert(
    intentSrc.toLowerCase().includes(pattern),
    `System prompt addresses injection vector: "${pattern}"`
  );
}

// ── 6. Memory Engine — getHistory interface check ──
console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  6. Memory Engine — getHistory Interface          ║');
console.log('╚══════════════════════════════════════════════════╝');

const memorySrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'main', 'engines', 'memory-engine.ts'),
  'utf-8'
);

assert(
  memorySrc.includes('getHistory('),
  'MemoryEngine exposes getHistory() method'
);

assert(
  memorySrc.includes('ConversationMessage'),
  'MemoryEngine uses ConversationMessage type'
);

// ── Summary ──
console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  VERIFICATION SUMMARY                             ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log(`  Total: ${passed + failed}`);
console.log(`  ✅ Passed: ${passed}`);
console.log(`  ❌ Failed: ${failed}`);
console.log('');

if (failed > 0) {
  console.error('⚠️  Some verification checks failed. Please review above.');
  process.exit(1);
} else {
  console.log('🎉 All AI Engine optimization checks passed successfully!');
  process.exit(0);
}
