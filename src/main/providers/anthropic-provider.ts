// ============================================================
// JARVIS V4 — Anthropic Provider
// Encapsulates Anthropic Claude Messages API completions
// ============================================================

import { AIProvider, AICompletionOptions } from './ai-provider';

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  readonly type = 'cloud';
  private lastLatency: number = 0;

  public async isAvailable(): Promise<boolean> {
    const key = process.env.ANTHROPIC_API_KEY || '';
    return key.length > 0 && key !== 'your_anthropic_api_key_here';
  }

  public async chatCompletion(messages: any[], options?: AICompletionOptions): Promise<string> {
    const startTime = performance.now();
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY || '';
      const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';

      let system: string | undefined = undefined;
      const contents: any[] = [];

      for (const msg of messages) {
        if (msg.role === 'system') {
          system = msg.content;
        } else {
          contents.push({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
          });
        }
      }

      const bodyParams: any = {
        model,
        messages: contents,
        max_tokens: options?.maxTokens ?? 1024,
        temperature: options?.temperature ?? 0.1,
      };

      if (system) {
        bodyParams.system = system;
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(bodyParams),
        signal: AbortSignal.timeout(20000)
      });

      if (!response.ok) {
        throw new Error(`Anthropic responded with status: ${response.status}`);
      }

      const data = await response.json() as any;
      this.lastLatency = performance.now() - startTime;
      return data.content?.[0]?.text || '';
    } catch (e) {
      this.lastLatency = performance.now() - startTime;
      throw e;
    }
  }

  public getLatency(): number {
    return this.lastLatency;
  }

  public getPrivacyLevel(): 'local' | 'cloud_encrypted' | 'cloud_plain' {
    return 'cloud_plain';
  }
}
