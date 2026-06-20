/**
 * AEGIS Security Companion — Background Service Worker
 *
 * Responsibilities:
 *  1. WebSocket connection to the Electron app (ws://localhost:8765)
 *  2. Auto-reconnect via chrome.alarms
 *  3. Local URL threat analysis (fast, offline-capable)
 *  4. Badge updates based on risk level
 *  5. Message routing between content scripts, popup, and Electron
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WS_URL = 'ws://localhost:8765';
const RECONNECT_ALARM = 'aegis-ws-reconnect';
const RECONNECT_INTERVAL_MIN = 0.5; // 30 seconds

const SUSPICIOUS_TLDS = ['.xyz', '.top', '.club', '.tk', '.gq', '.ml', '.cf', '.ga', '.buzz', '.rest', '.surf'];

const BRAND_KEYWORDS = [
  'google', 'amazon', 'paypal', 'facebook', 'apple', 'microsoft',
  'netflix', 'chase', 'wellsfargo', 'bankofamerica', 'instagram',
  'twitter', 'linkedin', 'dropbox', 'icloud', 'outlook'
];

const LEGITIMATE_DOMAINS = {
  google:         ['google.com', 'google.co', 'googleapis.com', 'gstatic.com'],
  amazon:         ['amazon.com', 'amazon.co', 'amazonaws.com', 'amzn.to'],
  paypal:         ['paypal.com', 'paypal.me'],
  facebook:       ['facebook.com', 'fb.com', 'fb.me', 'fbcdn.net'],
  apple:          ['apple.com', 'icloud.com', 'apple.co'],
  microsoft:      ['microsoft.com', 'live.com', 'outlook.com', 'office.com', 'azure.com'],
  netflix:        ['netflix.com'],
  chase:          ['chase.com'],
  wellsfargo:     ['wellsfargo.com'],
  bankofamerica:  ['bankofamerica.com'],
  instagram:      ['instagram.com'],
  twitter:        ['twitter.com', 'x.com'],
  linkedin:       ['linkedin.com'],
  dropbox:        ['dropbox.com'],
  icloud:         ['icloud.com'],
  outlook:        ['outlook.com', 'outlook.live.com']
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** @type {WebSocket | null} */
let ws = null;
let wsConnected = false;

/** Pending Electron responses keyed by request id */
const pendingRequests = new Map();
let requestIdCounter = 0;

// ---------------------------------------------------------------------------
// WebSocket management
// ---------------------------------------------------------------------------

function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return; // already connected / connecting
  }

  try {
    ws = new WebSocket(WS_URL);

    ws.addEventListener('open', () => {
      console.log('[AEGIS] WebSocket connected');
      wsConnected = true;
      // Notify any open popup
      broadcastConnectionStatus(true);
    });

    ws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        handleElectronMessage(data);
      } catch (err) {
        console.warn('[AEGIS] Failed to parse WS message:', err);
      }
    });

    ws.addEventListener('close', () => {
      console.log('[AEGIS] WebSocket disconnected');
      wsConnected = false;
      ws = null;
      broadcastConnectionStatus(false);
      scheduleReconnect();
    });

    ws.addEventListener('error', (err) => {
      console.warn('[AEGIS] WebSocket error:', err);
      wsConnected = false;
      // The 'close' event will fire after this, which schedules reconnect
    });
  } catch (err) {
    console.error('[AEGIS] Failed to create WebSocket:', err);
    wsConnected = false;
    scheduleReconnect();
  }
}

/**
 * Helper to wait for the WebSocket connection to establish if it is currently connecting or disconnected.
 * @param {number} timeoutMs - Maximum time to wait.
 * @returns {Promise<boolean>} Resolves to true if connected, false otherwise.
 */
function waitForConnection(timeoutMs = 1500) {
  return new Promise((resolve) => {
    if (wsConnected && ws && ws.readyState === WebSocket.OPEN) {
      resolve(true);
      return;
    }
    
    // If disconnected, try to initiate connection immediately
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      connectWebSocket();
    }
    
    const checkInterval = 50;
    let elapsed = 0;
    const interval = setInterval(() => {
      if (wsConnected && ws && ws.readyState === WebSocket.OPEN) {
        clearInterval(interval);
        resolve(true);
      } else if (!ws || ws.readyState === WebSocket.CLOSED || elapsed >= timeoutMs) {
        clearInterval(interval);
        resolve(wsConnected && ws && ws.readyState === WebSocket.OPEN);
      }
      elapsed += checkInterval;
    }, checkInterval);
  });
}

function scheduleReconnect() {
  chrome.alarms.create(RECONNECT_ALARM, { delayInMinutes: RECONNECT_INTERVAL_MIN });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RECONNECT_ALARM) {
    connectWebSocket();
  }
});

function sendToElectron(payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
    return true;
  }
  return false;
}

function broadcastConnectionStatus(connected) {
  chrome.runtime.sendMessage({ type: 'connectionStatus', connected }).catch(() => {
    /* popup might not be open — safe to ignore */
  });
}

// ---------------------------------------------------------------------------
// Electron message handler
// ---------------------------------------------------------------------------

function handleElectronMessage(data) {
  // Response to a pending analysis request
  if (data.requestId && pendingRequests.has(data.requestId)) {
    const { resolve } = pendingRequests.get(data.requestId);
    pendingRequests.delete(data.requestId);
    resolve(data);
    return;
  }

  // Unsolicited messages from Electron (e.g. threat alerts)
  if (data.type === 'threatAlert' && data.tabId) {
    handleThreatAlert(data);
  }
}

function requestElectronAnalysis(url) {
  return new Promise((resolve, reject) => {
    const id = ++requestIdCounter;
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('Electron analysis timeout'));
    }, 15_000);

    pendingRequests.set(id, {
      resolve: (data) => {
        clearTimeout(timeout);
        resolve(data);
      }
    });

    const sent = sendToElectron({ type: 'analyzeUrl', requestId: id, url });
    if (!sent) {
      clearTimeout(timeout);
      pendingRequests.delete(id);
      reject(new Error('WebSocket not connected'));
    }
  });
}

// ---------------------------------------------------------------------------
// Local URL analysis
// ---------------------------------------------------------------------------

/**
 * Analyse a URL locally and return signals + risk score.
 * @param {string} urlStr
 * @returns {{ score: number, verdict: string, signals: Array<{ type: string, severity: string, message: string }> }}
 */
function analyzeUrlLocally(urlStr) {
  const signals = [];
  let score = 0; // 0 = safe, 100 = maximum danger

  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { score: 0, verdict: 'UNKNOWN', signals: [{ type: 'parse_error', severity: 'info', message: 'Unable to parse URL' }] };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Skip analysis for known safe / internal URLs
  if (['chrome:', 'chrome-extension:', 'about:', 'file:', 'devtools:'].includes(parsed.protocol)) {
    return { score: 0, verdict: 'SAFE', signals: [] };
  }

  // 1. IP address as hostname
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith('[')) {
    signals.push({ type: 'ip_hostname', severity: 'high', message: 'IP address used as hostname — often indicates phishing' });
    score += 30;
  }

  // 2. Suspicious TLDs
  const tld = '.' + hostname.split('.').pop();
  if (SUSPICIOUS_TLDS.includes(tld)) {
    signals.push({ type: 'suspicious_tld', severity: 'medium', message: `Suspicious TLD detected: ${tld}` });
    score += 20;
  }

  // 3. Excessive subdomains (> 3 labels)
  const labels = hostname.split('.');
  if (labels.length > 4) {
    signals.push({ type: 'excessive_subdomains', severity: 'medium', message: `Excessive subdomains (${labels.length - 1}) — potential phishing tactic` });
    score += 15;
  }

  // 4. @ symbol in URL (credential harvesting trick)
  if (urlStr.includes('@')) {
    signals.push({ type: 'at_symbol', severity: 'high', message: '@ symbol in URL — may redirect to a different host' });
    score += 25;
  }

  // 5. Punycode / IDN homograph
  if (hostname.includes('xn--')) {
    signals.push({ type: 'punycode', severity: 'high', message: 'Punycode / internationalized domain — possible homograph attack' });
    score += 25;
  }

  // 6. Brand typosquatting
  for (const brand of BRAND_KEYWORDS) {
    if (!hostname.includes(brand)) continue;
    const legit = LEGITIMATE_DOMAINS[brand] || [];
    const isLegitimate = legit.some((d) => hostname === d || hostname.endsWith('.' + d));
    if (!isLegitimate) {
      signals.push({ type: 'typosquatting', severity: 'high', message: `Domain impersonates "${brand}" but is not an official domain` });
      score += 35;
      break; // one is enough
    }
  }

  // 7. Very long hostname (> 50 chars)
  if (hostname.length > 50) {
    signals.push({ type: 'long_hostname', severity: 'low', message: 'Unusually long hostname — may be obfuscation' });
    score += 10;
  }

  // 8. Suspicious keywords in path
  const suspiciousPathKeywords = ['login', 'signin', 'verify', 'account', 'secure', 'update', 'confirm', 'banking', 'password'];
  const pathLower = parsed.pathname.toLowerCase();
  const matchedPathKeywords = suspiciousPathKeywords.filter((kw) => pathLower.includes(kw));
  if (matchedPathKeywords.length >= 2) {
    signals.push({ type: 'suspicious_path', severity: 'medium', message: `Suspicious keywords in path: ${matchedPathKeywords.join(', ')}` });
    score += 15;
  }

  // 9. HTTP (non-secure) on non-localhost
  if (parsed.protocol === 'http:' && hostname !== 'localhost' && !hostname.startsWith('127.') && !hostname.startsWith('192.168.')) {
    signals.push({ type: 'no_https', severity: 'low', message: 'Site does not use HTTPS — data is transmitted unencrypted' });
    score += 10;
  }

  // Cap at 100
  score = Math.min(score, 100);

  // Derive verdict
  let verdict = 'SAFE';
  if (score >= 60) verdict = 'DANGEROUS';
  else if (score >= 25) verdict = 'SUSPICIOUS';

  return { score, verdict, signals };
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function updateBadge(tabId, verdict) {
  const config = {
    SAFE:       { text: '✓', color: '#22c55e' },
    SUSPICIOUS: { text: '!', color: '#eab308' },
    DANGEROUS:  { text: '✕', color: '#ef4444' },
    UNKNOWN:    { text: '?', color: '#6b7280' }
  };

  const { text, color } = config[verdict] || config.UNKNOWN;

  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Tab navigation listener
// ---------------------------------------------------------------------------

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  // Skip internal chrome pages
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) return;

  // Run local analysis
  const localResult = analyzeUrlLocally(tab.url);
  updateBadge(tabId, localResult.verdict);

  // Store result
  const resultPayload = {
    url: tab.url,
    localAnalysis: localResult,
    electronAnalysis: null,
    timestamp: Date.now()
  };

  await chrome.storage.local.set({ [`tab_${tabId}`]: resultPayload }).catch(() => {});

  // Wait a short duration to see if WebSocket connects (crucial when SW wakes up from sleep)
  const isAvailable = await waitForConnection(1500);

  // If connected to Electron, request deep analysis asynchronously
  if (isAvailable) {
    try {
      const deepResult = await requestElectronAnalysis(tab.url);
      resultPayload.electronAnalysis = deepResult;

      // Merge scores — take the higher risk
      if (deepResult && typeof deepResult.score === 'number') {
        const mergedScore = Math.max(localResult.score, deepResult.score);
        let mergedVerdict = 'SAFE';
        if (mergedScore >= 60) mergedVerdict = 'DANGEROUS';
        else if (mergedScore >= 25) mergedVerdict = 'SUSPICIOUS';

        resultPayload.mergedScore = mergedScore;
        resultPayload.mergedVerdict = mergedVerdict;
        updateBadge(tabId, mergedVerdict);
      }

      await chrome.storage.local.set({ [`tab_${tabId}`]: resultPayload }).catch(() => {});

      // Show warning banner for dangerous pages
      if ((resultPayload.mergedVerdict || localResult.verdict) === 'DANGEROUS') {
        const reason = deepResult.reason || localResult.signals[0]?.message || 'Multiple threat signals detected';
        chrome.tabs.sendMessage(tabId, { type: 'showWarning', reason }).catch(() => {});
      }
    } catch {
      // Electron analysis failed — local result stands
    }
  } else {
    // Show warning for dangerous pages even without Electron
    if (localResult.verdict === 'DANGEROUS') {
      const reason = localResult.signals[0]?.message || 'Multiple threat signals detected';
      chrome.tabs.sendMessage(tabId, { type: 'showWarning', reason }).catch(() => {});
    }
  }
});

// ---------------------------------------------------------------------------
// Handle threat alerts pushed from Electron
// ---------------------------------------------------------------------------

function handleThreatAlert(data) {
  const { tabId, reason, score } = data;
  if (tabId) {
    updateBadge(tabId, score >= 60 ? 'DANGEROUS' : 'SUSPICIOUS');
    chrome.tabs.sendMessage(tabId, { type: 'showWarning', reason }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Message listener (from popup.js / content.js)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = messageHandlers[message.type];
  if (handler) {
    // Support async handlers
    const result = handler(message, sender);
    if (result instanceof Promise) {
      result.then(sendResponse).catch((err) => sendResponse({ error: err.message }));
      return true; // keep channel open for async response
    }
    sendResponse(result);
    return false;
  }
  return false;
});

const messageHandlers = {
  /**
   * Popup requests the analysis for a specific tab.
   */
  getAnalysis: async (message) => {
    const tabId = message.tabId;
    const data = await chrome.storage.local.get(`tab_${tabId}`);
    return data[`tab_${tabId}`] || null;
  },

  /**
   * Popup or content script asks for connection status.
   */
  getConnectionStatus: () => {
    return { connected: wsConnected };
  },

  /**
   * Popup pings to check liveness.
   */
  ping: () => {
    return { pong: true, connected: wsConnected };
  },

  /**
   * Popup requests a fresh analysis of a URL.
   */
  analyzeUrl: async (message) => {
    const { url, tabId } = message;
    const isAvailable = await waitForConnection(1000);
    const localResult = analyzeUrlLocally(url);
    if (tabId) updateBadge(tabId, localResult.verdict);

    const resultPayload = {
      url,
      localAnalysis: localResult,
      electronAnalysis: null,
      timestamp: Date.now()
    };

    if (isAvailable) {
      try {
        const deepResult = await requestElectronAnalysis(url);
        resultPayload.electronAnalysis = deepResult;
        if (deepResult && typeof deepResult.score === 'number') {
          const merged = Math.max(localResult.score, deepResult.score);
          resultPayload.mergedScore = merged;
          resultPayload.mergedVerdict = merged >= 60 ? 'DANGEROUS' : merged >= 25 ? 'SUSPICIOUS' : 'SAFE';
          if (tabId) updateBadge(tabId, resultPayload.mergedVerdict);
        }
      } catch {
        // Local result only
      }
    }

    if (tabId) await chrome.storage.local.set({ [`tab_${tabId}`]: resultPayload }).catch(() => {});
    return resultPayload;
  },

  /**
   * Popup requests page content extraction (forwarded to content script).
   */
  extractContent: async (message) => {
    const tabId = message.tabId;
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: 'extractContent' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  },

  /**
   * Forward content to Electron for AI summarisation.
   */
  summarizePage: async (message) => {
    const isAvailable = await waitForConnection(1500);
    if (!isAvailable) {
      return { error: 'Not connected to AEGIS app' };
    }
    return new Promise((resolve, reject) => {
      const id = ++requestIdCounter;
      const timeout = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error('Summary request timeout'));
      }, 30_000);

      pendingRequests.set(id, {
        resolve: (data) => {
          clearTimeout(timeout);
          resolve(data);
        }
      });

      sendToElectron({ type: 'summarizePage', requestId: id, content: message.content });
    });
  },

  /**
   * Analyse a batch of links locally.
   */
  analyzeLinks: async (message) => {
    const links = message.links || [];
    return links.map((link) => ({
      ...link,
      analysis: analyzeUrlLocally(link.href)
    }));
  }
};

// ---------------------------------------------------------------------------
// Cleanup old tab data when tab is closed
// ---------------------------------------------------------------------------

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(`tab_${tabId}`).catch(() => {});
});

// ---------------------------------------------------------------------------
// Init — connect on service worker start
// ---------------------------------------------------------------------------

connectWebSocket();
