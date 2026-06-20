/**
 * AEGIS Security Companion — Popup Script
 *
 * Renders analysis results, manages UI interactions, communicates with
 * the background service worker and (indirectly) the content script.
 */

(() => {
  'use strict';

  // -----------------------------------------------------------------------
  // DOM refs
  // -----------------------------------------------------------------------

  const $ = (id) => document.getElementById(id);

  const dom = {
    statusDot:       $('statusDot'),
    statusLabel:     $('statusLabel'),
    currentUrl:      $('currentUrl'),
    riskProgress:    $('riskProgress'),
    riskNumber:      $('riskNumber'),
    riskVerdict:     $('riskVerdict'),
    riskVerdictSub:  $('riskVerdictSub'),
    signalsList:     $('signalsList'),
    btnSummarize:    $('btnSummarize'),
    btnCheckLinks:   $('btnCheckLinks'),
    actionResults:   $('actionResults')
  };

  // -----------------------------------------------------------------------
  // Constants
  // -----------------------------------------------------------------------

  const CIRCUMFERENCE = 2 * Math.PI * 52; // matches SVG circle r=52

  const SEVERITY_ICONS = {
    high:   '🔴',
    medium: '🟡',
    low:    '🔵',
    info:   'ℹ️'
  };

  const VERDICT_COLORS = {
    SAFE:       '#22c55e',
    SUSPICIOUS: '#eab308',
    DANGEROUS:  '#ef4444',
    UNKNOWN:    '#6b7280'
  };

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  let currentTabId = null;
  let currentTabUrl = '';
  let isConnected = false;

  // -----------------------------------------------------------------------
  // Initialisation
  // -----------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', async () => {
    await init();
    bindActions();
  });

  async function init() {
    // 1. Get the active tab
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        currentTabId = tab.id;
        currentTabUrl = tab.url || '';
        dom.currentUrl.textContent = truncateUrl(currentTabUrl, 50);
        dom.currentUrl.title = currentTabUrl;
      }
    } catch (err) {
      console.error('[Popup] Failed to get active tab:', err);
      dom.currentUrl.textContent = 'Unable to read tab';
    }

    // 2. Check connection status
    checkConnectionStatus();

    // 3. Load / compute analysis
    if (currentTabId !== null) {
      await loadAnalysis();
    }
  }

  // -----------------------------------------------------------------------
  // Connection status
  // -----------------------------------------------------------------------

  function checkConnectionStatus() {
    chrome.runtime.sendMessage({ type: 'ping' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        setConnectionUI(false);
        return;
      }
      setConnectionUI(response.connected);
    });
  }

  function setConnectionUI(connected) {
    isConnected = connected;
    dom.statusDot.className = `status-dot ${connected ? 'connected' : 'disconnected'}`;
    dom.statusLabel.textContent = connected ? 'Connected' : 'Offline';
  }

  // Listen for live connection changes from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'connectionStatus') {
      setConnectionUI(msg.connected);
    }
  });

  // -----------------------------------------------------------------------
  // Analysis loading
  // -----------------------------------------------------------------------

  async function loadAnalysis() {
    // Try cached result first
    try {
      const key = `tab_${currentTabId}`;
      const data = await chrome.storage.local.get(key);
      const cached = data[key];

      if (cached && cached.url === currentTabUrl) {
        renderAnalysis(cached);
        return;
      }
    } catch {
      // ignore
    }

    // No cache — request fresh analysis from background
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'analyzeUrl',
        url: currentTabUrl,
        tabId: currentTabId
      });
      if (result) {
        renderAnalysis(result);
      }
    } catch (err) {
      console.error('[Popup] Analysis request failed:', err);
      renderError();
    }
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  function renderAnalysis(data) {
    const analysis = data.localAnalysis || {};
    const score = data.mergedScore ?? analysis.score ?? 0;
    const verdict = data.mergedVerdict || analysis.verdict || 'UNKNOWN';
    const signals = analysis.signals || [];

    // Risk circle
    setRiskCircle(score, verdict);

    // Verdict text
    dom.riskVerdict.textContent = verdict;
    dom.riskVerdict.className = `risk-verdict ${verdict.toLowerCase()}`;
    dom.riskVerdictSub.textContent =
      data.electronAnalysis ? 'Deep analysis complete' :
      isConnected ? 'Local analysis — deep scan pending' :
      'Local analysis only';

    // Signals
    renderSignals(signals, verdict);
  }

  function setRiskCircle(score, verdict) {
    // Animate the score number
    animateNumber(dom.riskNumber, score);

    // SVG stroke offset
    const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;
    dom.riskProgress.style.strokeDashoffset = offset;
    dom.riskProgress.style.stroke = VERDICT_COLORS[verdict] || VERDICT_COLORS.UNKNOWN;

    // Score text color
    dom.riskNumber.style.color = VERDICT_COLORS[verdict] || VERDICT_COLORS.UNKNOWN;
  }

  function animateNumber(el, target) {
    const duration = 800;
    const start = parseInt(el.textContent) || 0;
    const diff = target - start;
    if (diff === 0) { el.textContent = target; return; }
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(start + diff * eased);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function renderSignals(signals, verdict) {
    dom.signalsList.innerHTML = '';

    if (signals.length === 0) {
      if (verdict === 'SAFE') {
        const safe = document.createElement('div');
        safe.className = 'signal-safe-msg';
        safe.innerHTML = '✅ <span>No threats detected — this page looks safe.</span>';
        dom.signalsList.appendChild(safe);
      } else {
        const empty = document.createElement('div');
        empty.className = 'signal-empty';
        empty.textContent = 'No signals detected.';
        dom.signalsList.appendChild(empty);
      }
      return;
    }

    for (const signal of signals) {
      const item = document.createElement('div');
      item.className = `signal-item severity-${signal.severity || 'info'}`;

      const icon = document.createElement('span');
      icon.className = 'signal-icon';
      icon.textContent = SEVERITY_ICONS[signal.severity] || 'ℹ️';

      const text = document.createElement('span');
      text.className = 'signal-text';
      text.textContent = signal.message;

      item.appendChild(icon);
      item.appendChild(text);
      dom.signalsList.appendChild(item);
    }
  }

  function renderError() {
    dom.riskNumber.textContent = '—';
    dom.riskVerdict.textContent = 'Error';
    dom.riskVerdict.className = 'risk-verdict';
    dom.riskVerdictSub.textContent = 'Could not analyse this page';
    dom.signalsList.innerHTML = '<div class="signal-empty">Analysis unavailable for this page.</div>';
  }

  // -----------------------------------------------------------------------
  // Quick Actions
  // -----------------------------------------------------------------------

  function bindActions() {
    dom.btnSummarize.addEventListener('click', handleSummarize);
    dom.btnCheckLinks.addEventListener('click', handleCheckLinks);
  }

  async function handleSummarize() {
    if (!currentTabId) return;
    dom.btnSummarize.disabled = true;
    showActionResults('<span class="spinner"></span> Extracting page content…');

    try {
      // 1. Extract content from page
      const content = await chrome.runtime.sendMessage({
        type: 'extractContent',
        tabId: currentTabId
      });

      if (!content || content.error) {
        showActionResults(`⚠️ Could not extract page content: ${content?.error || 'unknown error'}`);
        return;
      }

      // 2. Try AI summary via Electron
      if (isConnected) {
        showActionResults('<span class="spinner"></span> Generating AI summary…');
        try {
          const summary = await chrome.runtime.sendMessage({
            type: 'summarizePage',
            content
          });
          if (summary && summary.summary) {
            showActionResults(`<h4>📝 Page Summary</h4><p>${escapeHtml(summary.summary)}</p>`);
          } else if (summary && summary.error) {
            showFallbackSummary(content);
          } else {
            showFallbackSummary(content);
          }
        } catch {
          showFallbackSummary(content);
        }
      } else {
        showFallbackSummary(content);
      }
    } catch (err) {
      showActionResults(`⚠️ Error: ${err.message}`);
    } finally {
      dom.btnSummarize.disabled = false;
    }
  }

  function showFallbackSummary(content) {
    const parts = [];
    parts.push(`<h4>📝 Page Overview</h4>`);
    if (content.title) parts.push(`<p><strong>Title:</strong> ${escapeHtml(content.title)}</p>`);
    if (content.description) parts.push(`<p><strong>Description:</strong> ${escapeHtml(content.description)}</p>`);
    if (content.headings && content.headings.length > 0) {
      parts.push(`<p><strong>Key sections:</strong> ${content.headings.slice(0, 5).map(escapeHtml).join(' · ')}</p>`);
    }
    if (content.hasLoginForm) {
      parts.push(`<p>⚠️ <strong>This page contains a login form.</strong></p>`);
    }
    parts.push(`<p style="color: var(--text-muted); margin-top: 6px; font-size: 0.7rem;">Connect to AEGIS app for a full AI-powered summary.</p>`);
    showActionResults(parts.join(''));
  }

  async function handleCheckLinks() {
    if (!currentTabId) return;
    dom.btnCheckLinks.disabled = true;
    showActionResults('<span class="spinner"></span> Extracting links…');

    try {
      const content = await chrome.runtime.sendMessage({
        type: 'extractContent',
        tabId: currentTabId
      });

      if (!content || content.error || !content.links || content.links.length === 0) {
        showActionResults('ℹ️ No links found on this page.');
        return;
      }

      showActionResults('<span class="spinner"></span> Analysing links…');

      const analyzed = await chrome.runtime.sendMessage({
        type: 'analyzeLinks',
        links: content.links
      });

      if (!analyzed || analyzed.error) {
        showActionResults('⚠️ Link analysis failed.');
        return;
      }

      // Render results
      const dangerous = analyzed.filter((l) => l.analysis.verdict === 'DANGEROUS');
      const suspicious = analyzed.filter((l) => l.analysis.verdict === 'SUSPICIOUS');
      const safe = analyzed.filter((l) => l.analysis.verdict === 'SAFE');

      let html = `<h4>🔍 Link Analysis (${analyzed.length} links)</h4>`;

      if (dangerous.length > 0) {
        html += `<p style="color: var(--color-dangerous); font-weight: 600;">🔴 ${dangerous.length} dangerous</p>`;
        html += renderLinkList(dangerous);
      }
      if (suspicious.length > 0) {
        html += `<p style="color: var(--color-suspicious); font-weight: 600;">🟡 ${suspicious.length} suspicious</p>`;
        html += renderLinkList(suspicious);
      }
      html += `<p style="color: var(--color-safe);">✅ ${safe.length} safe links</p>`;

      showActionResults(html);
    } catch (err) {
      showActionResults(`⚠️ Error: ${err.message}`);
    } finally {
      dom.btnCheckLinks.disabled = false;
    }
  }

  function renderLinkList(links) {
    return links
      .map((l) => {
        const verdict = l.analysis.verdict.toLowerCase();
        const url = escapeHtml(l.href || '');
        const text = escapeHtml(l.text || url).slice(0, 40);
        return `<div class="result-link">
          <span class="link-url" title="${url}">${text || url}</span>
          <span class="link-badge ${verdict}">${verdict}</span>
        </div>`;
      })
      .join('');
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function showActionResults(html) {
    dom.actionResults.innerHTML = html;
    dom.actionResults.hidden = false;
  }

  function truncateUrl(url, max) {
    try {
      const u = new URL(url);
      const display = u.hostname + u.pathname;
      return display.length > max ? display.slice(0, max) + '…' : display;
    } catch {
      return url.length > max ? url.slice(0, max) + '…' : url;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
