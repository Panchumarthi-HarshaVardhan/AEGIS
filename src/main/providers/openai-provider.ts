// ============================================================
// JARVIS V4 — OpenAI Provider
// Encapsulates OpenAI-compatible API completions (supports cloud/LM Studio)
// ============================================================

import { AIProvider, AICompletionOptions } from './ai-provider';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  readonly type = 'cloud';
  private lastLatency: number = 0;

  public async isAvailable(): Promise<boolean> {
    const key = process.env.OPENAI_API_KEY || '';
    return key.length > 0 && key !== 'your_openai_api_key_here';
  }

  public async chatCompletion(messages: any[], options?: AICompletionOptions): Promise<string> {
    const startTime = performance.now();
    try {
      const apiKey = process.env.OPENAI_API_KEY || '';
      const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

      const bodyParams: any = {
        model,
        messages,
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.maxTokens ?? 1024,
      };

      if (options?.responseFormat?.type === 'json_object') {
        bodyParams.response_format = { type: 'json_object' };
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(bodyParams),
        signal: AbortSignal.timeout(20000)
      });

      if (!response.ok) {
        throw new Error(`OpenAI compatible provider responded with status: ${response.status}`);
      }

      const data = await response.json() as any;
      this.lastLatency = performance.now() - startTime;
      return data.choices?.[0]?.message?.content || '';
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
