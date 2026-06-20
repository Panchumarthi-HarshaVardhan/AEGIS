// ============================================================
// JARVIS V4 — Windows Automation
// Desktop automation via PowerShell and cmd commands
// ============================================================

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { resolveAppName } from './app-aliases'
import { AutomationProvider } from './automation-provider'

const execAsync = promisify(exec)

/** Maximum command execution timeout in milliseconds */
const EXEC_TIMEOUT_MS = 15_000

export class WindowsAutomation implements AutomationProvider {
  /**
   * Run a PowerShell script synchronously or asynchronously.
   */
  private async runPowerShell(script: string): Promise<string> {
    // Escape single quotes for PowerShell block
    const escaped = script.replace(/"/g, '`"')
    const cmd = `powershell -NoProfile -NonInteractive -Command "${escaped}"`
    const { stdout } = await execAsync(cmd, { timeout: EXEC_TIMEOUT_MS })
    return stdout.trim()
  }

  private sanitizePowerShellString(str: string): string {
    return str.replace(/`/g, '``').replace(/\$/g, '`$').replace(/"/g, '`"').replace(/'/g, '`\'')
  }

  async openApp(appName: string): Promise<void> {
    const resolvedName = resolveAppName(appName)
    // Run via start command in cmd
    await execAsync(`start "" "${resolvedName}"`, { shell: 'cmd.exe', timeout: EXEC_TIMEOUT_MS })
  }

  async openUrl(url: string): Promise<void> {
    const normalizedUrl = this.normalizeUrl(url)
    await execAsync(`start "" "${normalizedUrl}"`, { shell: 'cmd.exe', timeout: EXEC_TIMEOUT_MS })
  }

  async playOnSpotify(query: string): Promise<void> {
    const encodedQuery = encodeURIComponent(query)
    await execAsync(`start spotify:search:"${encodedQuery}"`, { shell: 'cmd.exe', timeout: EXEC_TIMEOUT_MS })
  }

  async playOnYouTube(query: string): Promise<void> {
    const encodedQuery = encodeURIComponent(query)
    const url = `https://www.youtube.com/results?search_query=${encodedQuery}`
    await execAsync(`start "" "${url}"`, { shell: 'cmd.exe', timeout: EXEC_TIMEOUT_MS })
  }

  async playOnAppleMusic(query: string): Promise<void> {
    const encodedQuery = encodeURIComponent(query)
    // Apple Music has a web player or we can launch custom protocol
    const url = `https://music.apple.com/search?term=${encodedQuery}`
    await execAsync(`start "" "${url}"`, { shell: 'cmd.exe', timeout: EXEC_TIMEOUT_MS })
  }

  async setVolume(level: number): Promise<void> {
    // Sets system volume using NirCmd if available, otherwise fallback to PowerShell Core Audio APIs via .NET code
    // Let's use a PowerShell script that sends volume keys or does CoreAudio API
    const volume = Math.max(0, Math.min(100, level))
    // Fallback: simple PowerShell to set volume using SndVol or sending Volume keys
    const script = `
      $wshShell = New-Object -ComObject WScript.Shell
      # Send Volume Mute key to unmute first
      $wshShell.SendKeys([char]173)
      # Then send Volume Up or Down to approximate the target volume level
      # (This is a generic fallback, in production a native volume binding is preferred)
      for ($i = 0; $i -lt 50; $i++) {
        $wshShell.SendKeys([char]174) # Volume Down to 0
      }
      $clicks = [Math]::Round(${volume} / 2)
      for ($i = 0; $i -lt $clicks; $i++) {
        $wshShell.SendKeys([char]175) # Volume Up
      }
    `
    await this.runPowerShell(script)
  }

  async searchFiles(query: string, directory?: string): Promise<string[]> {
    const searchDir = directory || '$env:USERPROFILE\\Documents'
    const sanitizedQuery = this.sanitizePowerShellString(query)
    const script = `
      Get-ChildItem -Path "${searchDir}" -Filter "*${sanitizedQuery}*" -Recurse -File -ErrorAction SilentlyContinue |
      Select-Object -First 50 -ExpandProperty FullName
    `
    const output = await this.runPowerShell(script)
    return output ? output.split(/\r?\n/) : []
  }

  async getRunningApps(): Promise<string[]> {
    const script = `
      Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object -ExpandProperty ProcessName -Unique
    `
    const output = await this.runPowerShell(script)
    return output ? output.split(/\r?\n/) : []
  }

  async getInstalledApps(): Promise<string[]> {
    const script = `
      $paths = @(
        "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
        "HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
        "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
      )
      Get-ItemProperty -Path $paths -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName } |
      Select-Object -ExpandProperty DisplayName -Unique |
      Sort-Object
    `
    const output = await this.runPowerShell(script)
    return output ? output.split(/\r?\n/) : []
  }

  async showNotification(title: string, message: string): Promise<void> {
    const cleanTitle = this.sanitizePowerShellString(title)
    const cleanMsg = this.sanitizePowerShellString(message)
    const script = `
      [void] [System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")
      $objNotification = New-Object System.Windows.Forms.NotifyIcon
      $objNotification.Icon = [System.Drawing.SystemIcons]::Information
      $objNotification.BalloonTipIcon = "Info"
      $objNotification.BalloonTipTitle = "${cleanTitle}"
      $objNotification.BalloonTipText = "${cleanMsg}"
      $objNotification.Visible = $True
      $objNotification.ShowBalloonTip(5000)
    `
    await this.runPowerShell(script)
  }

  async setBrightness(level: number): Promise<void> {
    const brightness = Math.max(0, Math.min(100, level))
    const script = `
      (Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, ${brightness})
    `
    await this.runPowerShell(script)
  }

  async setAppearance(theme: 'dark' | 'light'): Promise<void> {
    const value = theme === 'light' ? 1 : 0
    const script = `
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" -Name "AppsUseLightTheme" -Value ${value} -ErrorAction SilentlyContinue
      Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" -Name "SystemUsesLightTheme" -Value ${value} -ErrorAction SilentlyContinue
    `
    await this.runPowerShell(script)
  }

  async systemPower(action: string): Promise<void> {
    switch (action.toLowerCase()) {
      case 'sleep':
        await this.runPowerShell('Add-Type -Assembly System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState("Suspend", $false, $false)')
        break
      case 'lock':
        await execAsync('rundll32.exe user32.dll,LockWorkStation', { timeout: EXEC_TIMEOUT_MS })
        break
      case 'shutdown':
        await execAsync('shutdown /s /t 0', { timeout: EXEC_TIMEOUT_MS })
        break
      case 'restart':
        await execAsync('shutdown /r /t 0', { timeout: EXEC_TIMEOUT_MS })
        break
      case 'logout':
      case 'logoff':
        await execAsync('shutdown /l', { timeout: EXEC_TIMEOUT_MS })
        break
      default:
        throw new Error(`Unsupported power action: ${action}`)
    }
  }

  async captureScreen(outputPath: string): Promise<void> {
    const cleanPath = this.sanitizePowerShellString(outputPath)
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $screen = [System.Windows.Forms.Screen]::PrimaryScreen
      $bounds = $screen.Bounds
      $bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
      $bitmap.Save("${cleanPath}", [System.Drawing.Imaging.ImageFormat]::Png)
      $graphics.Dispose()
      $bitmap.Dispose()
    `
    await this.runPowerShell(script)
  }

  private normalizeUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) return url
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) return url
    return `https://${url}`
  }
}
