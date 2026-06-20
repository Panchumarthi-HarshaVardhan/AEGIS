"use strict";
// ============================================================
// JARVIS V3 — Playwright Automation Engine
// Automates music streaming on Spotify Web Player and YouTube
// by controlling local Google Chrome via Playwright
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightAutomation = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
/**
 * Automates playback on YouTube and Spotify Web Player using Playwright-Core.
 * Attempts to launch the native Chrome application on macOS.
 */
class PlaywrightAutomation {
    chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    /**
     * Automate music search and playback on YouTube or Spotify.
     */
    async playMusic(query, platform) {
        console.log(`[PlaywrightAutomation] Automating "${query}" on ${platform}...`);
        // Check if Playwright-Core is available
        let playwright;
        try {
            playwright = require('playwright-core');
        }
        catch {
            console.warn('[PlaywrightAutomation] playwright-core is not installed. Falling back to native open.');
            await this.nativeFallback(query, platform);
            return;
        }
        // Check if Chrome exists
        const hasChrome = fs.existsSync(this.chromePath);
        if (!hasChrome) {
            console.warn('[PlaywrightAutomation] Google Chrome not found at standard path. Falling back to default browser.');
            await this.nativeFallback(query, platform);
            return;
        }
        try {
            const browser = await playwright.chromium.launch({
                headless: false,
                executablePath: this.chromePath,
                args: ['--start-maximized']
            });
            const context = await browser.newContext({
                viewport: null
            });
            const page = await context.newPage();
            if (platform === 'youtube') {
                const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                await page.goto(url, { waitUntil: 'domcontentloaded' });
                // Wait for first video and click it
                try {
                    const videoSelector = 'ytd-video-renderer a#video-title';
                    await page.waitForSelector(videoSelector, { timeout: 8000 });
                    await page.click(videoSelector);
                    console.log('[PlaywrightAutomation] YouTube video clicked and playing.');
                }
                catch (e) {
                    console.warn('[PlaywrightAutomation] Failed to click video on YouTube, playing fallback.', e);
                    // Go to first video query link directly
                    await page.evaluate(() => {
                        const link = document.querySelector('ytd-video-renderer a#video-title');
                        if (link)
                            link.click();
                    });
                }
            }
            else {
                // Spotify Web Player search
                const url = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
                await page.goto(url, { waitUntil: 'domcontentloaded' });
                try {
                    const trackSelector = 'section[data-testid="search-track-results-section"] [data-testid="tracklist-row"]';
                    await page.waitForSelector(trackSelector, { timeout: 8000 });
                    // Double click or click play
                    await page.click(trackSelector);
                    // Press space to trigger play if it didn't start automatically
                    await page.keyboard.press('Space');
                    console.log('[PlaywrightAutomation] Spotify track loaded.');
                }
                catch (e) {
                    console.warn('[PlaywrightAutomation] Failed to click Spotify search result:', e);
                }
            }
        }
        catch (err) {
            console.error('[PlaywrightAutomation] Playwright execution failed:', err);
            await this.nativeFallback(query, platform);
        }
    }
    /** Shell command fallback to launch Spotify URI or browser search pages */
    async nativeFallback(query, platform) {
        const encoded = encodeURIComponent(query);
        let cmd = '';
        if (platform === 'spotify') {
            cmd = `open "spotify:search:${encoded}"`;
        }
        else {
            cmd = `open "https://www.youtube.com/results?search_query=${encoded}"`;
        }
        return new Promise((resolve, reject) => {
            (0, child_process_1.exec)(cmd, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
}
exports.PlaywrightAutomation = PlaywrightAutomation;
