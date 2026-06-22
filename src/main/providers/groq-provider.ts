// ============================================================
// JARVIS V4 — Groq Provider
// Encapsulates Groq SDK cloud completions.
// Automatically switches to a vision-capable model (llama-4-scout)
// when the messages array contains image_url content parts.
// ============================================================

import { AIProvider, AICompletionOptions } from './ai-provider';

// Vision-capable model on Groq that handles image inputs
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
// Standard fast text model (no vision)
const GROQ_TEXT_MODEL = 'llama-3.3-70b-versatile';

/** Returns true when any message contains an image_url content part */
function hasImageContent(messages: any[]): boolean {
  return messages.some(
    (msg) =>
      Array.isArray(msg.content) &&
      msg.content.some((part: any) => part.type === 'image_url')
  );
}

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

      const isVision = hasImageContent(messages);
      const model = isVision ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL;

      const params: any = {
        model,
        messages,
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.maxTokens ?? 1024,
      };

      // response_format: json_object is NOT supported by vision models.
      // Only apply it for pure text completions.
      if (!isVision && options?.responseFormat?.type === 'json_object') {
        params.response_format = { type: 'json_object' };
      }

      const completion = await this.client.chat.completions.create(params);
      this.lastLatency = performance.now() - startTime;
      return completion.choices?.[0]?.message?.content || '';
    } catch (e: any) {
      this.lastLatency = performance.now() - startTime;
      // If vision model fails (e.g. model unavailable), fall back to text-only analysis
      if (hasImageContent(messages)) {
        console.warn('[GroqProvider] Vision model failed, falling back to text-only:', e?.message);
        // Strip image parts and retry with text model
        const textMessages = messages.map((msg) => ({
          ...msg,
          content: Array.isArray(msg.content)
            ? msg.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n')
            : msg.content
        }));
        const fallbackParams: any = {
          model: GROQ_TEXT_MODEL,
          messages: textMessages,
          temperature: options?.temperature ?? 0.1,
          max_tokens: options?.maxTokens ?? 1024,
        };
        if (options?.responseFormat?.type === 'json_object') {
          fallbackParams.response_format = { type: 'json_object' };
        }
        const fallback = await this.client.chat.completions.create(fallbackParams);
        this.lastLatency = performance.now() - startTime;
        return fallback.choices?.[0]?.message?.content || '';
      }
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
