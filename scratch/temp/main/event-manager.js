"use strict";
// ============================================================
// JARVIS V3 — Event Manager
// Listens to operating system events (clipboard, active windows)
// and routes them to the central Event Bus
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventManager = void 0;
const electron_1 = require("electron");
const event_bus_1 = require("./event-bus");
const child_process_1 = require("child_process");
class EventManager {
    eventBus;
    clipboardInterval = null;
    windowProcess = null;
    lastClipboardText = '';
    lastFocusedApp = '';
    constructor() {
        this.eventBus = event_bus_1.EventBus.getInstance();
    }
    /** Start listening for system input events */
    start() {
        console.log('[EventManager] Starting system monitors...');
        // 1. Monitor Clipboard changes every 1s
        this.lastClipboardText = electron_1.clipboard.readText();
        this.clipboardInterval = setInterval(() => {
            try {
                const text = electron_1.clipboard.readText();
                if (text && text !== this.lastClipboardText) {
                    this.lastClipboardText = text;
                    this.eventBus.publish('clipboard:changed', text);
                }
            }
            catch (err) {
                console.error('[EventManager] Clipboard monitoring error:', err);
            }
        }, 1000);
        // 2. Monitor Active Window changes via persistent process
        this.eventBus.subscribe('window:focused', (appName) => {
            this.lastFocusedApp = appName;
        });
        if (process.platform === 'darwin' && process.env.JARVIS_PERF_MODE !== 'true') {
            const appleScript = `
        set lastApp to ""
        repeat
          try
            tell application "System Events" to set appName to name of first application process whose frontmost is true
            if appName is not lastApp then
              set lastApp to appName
              log appName
            end if
          end try
          delay 2
        end repeat
      `;
            try {
                this.windowProcess = (0, child_process_1.spawn)('osascript', ['-e', appleScript]);
                const handleData = (data) => {
                    const raw = data.toString();
                    const lines = raw.split('\n');
                    for (const line of lines) {
                        // Strip AppleScript log tags (*Safari*) if present, or take raw text
                        const appName = line.trim().replace(/^\(\*|\*\)$/g, '').trim();
                        if (appName && appName !== this.lastFocusedApp) {
                            this.eventBus.publish('window:focused', appName);
                        }
                    }
                };
                // osascript log outputs to stderr
                this.windowProcess.stderr?.on('data', handleData);
                this.windowProcess.stdout?.on('data', handleData);
                this.windowProcess.on('error', (err) => {
                    console.error('[EventManager] Window tracking process error:', err);
                });
            }
            catch (err) {
                console.error('[EventManager] Failed to spawn window tracking process:', err);
            }
        }
    }
    /** Stop background system polling loops */
    stop() {
        if (this.clipboardInterval) {
            clearInterval(this.clipboardInterval);
            this.clipboardInterval = null;
        }
        if (this.windowProcess) {
            this.windowProcess.kill();
            this.windowProcess = null;
        }
        console.log('[EventManager] System monitors stopped');
    }
    getLastClipboardText() {
        return this.lastClipboardText;
    }
    getLastFocusedApp() {
        return this.lastFocusedApp;
    }
}
exports.EventManager = EventManager;
