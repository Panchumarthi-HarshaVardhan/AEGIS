"use strict";
// ============================================================
// JARVIS Guardian AI — AI Provider Manager
// Coordinates available AI inference backends (Groq / local Ollama)
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderManager = void 0;
class ProviderManager {
    static instance = null;
    status = {
        groqAvailable: false,
        ollamaAvailable: false,
        activeProvider: 'none',
        models: {
            intent: 'none',
            completion: 'none'
        }
    };
    constructor() { }
    /**
     * Get the singleton instance of the ProviderManager
     */
    static getInstance() {
        if (!ProviderManager.instance) {
            ProviderManager.instance = new ProviderManager();
        }
        return ProviderManager.instance;
    }
    /**
     * Scans and initializes available AI providers.
     * Prioritizes Groq if API key is set, then falls back to local Ollama.
     */
    async initialize() {
        console.log('[ProviderManager] Initializing AI provider detection...');
        // Force offline simulation for automated tests
        if (process.env.TEST_OFFLINE === 'true') {
            this.status.groqAvailable = false;
            this.status.ollamaAvailable = false;
            this.status.activeProvider = 'none';
            this.status.models = {
                intent: 'none',
                completion: 'none'
            };
            console.log('[ProviderManager] FORCED OFFLINE MODE via TEST_OFFLINE=true.');
            return this.status;
        }
        // 1. Check Groq API Key
        const groqKey = process.env.GROQ_API_KEY || '';
        const isGroqValid = groqKey && groqKey.trim().length > 0 && groqKey !== 'your_groq_api_key_here';
        this.status.groqAvailable = !!isGroqValid;
        // 2. Check Local Ollama
        this.status.ollamaAvailable = await this.checkOllamaAvailability();
        // 3. Resolve active provider
        if (this.status.groqAvailable) {
            this.status.activeProvider = 'groq';
            this.status.models = {
                intent: 'llama-3.3-70b-versatile',
                completion: 'llama-3.3-70b-versatile'
            };
            console.log('[ProviderManager] Groq cloud provider is ACTIVE.');
        }
        else if (this.status.ollamaAvailable) {
            this.status.activeProvider = 'ollama';
            // models.intent and models.completion are set during checkOllamaAvailability()
            console.log(`[ProviderManager] Local Ollama provider is ACTIVE (using model: ${this.status.models.intent}).`);
        }
        else {
            this.status.activeProvider = 'none';
            this.status.models = {
                intent: 'none',
                completion: 'none'
            };
            console.warn('[ProviderManager] WARNING: No AI provider (Groq or local Ollama) is available. AI features will degrade to safe warning messages.');
        }
        return this.status;
    }
    /**
     * Returns the current status of detected AI providers.
     */
    getStatus() {
        return this.status;
    }
    /**
     * Helper to check local Ollama availability on port 11434
     */
    async checkOllamaAvailability() {
        try {
            // Fetch local Ollama tags
            const response = await fetch('http://127.0.0.1:11434/api/tags', {
                method: 'GET',
                signal: AbortSignal.timeout(1000) // 1 second timeout
            });
            if (!response.ok) {
                return false;
            }
            const data = (await response.json());
            const models = data.models || [];
            if (models.length > 0) {
                const modelNames = models.map((m) => m.name);
                // Prefer any llama model first, otherwise grab the first available model
                const preferredModel = modelNames.find((name) => name.toLowerCase().includes('llama')) || modelNames[0];
                this.status.models.intent = preferredModel;
                this.status.models.completion = preferredModel;
                return true;
            }
            return false;
        }
        catch (error) {
            return false;
        }
    }
}
exports.ProviderManager = ProviderManager;
