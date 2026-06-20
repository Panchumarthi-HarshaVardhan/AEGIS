// ============================================================
// JARVIS V3 — Playwright Automation Engine
// Automates music streaming on Spotify Web Player and YouTube
// by controlling local Google Chrome via Playwright
// ============================================================

import { exec } from 'child_process'
import * as fs from 'fs'

/**
 * Automates playback on YouTube and Spotify Web Player using Playwright-Core.
 * Attempts to launch the native Chrome application on macOS.
 */
export class PlaywrightAutomation {
  private chromePath: string = ''

  constructor() {
    const platform = process.platform
    if (platform === 'darwin') {
      this.chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    } else if (platform === 'win32') {
      const fs = require('fs')
      const paths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
      ]
      this.chromePath = paths.find((p) => fs.existsSync(p)) || paths[0]
    } else {
      // linux fallback
      const fs = require('fs')
      const paths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
      ]
      this.chromePath = paths.find((p) => fs.existsSync(p)) || paths[0]
    }
  }

  /**
   * Automate music search and playback on YouTube or Spotify.
   */
  async playMusic(query: string, platform: 'spotify' | 'youtube'): Promise<void> {
    console.log(`[PlaywrightAutomation] Automating "${query}" on ${platform}...`)
    
    // Check if Playwright-Core is available
    let playwright: any
    try {
      playwright = require('playwright-core')
    } catch {
      console.warn('[PlaywrightAutomation] playwright-core is not installed. Falling back to native open.')
      await this.nativeFallback(query, platform)
      return
    }

    // Check if Chrome exists
    const hasChrome = fs.existsSync(this.chromePath)
    if (!hasChrome) {
      console.warn('[PlaywrightAutomation] Google Chrome not found at standard path. Falling back to default browser.')
      await this.nativeFallback(query, platform)
      return
    }

    try {
      const browser = await playwright.chromium.launch({
        headless: false,
        executablePath: this.chromePath,
        args: ['--start-maximized']
      })

      const context = await browser.newContext({
        viewport: null
      })
      const page = await context.newPage()

      if (platform === 'youtube') {
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        
        // Wait for first video and click it
        try {
          const videoSelector = 'ytd-video-renderer a#video-title'
          await page.waitForSelector(videoSelector, { timeout: 8000 })
          await page.click(videoSelector)
          console.log('[PlaywrightAutomation] YouTube video clicked and playing.')
        } catch (e) {
          console.warn('[PlaywrightAutomation] Failed to click video on YouTube, playing fallback.', e)
          // Go to first video query link directly
          await page.evaluate(() => {
            const link = document.querySelector('ytd-video-renderer a#video-title') as HTMLAnchorElement
            if (link) link.click()
          })
        }
      } else {
        // Spotify Web Player search
        const url = `https://open.spotify.com/search/${encodeURIComponent(query)}`
        await page.goto(url, { waitUntil: 'domcontentloaded' })

        try {
          const trackSelector = 'section[data-testid="search-track-results-section"] [data-testid="tracklist-row"]'
          await page.waitForSelector(trackSelector, { timeout: 8000 })
          // Double click or click play
          await page.click(trackSelector)
          // Press space to trigger play if it didn't start automatically
          await page.keyboard.press('Space')
          console.log('[PlaywrightAutomation] Spotify track loaded.')
        } catch (e) {
          console.warn('[PlaywrightAutomation] Failed to click Spotify search result:', e)
        }
      }
    } catch (err) {
      console.error('[PlaywrightAutomation] Playwright execution failed:', err)
      await this.nativeFallback(query, platform)
    }
  }

  /** Shell command fallback to launch Spotify URI or browser search pages */
  private async nativeFallback(query: string, platform: 'spotify' | 'youtube'): Promise<void> {
    const encoded = encodeURIComponent(query)
    let cmd = ''
    
    const isWin = process.platform === 'win32'
    const isLinux = process.platform === 'linux'
    const openCmd = isWin ? 'start' : (isLinux ? 'xdg-open' : 'open')

    if (platform === 'spotify') {
      const uri = `spotify:search:${encoded}`
      cmd = isWin ? `start "" "${uri}"` : `${openCmd} "${uri}"`
    } else {
      const url = `https://www.youtube.com/results?search_query=${encoded}`
      cmd = isWin ? `start "" "${url}"` : `${openCmd} "${url}"`
    }
    
    return new Promise((resolve, reject) => {
      exec(cmd, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
}
