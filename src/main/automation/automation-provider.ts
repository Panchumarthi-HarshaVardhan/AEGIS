// ============================================================
// AEGIS Security Companion — Automation Provider Interface
// Interface for platform-specific system automation
// ============================================================

export interface AutomationProvider {
  /** Opens an application by name or system alias */
  openApp(appName: string): Promise<void>

  /** Opens a URL or system filepath in the default application */
  openUrl(url: string): Promise<void>

  /** Plays music on Spotify app or local URI search */
  playOnSpotify(query: string): Promise<void>

  /** Plays query on YouTube search */
  playOnYouTube(query: string): Promise<void>

  /** Plays music on Apple Music (or native media player) */
  playOnAppleMusic(query: string): Promise<void>

  /** Sets system volume level (0-100) */
  setVolume(level: number): Promise<void>

  /** Searches files via system search indexer */
  searchFiles(query: string, directory?: string): Promise<string[]>

  /** Gets active visible processes */
  getRunningApps(): Promise<string[]>

  /** Gets all installed user applications */
  getInstalledApps(): Promise<string[]>

  /** Triggers a system toast notification */
  showNotification(title: string, message: string): Promise<void>

  /** Sets display brightness level (0-100) */
  setBrightness(level: number): Promise<void>

  /** Sets dark/light operating system mode */
  setAppearance(theme: 'dark' | 'light'): Promise<void>

  /** Triggers machine power changes (sleep, lock, shutdown, logout, restart) */
  systemPower(action: string): Promise<void>

  /** Captures active desktop screen and writes PNG to path */
  captureScreen(outputPath: string): Promise<void>
}
