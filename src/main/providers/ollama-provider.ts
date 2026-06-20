// ============================================================
// JARVIS V4 — Ollama Provider
// Encapsulates local Ollama API completions
// ============================================================

import { AIProvider, AICompletionOptions } from './ai-provider';

export class OllamaProvider implements AIProvider {
  readonly name = 'ollama';
  readonly type = 'local';
  private lastLatency: number = 0;
  private activeModel: string = 'llama';

  public async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('http://127.0.0.1:11434/api/tags', {
        method: 'GET',
        signal: AbortSignal.timeout(1000)
      });
      if (!response.ok) return false;
      const data = await response.json() as { models?: Array<{ name: string }> };
      const models = data.models || [];
      if (models.length > 0) {
        const names = models.map(m => m.name);
        this.activeModel = names.find(n => n.toLowerCase().includes('llama')) || names[0];
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  public async chatCompletion(messages: any[], options?: AICompletionOptions): Promise<string> {
    const startTime = performance.now();
    try {
      const bodyParams: any = {
        model: this.activeModel,
        messages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.1
        }
      };

      if (options?.responseFormat?.type === 'json_object') {
        bodyParams.format = 'json';
      }

      const response = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyParams),
        signal: AbortSignal.timeout(20000)
      });

      if (!response.ok) {
        throw new Error(`Ollama responded with status: ${response.status}`);
      }

      const data = await response.json() as { message?: { content?: string } };
      this.lastLatency = performance.now() - startTime;
      return data.message?.content || '';
    } catch (e) {
      this.lastLatency = performance.now() - startTime;
      throw e;
    }
  }

  public getLatency(): number {
    return this.lastLatency;
  }

  public getPrivacyLevel(): 'local' | 'cloud_encrypted' | 'cloud_plain' {
    return 'local';
  }

  public getModelName(): string {
    return this.activeModel;
  }
}
