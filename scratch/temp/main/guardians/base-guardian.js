"use strict";
// ============================================================
// JARVIS V3 — Base Guardian Engine
// Abstract skeleton for independent security and context guardians
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseGuardian = void 0;
const crypto_1 = require("crypto");
const event_bus_1 = require("../event-bus");
class BaseGuardian {
    eventBus;
    name;
    active = true;
    subscriptions = [];
    constructor(name) {
        this.name = name;
        const realBus = event_bus_1.EventBus.getInstance();
        // Intercept subscriptions for active/idle dynamic unloading
        this.eventBus = {
            publish: (event, ...args) => realBus.publish(event, ...args),
            subscribe: (event, listener) => {
                realBus.subscribe(event, listener, { name: this.name });
                this.subscriptions.push({ event, listener });
                return this.eventBus;
            },
            unsubscribe: (event, listener) => {
                realBus.unsubscribe(event, listener);
                this.subscriptions = this.subscriptions.filter((s) => s.event !== event || s.listener !== listener);
                return this.eventBus;
            }
        };
        this.initialize();
    }
    /** Report a security threat to the Risk Engine */
    reportThreat(score, description, details) {
        if (!this.active)
            return;
        let severity = 'low';
        if (score >= 90)
            severity = 'critical';
        else if (score >= 70)
            severity = 'high';
        else if (score >= 40)
            severity = 'medium';
        const report = {
            id: (0, crypto_1.randomUUID)(),
            guardian: this.name,
            score,
            severity,
            description,
            details,
            timestamp: Date.now()
        };
        this.logWarn(`Threat reported (Score: ${score}): ${description}`);
        event_bus_1.EventBus.getInstance().publish('threat:detected', report);
    }
    /** Log an informational message */
    log(message, ...optionalParams) {
        console.log(`[Guardian:${this.name}] ${message}`, ...optionalParams);
    }
    /** Log a warning message */
    logWarn(message, ...optionalParams) {
        console.warn(`[Guardian:${this.name}] ${message}`, ...optionalParams);
    }
    /** Log an error message */
    logError(message, ...optionalParams) {
        console.error(`[Guardian:${this.name}] ${message}`, ...optionalParams);
    }
    /** Clear all active event bus subscriptions for this guardian */
    clearSubscriptions() {
        const realBus = event_bus_1.EventBus.getInstance();
        for (const sub of this.subscriptions) {
            realBus.unsubscribe(sub.event, sub.listener);
        }
        this.subscriptions = [];
    }
    /** Toggle active state based on context engine updates */
    setActive(active) {
        if (this.active === active)
            return;
        this.active = active;
        console.log(`[Guardian:${this.name}] Status changed: ${active ? 'ENABLED' : 'IDLE'}`);
        if (active) {
            this.initialize();
        }
        else {
            this.clearSubscriptions();
        }
    }
    getName() {
        return this.name;
    }
}
exports.BaseGuardian = BaseGuardian;
