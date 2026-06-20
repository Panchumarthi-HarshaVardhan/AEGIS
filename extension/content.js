/**
 * AEGIS Security Companion — Content Script
 *
 * Injected into every page at document_idle.
 * Responsibilities:
 *  1. Extract structured page content for analysis
 *  2. Display warning banners when threats are detected
 */

(() => {
  'use strict';

  // Prevent double-injection
  if (window.__aegisSecurityCompanionInjected) return;
  window.__aegisSecurityCompanionInjected = true;

  // -------------------------------------------------------------------------
  // Content extraction
  // -------------------------------------------------------------------------

  /**
   * Extract structured content from the current page.
   * @returns {{ url: string, title: string, description: string, mainContent: string, headings: string[], links: Array<{ text: string, href: string }>, hasLoginForm: boolean }}
   */
  function extractPageContent() {
    // Description from meta tags
    const metaDesc =
      document.querySelector('meta[name="description"]')?.getAttribute('content') ||
      document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
      '';

    // Main content — strip non-content elements and get text
    const bodyClone = document.body.cloneNode(true);
    const stripSelectors = ['script', 'style', 'noscript', 'nav', 'footer', 'header', 'aside', 'iframe', '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]'];
    stripSelectors.forEach((sel) => {
      bodyClone.querySelectorAll(sel).forEach((el) => el.remove());
    });
    const mainContent = (bodyClone.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000);

    // Headings (h1 – h3)
    const headings = [];
    document.querySelectorAll('h1, h2, h3').forEach((h) => {
      const text = (h.textContent || '').trim();
      if (text) headings.push(text);
    });

    // Links (first 50)
    const links = [];
    const anchors = document.querySelectorAll('a[href]');
    for (let i = 0; i < Math.min(anchors.length, 50); i++) {
      const a = anchors[i];
      links.push({
        text: (a.textContent || '').trim().slice(0, 120),
        href: a.href
      });
    }

    // Login form detection — look for password inputs
    const hasLoginForm =
      document.querySelectorAll('input[type="password"]').length > 0;

    return {
      url: location.href,
      title: document.title || '',
      description: metaDesc,
      mainContent,
      headings,
      links,
      hasLoginForm
    };
  }

  // -------------------------------------------------------------------------
  // Warning banner
  // -------------------------------------------------------------------------

  /** @type {HTMLElement | null} */
  let activeBanner = null;

  /**
   * Show a warning banner at the top of the page.
   * @param {string} reason - Why the site is flagged
   */
  function showWarningBanner(reason) {
    // Remove any existing banner first
    if (activeBanner) {
      activeBanner.remove();
      activeBanner = null;
    }

    // Create container
    const banner = document.createElement('div');
    banner.id = 'aegis-security-companion-warning';

    // Inject isolated styles
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%);
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      line-height: 1.4;
      box-shadow: 0 4px 20px rgba(220, 38, 38, 0.4);
      transform: translateY(-100%);
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      box-sizing: border-box;
    `;

    // Warning content
    const content = document.createElement('div');
    content.style.cssText = 'display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;';

    const icon = document.createElement('span');
    icon.textContent = '⚠️';
    icon.style.cssText = 'font-size: 20px; flex-shrink: 0;';

    const label = document.createElement('span');
    label.style.cssText = 'font-weight: 700; flex-shrink: 0;';
    label.textContent = 'AEGIS Security Companion:';

    const msg = document.createElement('span');
    msg.style.cssText = 'opacity: 0.95; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    msg.textContent = `This site may be dangerous — ${reason}`;

    content.appendChild(icon);
    content.appendChild(label);
    content.appendChild(msg);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Dismiss warning');
    closeBtn.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: #ffffff;
      font-size: 16px;
      font-weight: 700;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-left: 12px;
      transition: background 0.2s;
      padding: 0;
      line-height: 1;
    `;
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.35)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    });
    closeBtn.addEventListener('click', () => {
      banner.style.transform = 'translateY(-100%)';
      setTimeout(() => {
        banner.remove();
        activeBanner = null;
        // Restore page padding
        document.body.style.transition = 'padding-top 0.4s ease';
        document.body.style.paddingTop = '';
      }, 400);
    });

    banner.appendChild(content);
    banner.appendChild(closeBtn);
    document.body.appendChild(banner);
    activeBanner = banner;

    // Trigger slide-down animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        banner.style.transform = 'translateY(0)';
        // Push page content down
        document.body.style.transition = 'padding-top 0.4s ease';
        document.body.style.paddingTop = '52px';
      });
    });
  }

  // -------------------------------------------------------------------------
  // Message listener
  // -------------------------------------------------------------------------

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    try {
      switch (message.type) {
        case 'extractContent':
          sendResponse(extractPageContent());
          break;

        case 'showWarning':
          showWarningBanner(message.reason || 'Potential security threat detected');
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (err) {
      console.error('[AEGIS Content] Error handling message:', err);
      sendResponse({ error: err.message });
    }
    return false; // synchronous response
  });
})();
