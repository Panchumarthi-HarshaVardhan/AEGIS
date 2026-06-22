// ============================================================
// JARVIS Guardian AI — WebSocket Bridge
// WebSocket server for Chrome extension communication
// ============================================================

import { WebSocketServer, WebSocket } from 'ws'
import type { SecurityEngine } from './engines/security-engine'
import type { IntentEngine } from './engines/intent-engine'
import { PhishingDetector } from './security/phishing-detector'
import { ProviderManager } from './provider-manager'
import { EventBus } from './event-bus'

/** Supported incoming message types from Chrome extension */
type WSMessageType = 'url_check' | 'extract_content' | 'get_status' | 'analyzeUrl' | 'summarizePage'

/** Shape of an incoming WebSocket message */
interface WSIncomingMessage {
  type: string
  id?: string
  requestId?: string | number
  payload?: Record<string, unknown>
  url?: string
  content?: string
}

/** Shape of an outgoing WebSocket response */
interface WSOutgoingMessage {
  type: string
  id?: string
  requestId?: string | number
  success: boolean
  data?: unknown
  error?: string
}

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
export class WSBridge {
  private readonly port: number
  private readonly securityEngine: SecurityEngine
  private readonly intentEngine: IntentEngine
  private readonly phishingDetector: PhishingDetector

  private server: WebSocketServer | null = null
  private clients: Set<WebSocket> = new Set()
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null

  /**
   * Creates a new WSBridge instance.
   *
   * @param port - The port to listen on (default: 8765)
   * @param securityEngine - The security engine for URL checks
   * @param intentEngine - The intent engine for processing commands
   */
  constructor(
    port: number = 8765,
    securityEngine: SecurityEngine,
    intentEngine: IntentEngine
  ) {
    this.port = port
    this.securityEngine = securityEngine
    this.intentEngine = intentEngine
    this.phishingDetector = new PhishingDetector()
  }

  /**
   * Starts the WebSocket server and begins accepting connections.
   *
   * Sets up connection handlers, message routing, and error handling
   * for all incoming client connections.
   */
  start(): void {
    if (this.server) {
      console.warn('WSBridge: Server is already running')
      return
    }

    // Bind specifically to 127.0.0.1 (localhost) and verify origins in connection handshakes
    this.server = new WebSocketServer({
      port: this.port,
      host: '127.0.0.1',
      verifyClient: (info, callback) => {
        const origin = (info.origin || '').trim()
        
        // Enforce origin validation to prevent Cross-Origin WebSocket Hijacking (CSWSH)
        const isAllowed = 
          origin === '' || 
          origin.startsWith('chrome-extension://') || 
          origin.startsWith('http://localhost:') || 
          origin.startsWith('http://127.0.0.1:')

        if (!isAllowed) {
          console.warn(`[Security] WSBridge: Blocked connection upgrade from forbidden origin: "${origin}"`)
          callback(false, 401, 'Unauthorized Origin')
        } else {
          callback(true)
        }
      }
    })

    // Connection heartbeat to detect and close zombie connections (prevent memory leaks)
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.clients) {
        if ((client as any).isAlive === false) {
          client.terminate()
          this.clients.delete(client)
          continue
        }
        (client as any).isAlive = false
        client.ping()
      }
    }, 30000)

    this.server.on('listening', () => {
      console.log(`WSBridge: WebSocket server listening on port ${this.port}`)
    })

    this.server.on('connection', (ws: WebSocket, req) => {
      const origin = (req.headers.origin || '').trim()

      this.clients.add(ws)
      ;(ws as any).isAlive = true

      ws.on('pong', () => {
        ;(ws as any).isAlive = true
      })
      console.log(`WSBridge: Client connected from ${origin || 'local client'} (total: ${this.clients.size})`)

      ws.on('message', (data: Buffer | string) => {
        this.handleMessage(ws, data).catch((error) => {
          console.error('WSBridge: Error handling message:', error)
          this.sendResponse(ws, {
            type: 'error',
            success: false,
            error: 'Internal server error'
          })
        })
      })

      ws.on('close', () => {
        this.clients.delete(ws)
        console.log(`WSBridge: Client disconnected (total: ${this.clients.size})`)
      })

      ws.on('error', (error) => {
        console.error('WSBridge: Client WebSocket error:', error.message)
        this.clients.delete(ws)
      })

      // Send welcome message
      this.sendResponse(ws, {
        type: 'connected',
        success: true,
        data: { message: 'JARVIS Guardian AI WebSocket bridge connected' }
      })
    })

    this.server.on('error', (error) => {
      console.error('WSBridge: Server error:', error.message)
    })
  }

  /**
   * Stops the WebSocket server and closes all client connections.
   *
   * Sends a graceful close to each connected client before
   * shutting down the server.
   */
  stop(): void {
    if (!this.server) {
      console.warn('WSBridge: Server is not running')
      return
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    // Close all client connections
    for (const client of this.clients) {
      try {
        client.close(1001, 'Server shutting down')
      } catch {
        // Ignore errors during shutdown
      }
    }
    this.clients.clear()

    // Close the server
    this.server.close((error) => {
      if (error) {
        console.error('WSBridge: Error closing server:', error.message)
      } else {
        console.log('WSBridge: Server stopped')
      }
    })
    this.server = null
  }

  /**
   * Broadcasts a message to all connected clients.
   *
   * @param data - The data to broadcast (will be JSON-serialized)
   */
  broadcast(data: unknown): void {
    const message = JSON.stringify(data)

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message)
        } catch (error) {
          console.error('WSBridge: Error broadcasting to client:', error)
        }
      }
    }
  }

  /**
   * Gets the number of currently connected clients.
   *
   * @returns The count of active WebSocket connections
   */
  get connectedClients(): number {
    return this.clients.size
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
  private async handleMessage(ws: WebSocket, raw: Buffer | string): Promise<void> {
    let message: WSIncomingMessage

    try {
      const text = typeof raw === 'string' ? raw : raw.toString('utf-8')
      message = JSON.parse(text) as WSIncomingMessage
    } catch {
      this.sendResponse(ws, {
        type: 'error',
        success: false,
        error: 'Invalid JSON message'
      })
      return
    }

    // Validate message structure
    if (!message.type || typeof message.type !== 'string') {
      this.sendResponse(ws, {
        type: 'error',
        id: message.id,
        success: false,
        error: 'Message must have a "type" field'
      })
      return
    }

    // Route to handler
    switch (message.type) {
      case 'url_check':
      case 'analyzeUrl':
        await this.handleUrlCheck(ws, message)
        break

      case 'extract_content':
      case 'summarizePage':
        await this.handleExtractContent(ws, message)
        break

      case 'get_status':
        this.handleGetStatus(ws, message)
        break

      default:
        this.sendResponse(ws, {
          type: 'error',
          id: message.id,
          requestId: message.requestId,
          success: false,
          error: `Unknown message type: "${message.type}"`
        })
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
  private async handleUrlCheck(ws: WebSocket, message: WSIncomingMessage): Promise<void> {
    const url = message.url || (message.payload?.url as string)
    const requestId = message.requestId || message.id

    if (typeof url !== 'string' || url.trim().length === 0) {
      this.sendResponse(ws, {
        type: 'url_check_result',
        id: message.id,
        requestId,
        success: false,
        error: 'Missing or invalid "url" in payload'
      })
      return
    }

    try {
      EventBus.getInstance().publish('browser:navigation', url)

      const analysis = await this.phishingDetector.analyze(url)

      this.sendResponse(ws, {
        type: 'url_check_result',
        id: message.id,
        requestId,
        success: true,
        data: analysis
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.sendResponse(ws, {
        type: 'url_check_result',
        id: message.id,
        requestId,
        success: false,
        error: `URL analysis failed: ${errorMsg}`
      })
    }
  }

  /**
   * Handles a content extraction or page summarization request.
   *
   * @param ws - The WebSocket connection
   * @param message - The incoming message
   */
  private async handleExtractContent(
    ws: WebSocket,
    message: WSIncomingMessage
  ): Promise<void> {
    const content = message.content || (message.payload?.content as string) || ''
    const url = message.url || (message.payload?.url as string) || ''
    const requestId = message.requestId || message.id

    if (typeof content !== 'string' || content.trim().length === 0) {
      this.sendResponse(ws, {
        type: 'extract_content_result',
        id: message.id,
        requestId,
        success: false,
        error: 'Missing or empty "content" in payload'
      })
      return
    }

    // AI Page summarization request
    if (message.type === 'summarizePage') {
      const providerManager = ProviderManager.getInstance()
      const status = providerManager.getStatus()

      if (status.activeProvider === 'none') {
        this.sendResponse(ws, {
          type: 'summarizePage_result',
          id: message.id,
          requestId,
          success: true,
          data: { summary: `No AI provider is configured. Please configure GROQ_API_KEY in your .env or run Ollama locally to enable summaries.` }
        })
        return
      }

      try {
        let summary = ''
        if (status.activeProvider === 'groq') {
          const apiKey = process.env.GROQ_API_KEY || ''
          const GroqSdk = require('groq-sdk')
          const groq = new GroqSdk({ apiKey })

          const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: 'You are JARVIS Guardian AI\'s web page summarization assistant. Summarize the provided page content (first 15000 chars) concisely and clearly.' },
              { role: 'user', content: `Please summarize the following web page content:\n\n${content.substring(0, 15000)}` }
            ]
          })
          summary = completion.choices?.[0]?.message?.content || 'Failed to generate page summary.'
        } else if (status.activeProvider === 'ollama') {
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
          })

          if (!response.ok) {
            throw new Error(`Ollama responded with status: ${response.status}`)
          }

          const data = (await response.json()) as { message?: { content?: string } }
          summary = data.message?.content || 'Failed to generate page summary.'
        }

        this.sendResponse(ws, {
          type: 'summarizePage_result',
          id: message.id,
          requestId,
          success: true,
          data: { summary }
        })
      } catch (err) {
        console.error('[WSBridge] Summarization error:', err)
        this.sendResponse(ws, {
          type: 'summarizePage_result',
          id: message.id,
          requestId,
          success: false,
          error: `Failed to summarize page: ${err instanceof Error ? err.message : String(err)}`
        })
      }
      return
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
    })
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
  private handleGetStatus(ws: WebSocket, message: WSIncomingMessage): void {
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
    })
  }

  /**
   * Sends a JSON response to a WebSocket client.
   *
   * @param ws - The WebSocket connection to send to
   * @param response - The response data to serialize and send
   */
  private sendResponse(ws: WebSocket, response: WSOutgoingMessage): void {
    if (ws.readyState !== WebSocket.OPEN) return

    try {
      ws.send(JSON.stringify(response))
    } catch (error) {
      console.error('WSBridge: Error sending response:', error)
    }
  }
}
