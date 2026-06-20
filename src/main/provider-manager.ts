// ============================================================
// JARVIS V4 — AI Provider Manager
// Coordinates modular AI inference backends with automatic failover
// ============================================================

import { AIProvider } from './providers/ai-provider';
import { GroqProvider } from './providers/groq-provider';
import { OllamaProvider } from './providers/ollama-provider';
import { OpenAIProvider } from './providers/openai-provider';
import { GeminiProvider } from './providers/gemini-provider';
import { AnthropicProvider } from './providers/anthropic-provider';
import { FastAPIProvider } from './providers/fastapi-provider';

export interface ProviderStatus {
  groqAvailable: boolean;
  ollamaAvailable: boolean;
  openaiAvailable: boolean;
  geminiAvailable: boolean;
  anthropicAvailable: boolean;
  fastapiAvailable: boolean;
  activeProvider: string;
  models: {
    intent: string;
    completion: string;
  };
}

export class ProviderManager {
  private static instance: ProviderManager | null = null;
  private providers: Map<string, AIProvider> = new Map();
  private preferredProvider: string | null = null;
  private currentActiveProvider: AIProvider | null = null;

  private status: ProviderStatus = {
    groqAvailable: false,
    ollamaAvailable: false,
    openaiAvailable: false,
    geminiAvailable: false,
    anthropicAvailable: false,
    fastapiAvailable: false,
    activeProvider: 'none',
    models: {
      intent: 'none',
      completion: 'none'
    }
  };

  private constructor() {
    // Register all standard V4 AI providers
    this.providers.set('groq', new GroqProvider());
    this.providers.set('ollama', new OllamaProvider());
    this.providers.set('openai', new OpenAIProvider());
    this.providers.set('gemini', new GeminiProvider());
    this.providers.set('anthropic', new AnthropicProvider());
    this.providers.set('fastapi', new FastAPIProvider());
  }

  public static getInstance(): ProviderManager {
    if (!ProviderManager.instance) {
      ProviderManager.instance = new ProviderManager();
    }
    return ProviderManager.instance;
  }

  /**
   * Scans and initializes all available AI providers.
   */
  public async initialize(): Promise<ProviderStatus> {
    console.log('[ProviderManager] Scanning available AI providers...');

    // Force offline simulation for automated tests
    if (process.env.TEST_OFFLINE === 'true') {
      this.status = {
        groqAvailable: false,
        ollamaAvailable: false,
        openaiAvailable: false,
        geminiAvailable: false,
        anthropicAvailable: false,
        fastapiAvailable: false,
        activeProvider: 'none',
        models: { intent: 'none', completion: 'none' }
      };
      this.currentActiveProvider = null;
      console.log('[ProviderManager] FORCED OFFLINE MODE via TEST_OFFLINE=true.');
      return this.status;
    }

    // Evaluate availability of each provider
    this.status.groqAvailable = await this.providers.get('groq')!.isAvailable();
    this.status.ollamaAvailable = await this.providers.get('ollama')!.isAvailable();
    this.status.openaiAvailable = await this.providers.get('openai')!.isAvailable();
    this.status.geminiAvailable = await this.providers.get('gemini')!.isAvailable();
    this.status.anthropicAvailable = await this.providers.get('anthropic')!.isAvailable();
    this.status.fastapiAvailable = await this.providers.get('fastapi')!.isAvailable();

    await this.recalculateActiveProvider();
    return this.status;
  }

  /**
   * Return the current status of all providers.
   */
  public getStatus(): ProviderStatus {
    return this.status;
  }

  /**
   * Retrieve the current active provider.
   */
  public getProvider(): AIProvider | null {
    return this.currentActiveProvider;
  }

  /**
   * Manually override the active provider.
   */
  public async setPreferred(providerName: string): Promise<void> {
    if (providerName !== 'none' && !this.providers.has(providerName)) {
      throw new Error(`Provider "${providerName}" is not registered.`);
    }
    this.preferredProvider = providerName === 'none' ? null : providerName;
    await this.recalculateActiveProvider();
  }

  /**
   * Perform chat completion with the active provider and automatic failover.
   */
  public async getChatCompletion(messages: any[], options?: any): Promise<string> {
    const provider = this.getProvider();
    if (!provider) {
      throw new Error('No AI providers are available.');
    }

    try {
      console.log(`[ProviderManager] Routing completion request to "${provider.name}"...`);
      return await provider.chatCompletion(messages, options);
    } catch (e) {
      console.warn(`[ProviderManager] Active provider "${provider.name}" failed: ${e instanceof Error ? e.message : String(e)}. Triggering failover...`);
      
      const available = await this.getAvailableProviders();
      const failoverList = this.getSortedAvailableProviders(
        available.filter(p => p.name !== provider.name)
      );

      for (const nextProvider of failoverList) {
        try {
          console.log(`[ProviderManager] Failover: attempting "${nextProvider.name}"...`);
          const res = await nextProvider.chatCompletion(messages, options);
          return res;
        } catch (failoverErr) {
          console.warn(`[ProviderManager] Failover to "${nextProvider.name}" failed:`, failoverErr);
        }
      }

      throw new Error('All AI provider failovers exhausted.');
    }
  }

  /** Recalculates the active provider based on availability, preference, and priority rules */
  private async recalculateActiveProvider(): Promise<void> {
    const available = await this.getAvailableProviders();

    if (available.length === 0) {
      this.currentActiveProvider = null;
      this.status.activeProvider = 'none';
      this.status.models = { intent: 'none', completion: 'none' };
      console.warn('[ProviderManager] No AI providers are available.');
      return;
    }

    // 1. If preferred provider is set and available, use it
    if (this.preferredProvider) {
      const preferred = available.find(p => p.name === this.preferredProvider);
      if (preferred) {
        this.currentActiveProvider = preferred;
        this.status.activeProvider = preferred.name;
        this.updateModelStatus(preferred);
        console.log(`[ProviderManager] Preferred AI provider "${preferred.name}" is active.`);
        return;
      }
    }

    // 2. Select using default policy: Local/Privacy -> Latency
    const sorted = this.getSortedAvailableProviders(available);
    const best = sorted[0];
    this.currentActiveProvider = best;
    this.status.activeProvider = best.name;
    this.updateModelStatus(best);
    console.log(`[ProviderManager] Selected AI provider "${best.name}" as active.`);
  }

  private async getAvailableProviders(): Promise<AIProvider[]> {
    const available: AIProvider[] = [];
    for (const provider of this.providers.values()) {
      if (await provider.isAvailable()) {
        available.push(provider);
      }
    }
    return available;
  }

  /** Sorts available providers: local (privacy-first) prioritized, then by latency */
  private getSortedAvailableProviders(availableProviders: AIProvider[]): AIProvider[] {
    return [...availableProviders].sort((a, b) => {
      const privacyWeights = { local: 0, cloud_encrypted: 1, cloud_plain: 2 };
      const diff = privacyWeights[a.getPrivacyLevel()] - privacyWeights[b.getPrivacyLevel()];
      if (diff !== 0) return diff;

      // Lower latency first (fallback to 100ms if no history yet)
      const latA = a.getLatency() || 100;
      const latB = b.getLatency() || 100;
      return latA - latB;
    });
  }

  private updateModelStatus(provider: AIProvider): void {
    if (provider.name === 'ollama') {
      const ollama = provider as OllamaProvider;
      this.status.models = {
        intent: ollama.getModelName(),
        completion: ollama.getModelName()
      };
    } else if (provider.name === 'openai') {
      this.status.models = {
        intent: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        completion: process.env.OPENAI_MODEL || 'gpt-4o-mini'
      };
    } else if (provider.name === 'gemini') {
      this.status.models = {
        intent: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
        completion: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
      };
    } else if (provider.name === 'anthropic') {
      this.status.models = {
        intent: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
        completion: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest'
      };
    } else {
      this.status.models = {
        intent: 'llama-3.3-70b-versatile',
        completion: 'llama-3.3-70b-versatile'
      };
    }
  }
}
