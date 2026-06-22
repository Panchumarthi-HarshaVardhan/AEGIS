// ============================================================
// JARVIS V4 — Linux Automation
// Desktop automation via standard Linux utilities (xdg-open, amixer, notify-send, etc.)
// ============================================================

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { resolveAppName } from './app-aliases'
import { AutomationProvider } from './automation-provider'

const execAsync = promisify(exec)

/** Maximum command execution timeout in milliseconds */
const EXEC_TIMEOUT_MS = 15_000

export class LinuxAutomation implements AutomationProvider {
  private sanitizeShellArg(arg: string): string {
    // Remove any null bytes
    const cleaned = arg.replace(/\0/g, '')
    // Escape single quotes and wrap in single quotes
    return `'${cleaned.replace(/'/g, "'\\''")}'`
  }

  async openApp(appName: string): Promise<void> {
    const resolvedName = resolveAppName(appName)
    const sanitized = this.sanitizeShellArg(resolvedName)
    // Run app in the background so it doesn't block execution
    await execAsync(`${sanitized} &`, { timeout: EXEC_TIMEOUT_MS })
  }

  async openUrl(url: string): Promise<void> {
    const normalizedUrl = this.normalizeUrl(url)
    const sanitized = this.sanitizeShellArg(normalizedUrl)
    await execAsync(`xdg-open ${sanitized}`, { timeout: EXEC_TIMEOUT_MS })
  }

  async playOnSpotify(query: string): Promise<void> {
    const encodedQuery = encodeURIComponent(query)
    const url = `https://open.spotify.com/search/${encodedQuery}`
    const sanitized = this.sanitizeShellArg(url)
    await execAsync(`xdg-open ${sanitized}`, { timeout: EXEC_TIMEOUT_MS })
  }

  async playOnYouTube(query: string): Promise<void> {
    const encodedQuery = encodeURIComponent(query)
    const url = `https://www.youtube.com/results?search_query=${encodedQuery}`
    const sanitized = this.sanitizeShellArg(url)
    await execAsync(`xdg-open ${sanitized}`, { timeout: EXEC_TIMEOUT_MS })
  }

  async playOnAppleMusic(query: string): Promise<void> {
    const encodedQuery = encodeURIComponent(query)
    const url = `https://music.apple.com/search?term=${encodedQuery}`
    const sanitized = this.sanitizeShellArg(url)
    await execAsync(`xdg-open ${sanitized}`, { timeout: EXEC_TIMEOUT_MS })
  }

  async setVolume(level: number): Promise<void> {
    const vol = Math.max(0, Math.min(100, level))
    // Try amixer first, fallback to pactl
    try {
      await execAsync(`amixer set Master ${vol}%`, { timeout: EXEC_TIMEOUT_MS })
    } catch {
      try {
        await execAsync(`pactl set-sink-volume @DEFAULT_SINK@ ${vol}%`, { timeout: EXEC_TIMEOUT_MS })
      } catch (err) {
        console.warn('[LinuxAutomation] Failed to set volume via amixer/pactl:', err)
      }
    }
  }

  async searchFiles(query: string, directory?: string): Promise<string[]> {
    const searchDir = directory ? this.sanitizeShellArg(directory) : '$HOME'
    const sanitizedQuery = this.sanitizeShellArg(`*${query}*`)
    try {
      const { stdout } = await execAsync(
        `find ${searchDir} -iname ${sanitizedQuery} -type f -not -path '*/.*' 2>/dev/null | head -n 50`,
        { timeout: EXEC_TIMEOUT_MS }
      )
      return stdout ? stdout.trim().split('\n') : []
    } catch (e) {
      console.error('[LinuxAutomation] Search files failed:', e)
      return []
    }
  }

  async getRunningApps(): Promise<string[]> {
    try {
      // Use ps to find processes with active windows or common desktop apps
      const { stdout } = await execAsync('ps -e -o comm= | sort -u', { timeout: EXEC_TIMEOUT_MS })
      return stdout ? stdout.trim().split('\n') : []
    } catch {
      return ['VS Code', 'Chrome', 'Firefox', 'Terminal']
    }
  }

  async getInstalledApps(): Promise<string[]> {
    try {
      // Search for application desktop entries
      const { stdout } = await execAsync(
        'find /usr/share/applications/ /usr/local/share/applications/ $HOME/.local/share/applications/ -name "*.desktop" 2>/dev/null | xargs grep -h "^Name=" | cut -d= -f2 | sort -u',
        { timeout: EXEC_TIMEOUT_MS }
      )
      return stdout ? stdout.trim().split('\n') : []
    } catch {
      return ['Chrome', 'Firefox', 'VS Code', 'Spotify', 'Slack', 'Terminal']
    }
  }

  async showNotification(title: string, message: string): Promise<void> {
    const cleanTitle = this.sanitizeShellArg(title)
    const cleanMsg = this.sanitizeShellArg(message)
    await execAsync(`notify-send ${cleanTitle} ${cleanMsg}`, { timeout: EXEC_TIMEOUT_MS })
  }

  async setBrightness(level: number): Promise<void> {
    const brightness = Math.max(0, Math.min(100, level))
    try {
      await execAsync(`brightnessctl set ${brightness}%`, { timeout: EXEC_TIMEOUT_MS })
    } catch {
      try {
        await execAsync(`xbacklight -set ${brightness}`, { timeout: EXEC_TIMEOUT_MS })
      } catch (err) {
        console.warn('[LinuxAutomation] Failed to set brightness:', err)
      }
    }
  }

  async setAppearance(theme: 'dark' | 'light'): Promise<void> {
    const mode = theme === 'light' ? 'prefer-light' : 'prefer-dark'
    const schema = 'org.gnome.desktop.interface'
    await execAsync(`gsettings set ${schema} color-scheme ${mode}`, { timeout: EXEC_TIMEOUT_MS })
  }

  async systemPower(action: string): Promise<void> {
    switch (action.toLowerCase()) {
      case 'sleep':
        await execAsync('systemctl suspend', { timeout: EXEC_TIMEOUT_MS })
        break
      case 'lock':
        await execAsync('xdg-screensaver lock || gnome-screensaver-command -l', { timeout: EXEC_TIMEOUT_MS })
        break
      case 'shutdown':
        await execAsync('shutdown now', { timeout: EXEC_TIMEOUT_MS })
        break
      case 'restart':
        await execAsync('reboot', { timeout: EXEC_TIMEOUT_MS })
        break
      case 'logout':
      case 'logoff':
        await execAsync('gnome-session-quit --logout --no-prompt || openbox --exit || pkill -u $USER', { timeout: EXEC_TIMEOUT_MS })
        break
      default:
        throw new Error(`Unsupported power action: ${action}`)
    }
  }

  async captureScreen(outputPath: string): Promise<void> {
    const sanitized = this.sanitizeShellArg(outputPath)
    try {
      await execAsync(`gnome-screenshot -f ${sanitized}`, { timeout: EXEC_TIMEOUT_MS })
    } catch {
      try {
        await execAsync(`scrot ${sanitized}`, { timeout: EXEC_TIMEOUT_MS })
      } catch (err) {
        try {
          await execAsync(`import -window root ${sanitized}`, { timeout: EXEC_TIMEOUT_MS })
        } catch (e) {
          throw new Error('No screen capture utility found (gnome-screenshot, scrot, import).')
        }
      }
    }
  }

  private normalizeUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) return url
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) return url
    return `https://${url}`
  }

  async automateApp(appName: string, taskDescription: string): Promise<void> {
    console.log(`[LinuxAutomation] automateApp stub triggered for ${appName}: ${taskDescription}`)
    throw new Error('OS application GUI automation is not fully supported on Linux. Please use macOS.')
  }
}
