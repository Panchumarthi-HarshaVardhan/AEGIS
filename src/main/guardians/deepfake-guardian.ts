// ============================================================
// JARVIS V3 — Deepfake Guardian
// Dispatches media scans to identify audio/video synthetic manipulation
// ============================================================

import { BaseGuardian } from './base-guardian'
import * as path from 'path'
import { Notification } from 'electron'
import { EventBus } from '../event-bus'
import { ProviderManager } from '../provider-manager'

export class DeepfakeGuardian extends BaseGuardian {
  constructor() {
    super('DeepfakeGuardian')
  }

  protected initialize(): void {
    // 1. Registers to manual deepfake check requests or file downloads
    this.eventBus.subscribe('download:completed', async (filePath: string) => {
      if (!this.active) return
      
      const ext = path.extname(filePath).toLowerCase()
      const isMedia = ['.mp4', '.avi', '.mov', '.mp3', '.wav', '.webm', '.ogg', '.png', '.jpg', '.jpeg', '.webp'].includes(ext)
      if (!isMedia) return
      
      try {
        const result = await this.scanDeepfake(filePath, ext)
        if (result.success && result.confidence > 0.7) {
          const score = Math.round(result.confidence * 100)
          this.reportThreat(score, `DEEPFAKE DETECTED: Synthetically modified media detected at "${path.basename(filePath)}". Confidence: ${score}%`, {
            file_name: path.basename(filePath),
            file_path: filePath,
            confidence: result.confidence,
            explanation: result.explanation
          })

          if (Notification.isSupported()) {
            new Notification({
              title: '🚨 AEGIS Deepfake Media',
              body: `Deepfake media detected in download: "${path.basename(filePath)}"`
            }).show()
          }
        }
      } catch (err) {
        this.logWarn('Scan failed:', err)
      }
    })

    // 2. Registers to browser navigation to scan active page URL for deepfakes
    this.eventBus.subscribe('browser:navigation', async (url: string) => {
      if (!this.active) return
      if (!url || !url.startsWith('http')) return

      try {
        if (!this.isMediaOrNewsUrl(url)) return

        this.log(`Navigated to media/news URL: "${url}". Running synthetic media check...`)
        const analysis = await this.analyzeUrlForDeepfake(url)

        if (analysis.isDeepfake) {
          const score = analysis.score || 85
          this.reportThreat(score, `DEEPFAKE / SYNTHETIC MEDIA DETECTED: Synthetic or manipulated media identified at URL "${url}". Reason: ${analysis.explanation}`, {
            url,
            verdict: 'DANGEROUS',
            risk_score: score,
            explanation: analysis.explanation
          })

          if (Notification.isSupported()) {
            new Notification({
              title: '🚨 AEGIS Deepfake Alert',
              body: `Manipulated media/claims detected at: ${url.substring(0, 40)}...`
            }).show()
          }
        }
      } catch (err) {
        this.logWarn('Deepfake URL check failed:', err)
      }
    })
  }

  private isMediaOrNewsUrl(url: string): boolean {
    const lower = url.toLowerCase()
    const mediaDomains = [
      'youtube.com', 'youtu.be', 'vimeo.com', 'soundcloud.com',
      'tiktok.com', 'dailymotion.com', 'twitch.tv', 'spotify.com',
      'instagram.com', 'facebook.com', 'twitter.com', 'x.com'
    ]
    const mediaExts = ['.mp4', '.mov', '.avi', '.mp3', '.wav', '.webm', '.ogg', '.m4a']
    const newsKeywords = ['news', 'article', 'press', 'report', 'blog', 'post', 'journal', 'daily', 'times', 'cnn', 'bbc', 'reuters', 'apnews', 'nytimes', 'guardian', 'foxnews', 'bloomberg']

    try {
      const parsed = new URL(url)
      const hostname = parsed.hostname.replace('www.', '')

      if (mediaDomains.some(d => hostname.includes(d))) return true
      if (mediaExts.some(ext => parsed.pathname.endsWith(ext))) return true
      if (newsKeywords.some(kw => hostname.includes(kw) || parsed.pathname.includes(kw))) return true
    } catch {
      if (mediaDomains.some(d => lower.includes(d))) return true
      if (mediaExts.some(ext => lower.includes(ext))) return true
      if (newsKeywords.some(kw => lower.includes(kw))) return true
    }
    return false
  }

  private async analyzeUrlForDeepfake(url: string): Promise<{ isDeepfake: boolean; score: number; explanation: string }> {
    const systemPrompt = `You are the Deepfake Verification Engine for AEGIS Guardian AI.
Given a URL opened by the user, analyze if this URL/webpage contains or represents a known deepfake, synthetic media, manipulated audio/video, or fabricated news.
You must respond with a JSON object in this exact format:
{
  "isDeepfake": boolean,
  "score": number, // confidence score of synthetic manipulation/fabrication (0 to 100)
  "explanation": "Brief explanation of why it is flagged or safe"
}

Analyze the URL: ${url}
Be extremely vigilant. Flag known deepfake campaigns (e.g. Obama Jordan Peele, Nancy Pelosi slowed, Zelensky surrender, fake politician speech, AI song clones, etc.), synthetic speech demonstrations, and falsified media/news reports. If the URL is a standard YouTube video that is widely known to be a deepfake or synthetic, flag it as isDeepfake: true with high score. If it is a news article that is known to be fake news or fabricated, flag it. Otherwise, if it appears to be normal content, set isDeepfake: false and score: 0.`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Analyze this URL: ${url}` }
    ]

    try {
      const response = await ProviderManager.getInstance().getChatCompletion(messages, {
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
      
      const parsed = JSON.parse(response)
      return {
        isDeepfake: !!parsed.isDeepfake,
        score: typeof parsed.score === 'number' ? parsed.score : 0,
        explanation: parsed.explanation || 'No explanation provided.'
      }
    } catch (err) {
      this.logWarn('Failed to query LLM for deepfake URL check:', err)
      return { isDeepfake: false, score: 0, explanation: 'Failed to evaluate URL.' }
    }
  }

  private async scanDeepfake(filePath: string, ext: string): Promise<any> {
    const isAudio = ['.mp3', '.wav', '.m4a', '.ogg'].includes(ext)
    const isImage = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext)
    const endpoint = isAudio
      ? 'http://127.0.0.1:8000/api/deepfake/audio'
      : isImage
        ? 'http://127.0.0.1:8000/api/deepfake/image'
        : 'http://127.0.0.1:8000/api/deepfake/video'

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath })
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }
}
