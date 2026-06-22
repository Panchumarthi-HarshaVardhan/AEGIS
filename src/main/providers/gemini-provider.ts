// ============================================================
// JARVIS V4 — Gemini Provider
// Encapsulates Google Gemini REST API completions
// ============================================================

import { AIProvider, AICompletionOptions } from './ai-provider';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  readonly type = 'cloud';
  private lastLatency: number = 0;

  public async isAvailable(): Promise<boolean> {
    const key = process.env.GEMINI_API_KEY || '';
    return key.length > 0 && key !== 'your_gemini_api_key_here';
  }

  public async chatCompletion(messages: any[], options?: AICompletionOptions): Promise<string> {
    const startTime = performance.now();
    try {
      const apiKey = process.env.GEMINI_API_KEY || '';
      const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

      let systemInstruction: any = undefined;
      const contents: any[] = [];

      for (const msg of messages) {
        if (msg.role === 'system') {
          systemInstruction = { parts: [{ text: msg.content }] };
        } else {
          const parts: any[] = [];
          if (Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (part.type === 'text') {
                parts.push({ text: part.text });
              } else if (part.type === 'image_url') {
                const url = part.image_url.url;
                const match = url.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                  parts.push({
                    inlineData: {
                      mimeType: match[1],
                      data: match[2]
                    }
                  });
                }
              }
            }
          } else {
            parts.push({ text: msg.content });
          }
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts
          });
        }
      }

      const bodyParams: any = {
        contents,
        generationConfig: {
          temperature: options?.temperature ?? 0.1,
          maxOutputTokens: options?.maxTokens ?? 1024,
        }
      };

      if (systemInstruction) {
        bodyParams.systemInstruction = systemInstruction;
      }

      if (options?.responseFormat?.type === 'json_object') {
        bodyParams.generationConfig.responseMimeType = 'application/json';
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyParams),
        signal: AbortSignal.timeout(20000)
      });

      if (!response.ok) {
        throw new Error(`Gemini responded with status: ${response.status}`);
      }

      const data = await response.json() as any;
      this.lastLatency = performance.now() - startTime;
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
