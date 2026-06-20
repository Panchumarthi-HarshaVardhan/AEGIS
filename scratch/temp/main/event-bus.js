"use strict";
// ============================================================
// JARVIS V3 — Hardened Event Bus
// Central pub/sub broker with loop detection, error isolation, and retries
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventBus = void 0;
class EventBus {
    static instance = null;
    listenersMap = new Map();
    activeEvents = []; // recursion stack for loop detection
    constructor() {
        // Private constructor for singleton pattern
    }
    /** Get the singleton instance of the EventBus */
    static getInstance() {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }
    /** Subscribe a typed listener to an event with optional configuration */
    subscribe(event, listener, options = {}) {
        let list = this.listenersMap.get(event);
        if (!list) {
            list = [];
            this.listenersMap.set(event, list);
        }
        // Subscription De-duplication Check
        const exists = list.some((item) => item.fn === listener);
        if (exists) {
            console.warn(`[EventBus] Duplicate subscription ignored for event "${event}".`);
            return this;
        }
        list.push({ fn: listener, options });
        return this;
    }
    /** Unsubscribe a typed listener from an event */
    unsubscribe(event, listener) {
        const list = this.listenersMap.get(event);
        if (list) {
            this.listenersMap.set(event, list.filter((item) => item.fn !== listener));
        }
        return this;
    }
    /**
     * Emit a typed event to all registered listeners.
     * Executes all listeners asynchronously in a fire-and-forget sandboxed block.
     */
    publish(event, ...args) {
        const start = performance.now();
        const desc = args[0] ? (typeof args[0] === 'string' && args[0].length > 60 ? `${args[0].substring(0, 60)}...` : args[0]) : '';
        console.log(`[EventBus] Event Published: "${event}"`, desc);
        // Synchronous Loop / Cycle Detection
        if (this.activeEvents.includes(event)) {
            console.error(`[EventBus] CRITICAL: Synchronous event loop detected: ${this.activeEvents.join(' -> ')} -> ${event}. Aborting execution.`);
            return false;
        }
        const listeners = this.listenersMap.get(event);
        if (!listeners || listeners.length === 0) {
            return false;
        }
        this.activeEvents.push(event);
        try {
            for (const listener of listeners) {
                // Sandbox each listener so throws do not interrupt execution of other listeners
                this.executeListener(event, listener, args).catch((err) => {
                    console.error(`[EventBus] Sandboxed uncaught error on event "${event}":`, err);
                });
            }
        }
        finally {
            this.activeEvents.pop();
        }
        const duration = performance.now() - start;
        if (duration > 10) {
            console.warn(`[EventBus:Profile] WARNING: Event "${event}" took ${duration.toFixed(2)}ms to dispatch.`);
        }
        return true;
    }
    /**
     * Emit a typed event and wait for all listeners to complete sequentially.
     * Useful when sequence guarantees are required or testing retry behavior.
     */
    async publishAsync(event, ...args) {
        const start = performance.now();
        console.log(`[EventBus] Event Published (Async): "${event}"`);
        if (this.activeEvents.includes(event)) {
            console.error(`[EventBus] CRITICAL: Event loop detected (Async): ${this.activeEvents.join(' -> ')} -> ${event}. Aborting execution.`);
            return false;
        }
        const listeners = this.listenersMap.get(event);
        if (!listeners || listeners.length === 0) {
            return false;
        }
        this.activeEvents.push(event);
        try {
            for (const listener of listeners) {
                // Sequentially await execution
                await this.executeListener(event, listener, args);
            }
        }
        finally {
            this.activeEvents.pop();
        }
        const duration = performance.now() - start;
        console.log(`[EventBus] Async dispatch for "${event}" completed in ${duration.toFixed(2)}ms.`);
        return true;
    }
    /** Execute a listener with sandboxed try-catch and optional exponential retry policies */
    async executeListener(event, reg, args) {
        const name = reg.options.name || 'Anonymous';
        const retries = reg.options.retries || 0;
        const backoffMs = reg.options.backoffMs || 100;
        let attempt = 0;
        while (true) {
            const start = performance.now();
            try {
                const result = reg.fn(...args);
                if (result instanceof Promise) {
                    await result;
                }
                const duration = performance.now() - start;
                if (duration > 10) {
                    console.warn(`[EventBus:Profile] WARNING: Listener "${name}" on event "${event}" took ${duration.toFixed(2)}ms to execute.`);
                }
                return; // Success
            }
            catch (err) {
                attempt++;
                const duration = performance.now() - start;
                if (attempt <= retries) {
                    const delay = backoffMs * Math.pow(2, attempt - 1);
                    console.warn(`[EventBus] Listener "${name}" failed on event "${event}" (Attempt ${attempt}/${retries}, execution ${duration.toFixed(2)}ms). Retrying in ${delay}ms... Error:`, err);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
                else {
                    console.error(`[EventBus] CRITICAL: Listener "${name}" failed on event "${event}" after ${attempt} attempts. Error:`, err);
                    throw err; // Propagate out of execution loop
                }
            }
        }
    }
    /** Utility helper to inspect active listener count (useful for testing leaks) */
    getListenerCount(event) {
        return this.listenersMap.get(event)?.length || 0;
    }
    /** Reset the EventBus state (mainly for test cleanup) */
    reset() {
        this.listenersMap.clear();
        this.activeEvents = [];
    }
}
exports.EventBus = EventBus;
