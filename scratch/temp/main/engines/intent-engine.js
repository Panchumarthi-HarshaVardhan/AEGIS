"use strict";
// ============================================================
// JARVIS Guardian AI — Intent Engine
// Groq-powered natural language intent parser
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentEngine = void 0;
const provider_manager_1 = require("../provider-manager");
/** Configuration constants for the intent engine */
const MODEL = 'llama-3.3-70b-versatile';
const TEMPERATURE = 0.1;
const MAX_TOKENS = 1024;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
/** Valid intent types for validation */
const VALID_INTENTS = new Set([
    'open_app',
    'open_url',
    'search_web',
    'play_music',
    'search_product',
    'summarize',
    'system_control',
    'file_operation',
    'unknown'
]);
/** System prompt that instructs the model on how to classify intents */
const SYSTEM_PROMPT = `You are JARVIS Guardian AI's intent parser. Your job is to analyze user messages and extract structured intent data.

You MUST respond with a JSON object containing these fields:
- "intent": one of: "open_app", "open_url", "search_web", "play_music", "search_product", "summarize", "system_control", "file_operation", "unknown"
- "entities": an object with relevant extracted entities. Use these keys when applicable:
  - "app_name": application name to open
  - "url": URL to navigate to
  - "query": search query or general query text
  - "website": target website name
  - "song": song or music query
  - "platform": music/video platform (spotify, youtube, apple_music)
  - "file_path": file system path
  - "action": specific sub-action (e.g., "delete", "copy", "download", "set_volume", "brightness", "ocr_screen", "audit_screen_links", "scan_for_malware")
- "risk_level": integer 0-3 based on action risk:
  - 0: safe actions (open apps, search, play music, screen ocr)
  - 1: moderate actions (file downloads, installs, malware scans)
  - 2: sensitive actions (sending data, uploads, emails)
  - 3: critical actions (banking, payments, passwords)
- "confidence": float 0.0-1.0 indicating classification confidence
- "natural_response": a brief, helpful response to show the user describing what you understood and will do
- "steps": optional array of strings describing sub-steps for complex actions

Rules for Special Queries:
1. If the user asks to explain their screen, what is on their screen, or analyze/explain the screenshot, classify as:
   "intent": "system_control", "entities": { "action": "ocr_screen" }, "risk_level": 0
2. If the user asks if there is any harmful link, phishing URL, or security threat on their screen, classify as:
   "intent": "system_control", "entities": { "action": "audit_screen_links" }, "risk_level": 0
3. If the user asks to scan a file, app, download, or general query for malware or check its safety, classify as:
   "intent": "system_control", "entities": { "action": "scan_for_malware", "file_path": (extracted file path or query) }, "risk_level": 1

Be precise. If unsure, use "unknown" intent with lower confidence.
Always extract as many relevant entities as possible from the message.`;
/**
 * Groq-powered intent parsing engine.
 *
 * Classifies user messages into structured intents with entity extraction,
 * risk assessment, and natural language responses.
 *
 * @example
 * ```ts
 * const engine = new IntentEngine(process.env.GROQ_API_KEY!)
 * const intent = await engine.parseIntent('open spotify and play some jazz')
 * console.log(intent.intent) // 'play_music'
 * console.log(intent.entities) // { platform: 'spotify', song: 'jazz' }
 * ```
 */
class IntentEngine {
    client = null;
    /**
     * Creates a new IntentEngine instance.
     */
    constructor() {
        // No direct Groq API key required during construction
    }
    /**
     * Parses a user message into a structured intent.
     *
     * Uses the Groq LLM or local Ollama with structured JSON output to classify the message,
     * extract entities, assess risk, and generate a natural response.
     * Includes retry logic with exponential backoff for rate limit errors when using Groq.
     *
     * @param userMessage - The raw user input to parse
     * @returns Parsed intent with entities, risk level, and natural response
     * @throws {Error} If all retry attempts are exhausted or a non-retryable error occurs
     */
    async parseIntent(userMessage) {
        const sanitizedMessage = this.sanitizeInput(userMessage);
        if (sanitizedMessage.length === 0) {
            return this.createFallbackIntent('', "I didn't catch that. Could you please say something?");
        }
        const providerManager = provider_manager_1.ProviderManager.getInstance();
        const status = providerManager.getStatus();
        if (status.activeProvider === 'none') {
            return this.createFallbackIntent(sanitizedMessage, 'No AI provider is configured. Please configure a GROQ_API_KEY in your .env or run Ollama locally.');
        }
        let lastError = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                let content = null;
                if (status.activeProvider === 'groq') {
                    if (!this.client) {
                        const apiKey = process.env.GROQ_API_KEY || '';
                        const GroqSdk = require('groq-sdk');
                        this.client = new GroqSdk({ apiKey });
                    }
                    const completion = await this.client.chat.completions.create({
                        model: status.models.intent,
                        temperature: TEMPERATURE,
                        max_tokens: MAX_TOKENS,
                        response_format: { type: 'json_object' },
                        messages: [
                            { role: 'system', content: SYSTEM_PROMPT },
                            { role: 'user', content: sanitizedMessage }
                        ]
                    });
                    content = completion.choices?.[0]?.message?.content || null;
                }
                else if (status.activeProvider === 'ollama') {
                    const response = await fetch('http://127.0.0.1:11434/api/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: status.models.intent,
                            messages: [
                                { role: 'system', content: SYSTEM_PROMPT },
                                { role: 'user', content: sanitizedMessage }
                            ],
                            stream: false,
                            options: {
                                temperature: TEMPERATURE
                            },
                            format: 'json'
                        }),
                        signal: AbortSignal.timeout(30000)
                    });
                    if (!response.ok) {
                        throw new Error(`Ollama responded with status: ${response.status}`);
                    }
                    const data = (await response.json());
                    content = data.message?.content || null;
                }
                if (!content) {
                    throw new Error('Empty response from AI provider');
                }
                return this.parseResponse(content, sanitizedMessage);
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (status.activeProvider === 'groq' && this.isRateLimitError(error) && attempt < MAX_RETRIES) {
                    const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                    const jitter = Math.random() * backoffMs * 0.1;
                    console.warn(`IntentEngine: Rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}), ` +
                        `retrying in ${Math.round(backoffMs + jitter)}ms`);
                    await this.sleep(backoffMs + jitter);
                    continue;
                }
                // Non-retryable error or Ollama error or exhausted retries
                break;
            }
        }
        console.error('IntentEngine: All attempts failed:', lastError?.message);
        return this.createFallbackIntent(sanitizedMessage, "I'm having trouble processing that right now. Please try again in a moment.");
    }
    /**
     * Parses and validates the JSON response from the LLM.
     * @param content - Raw JSON string from the LLM
     * @param originalMessage - The original user message for fallback
     * @returns Validated ParsedIntent
     */
    parseResponse(content, originalMessage) {
        try {
            const parsed = JSON.parse(content);
            const intent = this.validateIntent(parsed.intent);
            const entities = this.validateEntities(parsed.entities);
            const riskLevel = this.validateRiskLevel(parsed.risk_level);
            const confidence = this.validateConfidence(parsed.confidence);
            const naturalResponse = typeof parsed.natural_response === 'string'
                ? parsed.natural_response
                : 'I\'ll handle that for you.';
            const steps = Array.isArray(parsed.steps)
                ? parsed.steps.filter((s) => typeof s === 'string')
                : undefined;
            return {
                intent,
                entities,
                risk_level: riskLevel,
                confidence,
                natural_response: naturalResponse,
                steps
            };
        }
        catch (parseError) {
            console.error('IntentEngine: Failed to parse LLM response:', parseError);
            return this.createFallbackIntent(originalMessage, 'I had trouble understanding that. Could you rephrase?');
        }
    }
    /**
     * Validates and normalizes the intent type.
     * @param intent - Raw intent value from LLM
     * @returns Validated IntentType
     */
    validateIntent(intent) {
        if (typeof intent === 'string' && VALID_INTENTS.has(intent)) {
            return intent;
        }
        return 'unknown';
    }
    /**
     * Validates and normalizes the entities object.
     * @param entities - Raw entities value from LLM
     * @returns Validated entities record
     */
    validateEntities(entities) {
        if (entities === null || typeof entities !== 'object' || Array.isArray(entities)) {
            return {};
        }
        const result = {};
        for (const [key, value] of Object.entries(entities)) {
            if (typeof value === 'string' && value.trim().length > 0) {
                result[key] = value.trim();
            }
            else if (typeof value === 'number' || typeof value === 'boolean') {
                result[key] = String(value);
            }
        }
        return result;
    }
    /**
     * Validates and clamps the risk level to 0-3.
     * @param riskLevel - Raw risk level from LLM
     * @returns Validated RiskLevel
     */
    validateRiskLevel(riskLevel) {
        if (typeof riskLevel === 'number' && Number.isInteger(riskLevel)) {
            return Math.max(0, Math.min(3, riskLevel));
        }
        return 0;
    }
    /**
     * Validates and clamps confidence to 0.0-1.0.
     * @param confidence - Raw confidence from LLM
     * @returns Validated confidence number
     */
    validateConfidence(confidence) {
        if (typeof confidence === 'number' && !Number.isNaN(confidence)) {
            return Math.max(0, Math.min(1, confidence));
        }
        return 0.5;
    }
    /**
     * Sanitizes user input to prevent prompt injection.
     * Trims and limits input length.
     * @param input - Raw user input
     * @returns Sanitized input string
     */
    sanitizeInput(input) {
        // Trim whitespace and limit to a reasonable length
        return input.trim().slice(0, 2000);
    }
    /**
     * Checks if an error is a 429 rate limit error from the Groq API.
     * @param error - The caught error
     * @returns True if it's a rate limit error
     */
    isRateLimitError(error) {
        if (error && typeof error === 'object') {
            const statusCode = error.status
                ?? error.statusCode;
            if (statusCode === 429)
                return true;
            const message = error.message ?? '';
            if (message.toLowerCase().includes('rate limit'))
                return true;
        }
        return false;
    }
    /**
     * Creates a fallback intent when parsing or API calls fail.
     * @param query - The original query for entity extraction
     * @param response - Natural language response to show user
     * @returns A safe fallback ParsedIntent
     */
    createFallbackIntent(query, response) {
        return {
            intent: 'unknown',
            entities: query ? { query } : {},
            risk_level: 0,
            confidence: 0,
            natural_response: response
        };
    }
    /**
     * Async sleep utility for backoff delays.
     * @param ms - Milliseconds to sleep
     */
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.IntentEngine = IntentEngine;
