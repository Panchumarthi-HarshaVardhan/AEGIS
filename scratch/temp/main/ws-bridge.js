"use strict";
// ============================================================
// JARVIS Guardian AI — WebSocket Bridge
// WebSocket server for Chrome extension communication
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSBridge = void 0;
const ws_1 = require("ws");
const phishing_detector_1 = require("./security/phishing-detector");
const provider_manager_1 = require("./provider-manager");
/**
 * WebSocket bridge for real-time communication with the Chrome extension.
 *
 * Provides a WebSocket server that the JARVIS Chrome extension connects
 * to for URL safety checks, content extraction, and status queries.
 * All messages are exchanged as JSON.
 *
 * @example
 * ```ts
 * const bridge = new WSBridge(8765, securityEngine, intentEngine)
 * bridge.start()
 * // Chrome extension connects to ws://localhost:8765
 * // Send a url_check message: { type: 'url_check', payload: { url: '...' } }
 *
 * // Later:
 * bridge.stop()
 * ```
 */
class WSBridge {
    port;
    securityEngine;
    intentEngine;
    phishingDetector;
    server = null;
    clients = new Set();
    heartbeatInterval = null;
    /**
     * Creates a new WSBridge instance.
     *
     * @param port - The port to listen on (default: 8765)
     * @param securityEngine - The security engine for URL checks
     * @param intentEngine - The intent engine for processing commands
     */
    constructor(port = 8765, securityEngine, intentEngine) {
        this.port = port;
        this.securityEngine = securityEngine;
        this.intentEngine = intentEngine;
        this.phishingDetector = new phishing_detector_1.PhishingDetector();
    }
    /**
     * Starts the WebSocket server and begins accepting connections.
     *
     * Sets up connection handlers, message routing, and error handling
     * for all incoming client connections.
     */
    start() {
        if (this.server) {
            console.warn('WSBridge: Server is already running');
            return;
        }
        // Bind specifically to 127.0.0.1 (localhost) to secure from external network calls
        this.server = new ws_1.WebSocketServer({ port: this.port, host: '127.0.0.1' });
        // Connection heartbeat to detect and close zombie connections (prevent memory leaks)
        this.heartbeatInterval = setInterval(() => {
            for (const client of this.clients) {
                if (client.isAlive === false) {
                    client.terminate();
                    this.clients.delete(client);
                    continue;
                }
                client.isAlive = false;
                client.ping();
            }
        }, 30000);
        this.server.on('listening', () => {
            console.log(`WSBridge: WebSocket server listening on port ${this.port}`);
        });
        this.server.on('connection', (ws) => {
            this.clients.add(ws);
            ws.isAlive = true;
            ws.on('pong', () => {
                ;
                ws.isAlive = true;
            });
            console.log(`WSBridge: Client connected (total: ${this.clients.size})`);
            ws.on('message', (data) => {
                this.handleMessage(ws, data).catch((error) => {
                    console.error('WSBridge: Error handling message:', error);
                    this.sendResponse(ws, {
                        type: 'error',
                        success: false,
                        error: 'Internal server error'
                    });
                });
            });
            ws.on('close', () => {
                this.clients.delete(ws);
                console.log(`WSBridge: Client disconnected (total: ${this.clients.size})`);
            });
            ws.on('error', (error) => {
                console.error('WSBridge: Client WebSocket error:', error.message);
                this.clients.delete(ws);
            });
            // Send welcome message
            this.sendResponse(ws, {
                type: 'connected',
                success: true,
                data: { message: 'JARVIS Guardian AI WebSocket bridge connected' }
            });
        });
        this.server.on('error', (error) => {
            console.error('WSBridge: Server error:', error.message);
        });
    }
    /**
     * Stops the WebSocket server and closes all client connections.
     *
     * Sends a graceful close to each connected client before
     * shutting down the server.
     */
    stop() {
        if (!this.server) {
            console.warn('WSBridge: Server is not running');
            return;
        }
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        // Close all client connections
        for (const client of this.clients) {
            try {
                client.close(1001, 'Server shutting down');
            }
            catch {
                // Ignore errors during shutdown
            }
        }
        this.clients.clear();
        // Close the server
        this.server.close((error) => {
            if (error) {
                console.error('WSBridge: Error closing server:', error.message);
            }
            else {
                console.log('WSBridge: Server stopped');
            }
        });
        this.server = null;
    }
    /**
     * Broadcasts a message to all connected clients.
     *
     * @param data - The data to broadcast (will be JSON-serialized)
     */
    broadcast(data) {
        const message = JSON.stringify(data);
        for (const client of this.clients) {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                try {
                    client.send(message);
                }
                catch (error) {
                    console.error('WSBridge: Error broadcasting to client:', error);
                }
            }
        }
    }
    /**
     * Gets the number of currently connected clients.
     *
     * @returns The count of active WebSocket connections
     */
    get connectedClients() {
        return this.clients.size;
    }
    // ─── Private Methods ──────────────────────────────────────
    /**
     * Handles an incoming WebSocket message.
     *
     * Parses the JSON message, validates its structure, and routes
     * it to the appropriate handler based on the message type.
     *
     * @param ws - The WebSocket connection that sent the message
     * @param raw - The raw message data (Buffer or string)
     */
    async handleMessage(ws, raw) {
        let message;
        try {
            const text = typeof raw === 'string' ? raw : raw.toString('utf-8');
            message = JSON.parse(text);
        }
        catch {
            this.sendResponse(ws, {
                type: 'error',
                success: false,
                error: 'Invalid JSON message'
            });
            return;
        }
        // Validate message structure
        if (!message.type || typeof message.type !== 'string') {
            this.sendResponse(ws, {
                type: 'error',
                id: message.id,
                success: false,
                error: 'Message must have a "type" field'
            });
            return;
        }
        // Route to handler
        switch (message.type) {
            case 'url_check':
            case 'analyzeUrl':
                await this.handleUrlCheck(ws, message);
                break;
            case 'extract_content':
            case 'summarizePage':
                await this.handleExtractContent(ws, message);
                break;
            case 'get_status':
                this.handleGetStatus(ws, message);
                break;
            default:
                this.sendResponse(ws, {
                    type: 'error',
                    id: message.id,
                    requestId: message.requestId,
                    success: false,
                    error: `Unknown message type: "${message.type}"`
                });
        }
    }
    /**
     * Handles a URL check request.
     *
     * Runs phishing analysis on the provided URL and returns
     * the analysis results.
     *
     * @param ws - The WebSocket connection
     * @param message - The incoming message with payload.url or url
     */
    async handleUrlCheck(ws, message) {
        const url = message.url || message.payload?.url;
        const requestId = message.requestId || message.id;
        if (typeof url !== 'string' || url.trim().length === 0) {
            this.sendResponse(ws, {
                type: 'url_check_result',
                id: message.id,
                requestId,
                success: false,
                error: 'Missing or invalid "url" in payload'
            });
            return;
        }
        try {
            const { EventBus } = require('./event-bus');
            EventBus.getInstance().publish('browser:navigation', url);
            const analysis = await this.phishingDetector.analyze(url);
            this.sendResponse(ws, {
                type: 'url_check_result',
                id: message.id,
                requestId,
                success: true,
                data: analysis
            });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.sendResponse(ws, {
                type: 'url_check_result',
                id: message.id,
                requestId,
                success: false,
                error: `URL analysis failed: ${errorMsg}`
            });
        }
    }
    /**
     * Handles a content extraction or page summarization request.
     *
     * @param ws - The WebSocket connection
     * @param message - The incoming message
     */
    async handleExtractContent(ws, message) {
        const content = message.content || message.payload?.content || '';
        const url = message.url || message.payload?.url || '';
        const requestId = message.requestId || message.id;
        if (typeof content !== 'string' || content.trim().length === 0) {
            this.sendResponse(ws, {
                type: 'extract_content_result',
                id: message.id,
                requestId,
                success: false,
                error: 'Missing or empty "content" in payload'
            });
            return;
        }
        // AI Page summarization request
        if (message.type === 'summarizePage') {
            const providerManager = provider_manager_1.ProviderManager.getInstance();
            const status = providerManager.getStatus();
            if (status.activeProvider === 'none') {
                this.sendResponse(ws, {
                    type: 'summarizePage_result',
                    id: message.id,
                    requestId,
                    success: true,
                    data: { summary: `No AI provider is configured. Please configure GROQ_API_KEY in your .env or run Ollama locally to enable summaries.` }
                });
                return;
            }
            try {
                let summary = '';
                if (status.activeProvider === 'groq') {
                    const apiKey = process.env.GROQ_API_KEY || '';
                    const GroqSdk = require('groq-sdk');
                    const groq = new GroqSdk({ apiKey });
                    const completion = await groq.chat.completions.create({
                        model: 'llama-3.3-70b-versatile',
                        messages: [
                            { role: 'system', content: 'You are JARVIS Guardian AI\'s web page summarization assistant. Summarize the provided page content (first 15000 chars) concisely and clearly.' },
                            { role: 'user', content: `Please summarize the following web page content:\n\n${content.substring(0, 15000)}` }
                        ]
                    });
                    summary = completion.choices?.[0]?.message?.content || 'Failed to generate page summary.';
                }
                else if (status.activeProvider === 'ollama') {
                    const response = await fetch('http://127.0.0.1:11434/api/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: status.models.completion,
                            messages: [
                                { role: 'system', content: 'You are JARVIS Guardian AI\'s web page summarization assistant. Summarize the provided page content (first 15000 chars) concisely and clearly.' },
                                { role: 'user', content: `Please summarize the following web page content:\n\n${content.substring(0, 15000)}` }
                            ],
                            stream: false
                        }),
                        signal: AbortSignal.timeout(30000)
                    });
                    if (!response.ok) {
                        throw new Error(`Ollama responded with status: ${response.status}`);
                    }
                    const data = (await response.json());
                    summary = data.message?.content || 'Failed to generate page summary.';
                }
                this.sendResponse(ws, {
                    type: 'summarizePage_result',
                    id: message.id,
                    requestId,
                    success: true,
                    data: { summary }
                });
            }
            catch (err) {
                console.error('[WSBridge] Summarization error:', err);
                this.sendResponse(ws, {
                    type: 'summarizePage_result',
                    id: message.id,
                    requestId,
                    success: false,
                    error: `Failed to summarize page: ${err instanceof Error ? err.message : String(err)}`
                });
            }
            return;
        }
        // Standard extract_content behavior
        this.sendResponse(ws, {
            type: 'extract_content_result',
            id: message.id,
            requestId,
            success: true,
            data: {
                received: true,
                content_length: content.length,
                source_url: url ?? null
            }
        });
    }
    /**
     * Handles a status request.
     *
     * Returns the current state of the WebSocket bridge
     * and connected services.
     *
     * @param ws - The WebSocket connection
     * @param message - The incoming message
     */
    handleGetStatus(ws, message) {
        this.sendResponse(ws, {
            type: 'status',
            id: message.id,
            success: true,
            data: {
                bridge_active: true,
                connected_clients: this.clients.size,
                security_engine: !!this.securityEngine,
                intent_engine: !!this.intentEngine
            }
        });
    }
    /**
     * Sends a JSON response to a WebSocket client.
     *
     * @param ws - The WebSocket connection to send to
     * @param response - The response data to serialize and send
     */
    sendResponse(ws, response) {
        if (ws.readyState !== ws_1.WebSocket.OPEN)
            return;
        try {
            ws.send(JSON.stringify(response));
        }
        catch (error) {
            console.error('WSBridge: Error sending response:', error);
        }
    }
}
exports.WSBridge = WSBridge;
