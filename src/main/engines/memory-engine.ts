// ============================================================
// JARVIS Guardian AI — Memory Engine
// SQLite-backed persistent memory for conversations, preferences,
// security events, permissions, and trust histories with short-term cache
// and auto-summarization pipeline.
// ============================================================

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs';
import type {
  ConversationMessage,
  SecurityEvent,
  UserPreference
} from '../../shared/types';
import { ProviderManager } from '../provider-manager';

export class MemoryEngine {
  private readonly db: Database.Database;
  private shortTermHistory: ConversationMessage[] = [];
  private conversationSummary: string = '';
  private isSummarizing: boolean = false;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);

    // Enable WAL mode for concurrency and optimal write speeds
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('cache_size = -2000');
    this.db.pragma('mmap_size = 8388608');

    this.initializeTables();
    this.loadShortTermCache();
  }

  // ─── Conversations ─────────────────────────────────────────

  /**
   * Adds a conversation message to the database and short-term cache.
   * Triggers auto-summarization if short-term cache exceeds 20 items.
   */
  addMessage(message: ConversationMessage): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO conversations (id, role, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);

    const metadata = JSON.stringify({
      intent: message.intent ?? null,
      security: message.security ?? null,
      action_result: message.action_result ?? null
    });

    stmt.run(
      message.id || randomUUID(),
      message.role,
      message.content,
      message.timestamp,
      metadata
    );

    // Append to cache
    this.shortTermHistory.push(message);

    // Trigger summarization when cache holds > 20 messages
    if (this.shortTermHistory.length > 20) {
      this.triggerAutoSummarization().catch(err => {
        console.error('[MemoryEngine] Error during async auto-summarization:', err);
      });
    }
  }

  /**
   * Retrieves conversation history from SQLite database.
   */
  getHistory(limit: number = 50): ConversationMessage[] {
    const safeLimit = Math.max(1, Math.min(limit, 1000));

    const stmt = this.db.prepare(`
      SELECT id, role, content, timestamp, metadata
      FROM conversations
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(safeLimit) as Array<{
      id: string;
      role: string;
      content: string;
      timestamp: number;
      metadata: string;
    }>;

    return rows.reverse().map((row) => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(row.metadata || '{}') as Record<string, unknown>;
      } catch {
        // Ignore JSON error
      }

      return {
        id: row.id,
        role: row.role as ConversationMessage['role'],
        content: row.content,
        timestamp: row.timestamp,
        ...(parsed.intent ? { intent: parsed.intent } : {}),
        ...(parsed.security ? { security: parsed.security } : {}),
        ...(parsed.action_result ? { action_result: parsed.action_result } : {})
      } as ConversationMessage;
    });
  }

  /**
   * Returns recent messages currently stored in the memory cache.
   */
  public getShortTermHistory(): ConversationMessage[] {
    return [...this.shortTermHistory];
  }

  /**
   * Returns the running summarized context of past conversations.
   */
  public getLongTermSummary(): string {
    if (!this.conversationSummary) {
      const pref = this.getPreference('conversation_summary');
      this.conversationSummary = pref ? pref.value : 'No conversation summary available yet.';
    }
    return this.conversationSummary;
  }

  // ─── Preferences ───────────────────────────────────────────

  setPreference(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO preferences (key, value, updated_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(key, value, Date.now());
  }

  getPreference(key: string): UserPreference | null {
    const stmt = this.db.prepare(`
      SELECT key, value, updated_at
      FROM preferences
      WHERE key = ?
    `);

    const row = stmt.get(key) as
      | { key: string; value: string; updated_at: number }
      | undefined;

    if (!row) return null;

    return {
      key: row.key,
      value: row.value,
      updated_at: row.updated_at,
    };
  }

  // ─── Security Events ──────────────────────────────────────

  logSecurityEvent(event: SecurityEvent): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO security_events (id, type, severity, description, timestamp, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.id || randomUUID(),
      event.type,
      event.severity,
      event.description,
      event.timestamp,
      JSON.stringify(event.details ?? {})
    );
  }

  getSecurityEvents(limit: number = 100): SecurityEvent[] {
    const safeLimit = Math.max(1, Math.min(limit, 1000));

    const stmt = this.db.prepare(`
      SELECT id, type, severity, description, timestamp, details
      FROM security_events
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(safeLimit) as Array<{
      id: string;
      type: string;
      severity: string;
      description: string;
      timestamp: number;
      details: string;
    }>;

    return rows.map((row) => {
      let details: Record<string, unknown> = {};
      try {
        details = JSON.parse(row.details || '{}') as Record<string, unknown>;
      } catch {
        // Ignore JSON error
      }

      return {
        id: row.id,
        type: row.type as SecurityEvent['type'],
        severity: row.severity as SecurityEvent['severity'],
        description: row.description,
        timestamp: row.timestamp,
        details
      };
    });
  }

  // ─── V4 Permissions ────────────────────────────────────────

  /**
   * Fetches all registered permissions from the permissions table.
   */
  public getPermissions(): Array<{ permission: string; state: string; scope?: string; granted_at?: number }> {
    try {
      const stmt = this.db.prepare('SELECT permission, state, scope, granted_at FROM permissions');
      return stmt.all() as any;
    } catch (e) {
      console.error('[MemoryEngine] Failed to fetch permissions:', e);
      return [];
    }
  }

  /**
   * Saves a permission record into the permissions table.
   */
  public savePermission(permission: string, state: string, scope?: string, grantedAt?: number): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO permissions (permission, state, scope, granted_at)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(permission, state, scope ?? null, grantedAt ?? null);
    } catch (e) {
      console.error('[MemoryEngine] Failed to save permission:', e);
    }
  }

  // ─── V4 Trust History ──────────────────────────────────────

  /**
   * Logs a domain trust evaluation event.
   */
  public addTrustHistory(domain: string, score: number, category: string): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO trust_history (id, domain, score, category, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(randomUUID(), domain, score, category, Date.now());
    } catch (e) {
      console.error('[MemoryEngine] Failed to log trust history:', e);
    }
  }

  /**
   * Retrieves domain trust evaluation records.
   */
  public getTrustHistory(limit: number = 100): Array<{ id: string; domain: string; score: number; category: string; timestamp: number }> {
    try {
      const stmt = this.db.prepare(`
        SELECT id, domain, score, category, timestamp
        FROM trust_history
        ORDER BY timestamp DESC
        LIMIT ?
      `);
      return stmt.all(limit) as any;
    } catch (e) {
      console.error('[MemoryEngine] Failed to get trust history:', e);
      return [];
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────

  close(): void {
    try {
      this.db.close();
    } catch (error) {
      console.error('MemoryEngine: Error closing database:', error);
    }
  }

  getDatabaseSize(): number {
    try {
      const stats = fs.statSync(this.db.name);
      return stats.size;
    } catch (error) {
      console.error('MemoryEngine: Error reading database file size:', error);
      return 0;
    }
  }

  // ─── Private Helpers ───────────────────────────────────────

  private loadShortTermCache(): void {
    try {
      this.shortTermHistory = this.getHistory(20);
    } catch (e) {
      console.error('[MemoryEngine] Failed to initialize short term cache:', e);
    }
  }

  private async triggerAutoSummarization(): Promise<void> {
    if (this.isSummarizing) return;
    this.isSummarizing = true;

    try {
      const providerManager = ProviderManager.getInstance();
      if (!providerManager.getProvider()) {
        console.warn('[MemoryEngine] No active AI provider. Skipping summarization.');
        this.isSummarizing = false;
        return;
      }

      // Summarize the oldest 10 messages from cache
      const messagesToSummarize = this.shortTermHistory.slice(0, 10);
      const conversationText = messagesToSummarize
        .map(msg => `${msg.role === 'user' ? 'User' : 'JARVIS'}: ${msg.content}`)
        .join('\n');

      const systemPrompt = 'You are JARVIS Guardian AI\'s conversation summarizer. Review the chat transcript segment below and merge it into a single, concise historical summary paragraph. Incorporate details from any previous summary provided if relevant.';
      const currentSummary = this.getLongTermSummary();
      const prompt = `Previous summary:\n${currentSummary}\n\nChat segment to merge:\n${conversationText}\n\nProvide the new cumulative summary paragraph.`;

      const newSummary = await providerManager.getChatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]);

      if (newSummary && newSummary.trim().length > 0) {
        this.conversationSummary = newSummary.trim();
        this.setPreference('conversation_summary', this.conversationSummary);
        
        // Remove summarized items from cache
        this.shortTermHistory = this.shortTermHistory.slice(10);
        console.log('[MemoryEngine] Auto-summarization completed successfully.');
      }
    } catch (err) {
      console.error('[MemoryEngine] Conversation auto-summarization failed:', err);
    } finally {
      this.isSummarizing = false;
    }
  }

  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS security_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('silent', 'low', 'medium', 'high', 'critical')),
        description TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        details TEXT DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS permissions (
        permission TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        scope TEXT,
        granted_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS trust_history (
        id TEXT PRIMARY KEY,
        domain TEXT NOT NULL,
        score INTEGER NOT NULL,
        category TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_timestamp
        ON conversations (timestamp);

      CREATE INDEX IF NOT EXISTS idx_security_events_timestamp
        ON security_events (timestamp);

      CREATE INDEX IF NOT EXISTS idx_security_events_type
        ON security_events (type);

      CREATE INDEX IF NOT EXISTS idx_trust_history_timestamp
        ON trust_history (timestamp);
    `);
  }
}
