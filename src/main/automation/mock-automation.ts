// ============================================================
// AEGIS Security Companion — Mock Automation Provider
// Stubbed automation calls for non-macOS systems
// ============================================================

import { AutomationProvider } from './automation-provider'

export class MockAutomationProvider implements AutomationProvider {
  private log(action: string, params?: any): void {
    console.log(`[MockAutomation] Action "${action}" triggered. Params:`, params || 'none')
  }

  async openApp(appName: string): Promise<void> {
    this.log('openApp', { appName })
  }

  async openUrl(url: string): Promise<void> {
    this.log('openUrl', { url })
  }

  async playOnSpotify(query: string): Promise<void> {
    this.log('playOnSpotify', { query })
  }

  async playOnYouTube(query: string): Promise<void> {
    this.log('playOnYouTube', { query })
  }

  async playOnAppleMusic(query: string): Promise<void> {
    this.log('playOnAppleMusic', { query })
  }

  async setVolume(level: number): Promise<void> {
    this.log('setVolume', { level })
  }

  async searchFiles(query: string, directory?: string): Promise<string[]> {
    this.log('searchFiles', { query, directory })
    return [
      `/Users/mock/Documents/project-${query}.txt`,
      `/Users/mock/Downloads/guide.pdf`
    ]
  }

  async getRunningApps(): Promise<string[]> {
    this.log('getRunningApps')
    return ['VS Code', 'Chrome', 'Spotify', 'Terminal']
  }

  async getInstalledApps(): Promise<string[]> {
    this.log('getInstalledApps')
    return ['Chrome', 'VS Code', 'Spotify', 'Slack', 'Terminal', 'Notes']
  }

  async showNotification(title: string, message: string): Promise<void> {
    this.log('showNotification', { title, message })
  }

  async setBrightness(level: number): Promise<void> {
    this.log('setBrightness', { level })
  }

  async setAppearance(theme: 'dark' | 'light'): Promise<void> {
    this.log('setAppearance', { theme })
  }

  async systemPower(action: string): Promise<void> {
    this.log('systemPower', { action })
  }

  async captureScreen(outputPath: string): Promise<void> {
    this.log('captureScreen', { outputPath })
  }

  async automateApp(appName: string, taskDescription: string): Promise<void> {
    this.log('automateApp', { appName, taskDescription })
  }
}
