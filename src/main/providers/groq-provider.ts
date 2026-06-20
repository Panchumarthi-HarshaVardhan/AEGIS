// ============================================================
// JARVIS V4 — Groq Provider
// Encapsulates Groq SDK cloud completions
// ============================================================

import { AIProvider, AICompletionOptions } from './ai-provider';

export class GroqProvider implements AIProvider {
  readonly name = 'groq';
  readonly type = 'cloud';
  private client: any = null;
  private lastLatency: number = 0;

  public async isAvailable(): Promise<boolean> {
    const key = process.env.GROQ_API_KEY || '';
    return key.length > 0 && key !== 'your_groq_api_key_here';
  }

  public async chatCompletion(messages: any[], options?: AICompletionOptions): Promise<string> {
    const startTime = performance.now();
    try {
      if (!this.client) {
        const apiKey = process.env.GROQ_API_KEY || '';
        const GroqSdk = require('groq-sdk');
        this.client = new GroqSdk({ apiKey });
      }

      const params: any = {
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.maxTokens ?? 1024,
      };

      if (options?.responseFormat?.type === 'json_object') {
        params.response_format = { type: 'json_object' };
      }

      const completion = await this.client.chat.completions.create(params);
      this.lastLatency = performance.now() - startTime;
      return completion.choices?.[0]?.message?.content || '';
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
