// ============================================================
// JARVIS V4 — AI Provider Interface
// Interface for decoupling AI LLM backends (cloud or local)
// ============================================================

export interface AICompletionOptions {
  responseFormat?: { type: 'json_object' };
  temperature?: number;
  maxTokens?: number;
}

export interface AIProvider {
  readonly name: string;
  readonly type: 'cloud' | 'local';
  
  /** Checks if keys are set or local ports respond */
  isAvailable(): Promise<boolean>;
  
  /** Sends completion request and returns response text */
  chatCompletion(messages: any[], options?: AICompletionOptions): Promise<string>;
  
  /** Returns last query latency in milliseconds */
  getLatency(): number;
  
  /** Returns the data privacy level for compliance/audits */
  getPrivacyLevel(): 'local' | 'cloud_encrypted' | 'cloud_plain';
}
