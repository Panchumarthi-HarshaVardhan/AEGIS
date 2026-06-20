"use strict";
// ============================================================
// JARVIS Guardian AI — Memory Engine
// SQLite-backed persistent memory for conversations, preferences,
// and security events
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryEngine = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const node_crypto_1 = require("node:crypto");
const fs = __importStar(require("fs"));
/**
 * SQLite-backed persistent memory engine.
 *
 * Stores conversations, user preferences, and security events
 * in a local SQLite database using better-sqlite3 for synchronous,
 * high-performance operations.
 *
 * @example
 * ```ts
 * const memory = new MemoryEngine('./jarvis.db')
 * memory.addMessage({
 *   id: crypto.randomUUID(),
 *   role: 'user',
 *   content: 'Open Chrome',
 *   timestamp: Date.now()
 * })
 * const history = memory.getHistory(10)
 * ```
 */
class MemoryEngine {
    db;
    /**
     * Creates a new MemoryEngine instance.
     *
     * Opens (or creates) the SQLite database at the given path and
     * initializes all required tables if they don't already exist.
     *
     * @param dbPath - Absolute or relative path to the SQLite database file
     * @throws {Error} If the database cannot be opened or tables cannot be created
     */
    constructor(dbPath) {
        this.db = new better_sqlite3_1.default(dbPath);
        // Enable WAL mode for better concurrent read performance
        this.db.pragma('journal_mode = WAL');
        // Enable foreign keys
        this.db.pragma('foreign_keys = ON');
        // Enable production pragmas for optimal disk write speed and memory caching
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('temp_store = MEMORY');
        this.db.pragma('cache_size = -2000');
        this.db.pragma('mmap_size = 8388608');
        this.initializeTables();
    }
    // ─── Conversations ─────────────────────────────────────────
    /**
     * Adds a conversation message to the database.
     *
     * Stores the message with all associated metadata (intent,
     * security verdict, action result) serialized as JSON.
     *
     * @param message - The conversation message to store
     */
    addMessage(message) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO conversations (id, role, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);
        const metadata = JSON.stringify({
            intent: message.intent ?? null,
            security: message.security ?? null,
            action_result: message.action_result ?? null
        });
        stmt.run(message.id || (0, node_crypto_1.randomUUID)(), message.role, message.content, message.timestamp, metadata);
    }
    /**
     * Retrieves recent conversation history.
     *
     * Returns messages ordered by timestamp (most recent last),
     * limited to the specified count.
     *
     * @param limit - Maximum number of messages to retrieve (default: 50)
     * @returns Array of conversation messages, oldest first
     */
    getHistory(limit = 50) {
        const safeLimit = Math.max(1, Math.min(limit, 1000));
        const stmt = this.db.prepare(`
      SELECT id, role, content, timestamp, metadata
      FROM conversations
      ORDER BY timestamp DESC
      LIMIT ?
    `);
        const rows = stmt.all(safeLimit);
        // Reverse to return oldest-first order
        return rows.reverse().map((row) => {
            let parsed = {};
            try {
                parsed = JSON.parse(row.metadata || '{}');
            }
            catch {
                // Ignore malformed metadata
            }
            return {
                id: row.id,
                role: row.role,
                content: row.content,
                timestamp: row.timestamp,
                ...(parsed.intent ? { intent: parsed.intent } : {}),
                ...(parsed.security ? { security: parsed.security } : {}),
                ...(parsed.action_result ? { action_result: parsed.action_result } : {})
            };
        });
    }
    // ─── Preferences ───────────────────────────────────────────
    /**
     * Sets a user preference value.
     *
     * Creates or updates the preference by key. The timestamp
     * is automatically set to the current time.
     *
     * @param key - The preference key
     * @param value - The preference value
     */
    setPreference(key, value) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO preferences (key, value, updated_at)
      VALUES (?, ?, ?)
    `);
        stmt.run(key, value, Date.now());
    }
    /**
     * Retrieves a user preference by key.
     *
     * @param key - The preference key to look up
     * @returns The UserPreference if found, or null if not set
     */
    getPreference(key) {
        const stmt = this.db.prepare(`
      SELECT key, value, updated_at
      FROM preferences
      WHERE key = ?
    `);
        const row = stmt.get(key);
        if (!row)
            return null;
        return {
            key: row.key,
            value: row.value,
            updated_at: row.updated_at
        };
    }
    // ─── Security Events ──────────────────────────────────────
    /**
     * Logs a security event to the database.
     *
     * Records security incidents (detected secrets, phishing blocks,
     * prompt injections) with full details for audit purposes.
     *
     * @param event - The security event to log
     */
    logSecurityEvent(event) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO security_events (id, type, severity, description, timestamp, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(event.id || (0, node_crypto_1.randomUUID)(), event.type, event.severity, event.description, event.timestamp, JSON.stringify(event.details ?? {}));
    }
    /**
     * Retrieves recent security events.
     *
     * Returns events ordered by timestamp (most recent first),
     * limited to the specified count.
     *
     * @param limit - Maximum number of events to retrieve (default: 100)
     * @returns Array of security events, most recent first
     */
    getSecurityEvents(limit = 100) {
        const safeLimit = Math.max(1, Math.min(limit, 1000));
        const stmt = this.db.prepare(`
      SELECT id, type, severity, description, timestamp, details
      FROM security_events
      ORDER BY timestamp DESC
      LIMIT ?
    `);
        const rows = stmt.all(safeLimit);
        return rows.map((row) => {
            let details = {};
            try {
                details = JSON.parse(row.details || '{}');
            }
            catch {
                // Ignore malformed details
            }
            return {
                id: row.id,
                type: row.type,
                severity: row.severity,
                description: row.description,
                timestamp: row.timestamp,
                details
            };
        });
    }
    // ─── Lifecycle ─────────────────────────────────────────────
    /**
     * Closes the database connection.
     *
     * Should be called when the application shuts down to ensure
     * all data is flushed and the database file is properly closed.
     */
    close() {
        try {
            this.db.close();
        }
        catch (error) {
            console.error('MemoryEngine: Error closing database:', error);
        }
    }
    /**
     * Returns the database file size in bytes.
     */
    getDatabaseSize() {
        try {
            const stats = fs.statSync(this.db.name);
            return stats.size;
        }
        catch (error) {
            console.error('MemoryEngine: Error reading database file size:', error);
            return 0;
        }
    }
    // ─── Private ───────────────────────────────────────────────
    /**
     * Initializes all database tables if they don't already exist.
     */
    initializeTables() {
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
        severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
        description TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        details TEXT DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_timestamp
        ON conversations (timestamp);

      CREATE INDEX IF NOT EXISTS idx_security_events_timestamp
        ON security_events (timestamp);

      CREATE INDEX IF NOT EXISTS idx_security_events_type
        ON security_events (type);
    `);
    }
}
exports.MemoryEngine = MemoryEngine;
