// ============================================================
// JARVIS V4 — FastAPI Provider
// Encapsulates local Python FastAPI backend completions
// ============================================================

import { AIProvider, AICompletionOptions } from './ai-provider';

export class FastAPIProvider implements AIProvider {
  readonly name = 'fastapi';
  readonly type = 'local';
  private lastLatency: number = 0;

  public async isAvailable(): Promise<boolean> {
    try {
      const port = process.env.PORT || '8000';
      const response = await fetch(`http://127.0.0.1:${port}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000)
      });
      return response.ok;
    } catch (e) {
      return false;
    }
  }

  public async chatCompletion(messages: any[], options?: AICompletionOptions): Promise<string> {
    const startTime = performance.now();
    try {
      const port = process.env.PORT || '8000';
      const response = await fetch(`http://127.0.0.1:${port}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          temperature: options?.temperature ?? 0.1
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`FastAPI responded with status: ${response.status}`);
      }

      const data = await response.json() as { response?: string };
      this.lastLatency = performance.now() - startTime;
      return data.response || '';
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
}
