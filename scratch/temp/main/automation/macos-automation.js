"use strict";
// ============================================================
// JARVIS Guardian AI — macOS Automation
// Desktop automation via AppleScript and shell commands
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.MacOSAutomation = void 0;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const app_aliases_1 = require("./app-aliases");
const execAsync = (0, node_util_1.promisify)(node_child_process_1.exec);
/** Maximum command execution timeout in milliseconds */
const EXEC_TIMEOUT_MS = 15_000;
/** Maximum number of search results from mdfind */
const MAX_SEARCH_RESULTS = 50;
/**
 * macOS desktop automation engine.
 *
 * Provides methods for opening applications, URLs, playing music,
 * controlling system settings, and searching files — all through
 * native macOS shell commands and AppleScript.
 *
 * **Security**: All user-provided inputs are sanitized to prevent
 * shell injection attacks before being passed to `exec`.
 *
 * @example
 * ```ts
 * const automation = new MacOSAutomation()
 * await automation.openApp('Chrome')
 * await automation.setVolume(50)
 * await automation.playOnSpotify('Bohemian Rhapsody')
 * ```
 */
class MacOSAutomation {
    /**
     * Opens a macOS application by name.
     *
     * Resolves common aliases (e.g., "chrome" → "Google Chrome")
     * before launching with `open -a`.
     *
     * @param appName - The application name or common alias
     * @throws {Error} If the application cannot be found or opened
     */
    async openApp(appName) {
        const resolvedName = (0, app_aliases_1.resolveAppName)(appName);
        const sanitized = this.sanitizeShellArg(resolvedName);
        await execAsync(`open -a ${sanitized}`, { timeout: EXEC_TIMEOUT_MS });
    }
    /**
     * Opens a URL in the default browser.
     *
     * Ensures the URL has a protocol prefix and sanitizes it
     * to prevent shell injection.
     *
     * @param url - The URL to open
     * @throws {Error} If the URL cannot be opened
     */
    async openUrl(url) {
        const normalizedUrl = this.normalizeUrl(url);
        const sanitized = this.sanitizeShellArg(normalizedUrl);
        await execAsync(`open ${sanitized}`, { timeout: EXEC_TIMEOUT_MS });
    }
    /**
     * Plays a song or search query on Spotify.
     *
     * Opens Spotify with a search URI, which triggers the Spotify
     * app to show search results for the given query.
     *
     * @param query - Song name, artist, or search query
     * @throws {Error} If Spotify cannot be opened
     */
    async playOnSpotify(query) {
        const encodedQuery = encodeURIComponent(query);
        const sanitized = this.sanitizeShellArg(`spotify:search:${encodedQuery}`);
        await execAsync(`open ${sanitized}`, { timeout: EXEC_TIMEOUT_MS });
    }
    /**
     * Plays a search query on YouTube via Google Chrome.
     *
     * Opens Chrome with a YouTube search results URL.
     *
     * @param query - Song name, video title, or search query
     * @throws {Error} If Chrome cannot be opened
     */
    async playOnYouTube(query) {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://www.youtube.com/results?search_query=${encodedQuery}`;
        const sanitized = this.sanitizeShellArg(url);
        await execAsync(`open -a "Google Chrome" ${sanitized}`, { timeout: EXEC_TIMEOUT_MS });
    }
    /**
     * Plays music on Apple Music via AppleScript.
     *
     * Tells the Music app to search for and play the given query.
     *
     * @param query - Song name, artist, or search query
     * @throws {Error} If Apple Music cannot be controlled
     */
    async playOnAppleMusic(query) {
        const sanitizedQuery = this.sanitizeAppleScriptString(query);
        const script = `
      tell application "Music"
        activate
        delay 1
        play (every track whose name contains "${sanitizedQuery}")
      end tell
    `;
        await this.runAppleScript(script);
    }
    /**
     * Sets the system volume level.
     *
     * @param level - Volume level from 0 (mute) to 100 (maximum)
     * @throws {Error} If the volume cannot be set
     * @throws {RangeError} If level is outside 0-100
     */
    async setVolume(level) {
        if (level < 0 || level > 100 || !Number.isFinite(level)) {
            throw new RangeError(`Volume level must be 0-100, got ${level}`);
        }
        // macOS `set volume` uses a 0-7 scale for output volume
        // but `set volume output volume` uses 0-100
        const script = `set volume output volume ${Math.round(level)}`;
        await this.runAppleScript(script);
    }
    /**
     * Searches for files using macOS Spotlight (mdfind).
     *
     * @param query - The search query (file name, content, or metadata)
     * @param directory - Optional directory to scope the search to
     * @returns Array of matching file paths
     * @throws {Error} If the search command fails
     */
    async searchFiles(query, directory) {
        const sanitizedQuery = this.sanitizeShellArg(query);
        let command = `mdfind ${sanitizedQuery}`;
        if (directory) {
            const sanitizedDir = this.sanitizeShellArg(directory);
            command = `mdfind -onlyin ${sanitizedDir} ${sanitizedQuery}`;
        }
        try {
            const { stdout } = await execAsync(command, { timeout: EXEC_TIMEOUT_MS });
            return stdout
                .trim()
                .split('\n')
                .filter((line) => line.length > 0)
                .slice(0, MAX_SEARCH_RESULTS);
        }
        catch {
            return [];
        }
    }
    /**
     * Gets the list of currently running application processes.
     *
     * @returns Array of running application names
     */
    async getRunningApps() {
        const script = `
      tell application "System Events"
        set appNames to name of every application process whose background only is false
      end tell
      return appNames
    `;
        try {
            const result = await this.runAppleScript(script);
            return result
                .split(', ')
                .map((name) => name.trim())
                .filter((name) => name.length > 0);
        }
        catch {
            return [];
        }
    }
    /**
     * Gets the list of installed applications.
     *
     * @returns Array of installed application names
     */
    async getInstalledApps() {
        try {
            const { stdout } = await execAsync('ls /Applications', {
                timeout: EXEC_TIMEOUT_MS
            });
            return stdout
                .trim()
                .split('\n')
                .filter((name) => name.endsWith('.app'))
                .map((name) => name.replace(/\.app$/, ''));
        }
        catch {
            return [];
        }
    }
    /**
     * Shows a macOS notification.
     *
     * @param title - The notification title
     * @param message - The notification body text
     */
    async showNotification(title, message) {
        const sanitizedTitle = this.sanitizeAppleScriptString(title);
        const sanitizedMessage = this.sanitizeAppleScriptString(message);
        const script = `display notification "${sanitizedMessage}" with title "${sanitizedTitle}"`;
        await this.runAppleScript(script);
    }
    /**
     * Sets the display brightness level.
     * @param level - Brightness level from 0 to 100
     */
    async setBrightness(level) {
        // Key codes 144 (brightness up) and 145 (brightness down)
        const normalized = Math.max(0, Math.min(100, level));
        const script = `
      try
        tell application "System Events"
          repeat ${Math.round(normalized / 10)} times
            key code 144
          end repeat
        end tell
      end try
    `;
        await this.runAppleScript(script).catch(() => { });
    }
    /**
     * Toggles system dark or light appearance.
     * @param theme - Theme choice ('dark' | 'light')
     */
    async setAppearance(theme) {
        const isDark = theme === 'dark';
        const script = `
      tell application "System Events"
        tell appearance preferences
          set dark mode to ${isDark}
        end tell
      end tell
    `;
        await this.runAppleScript(script);
    }
    /**
     * Performs macOS power state operations.
     * @param action - The action type ('shutdown' | 'restart' | 'sleep' | 'lock' | 'logout')
     */
    async systemPower(action) {
        let script = '';
        switch (action.toLowerCase()) {
            case 'lock':
                script = 'tell application "System Events" to keystroke "q" using {control down, command down}';
                break;
            case 'sleep':
                script = 'tell application "System Events" to sleep';
                break;
            case 'restart':
                script = 'tell application "System Events" to restart';
                break;
            case 'shutdown':
                script = 'tell application "System Events" to shut down';
                break;
            case 'logout':
                script = 'tell application "System Events" to log out';
                break;
            default:
                throw new Error(`Unsupported power action: ${action}`);
        }
        await this.runAppleScript(script);
    }
    // ─── Private Methods ──────────────────────────────────────
    /**
     * Executes an AppleScript and returns the output.
     *
     * @param script - The AppleScript source code to execute
     * @returns The stdout output of the script
     * @throws {Error} If the script execution fails
     */
    async runAppleScript(script) {
        // Use -e flag for inline execution; each line is a separate -e argument
        // to avoid shell interpretation issues with multi-line strings
        const escapedScript = script.replace(/'/g, "'\\''");
        const { stdout } = await execAsync(`osascript -e '${escapedScript}'`, { timeout: EXEC_TIMEOUT_MS });
        return stdout.trim();
    }
    /**
     * Sanitizes a string for safe use as a shell argument.
     *
     * Wraps the value in single quotes and escapes any embedded
     * single quotes to prevent shell injection attacks.
     *
     * @param arg - The raw argument string
     * @returns A safely quoted shell argument
     */
    sanitizeShellArg(arg) {
        // Remove any null bytes
        const cleaned = arg.replace(/\0/g, '');
        // Escape single quotes and wrap in single quotes
        // This is the safest way to pass arbitrary strings to shell
        return `'${cleaned.replace(/'/g, "'\\''")}'`;
    }
    /**
     * Sanitizes a string for safe use inside AppleScript double-quoted strings.
     *
     * Escapes backslashes and double quotes to prevent AppleScript injection.
     *
     * @param str - The raw string
     * @returns A safely escaped string for AppleScript
     */
    sanitizeAppleScriptString(str) {
        return str
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\0/g, '');
    }
    /**
     * Captures a screenshot of the main screen and saves it to the path.
     * @param outputPath - Local path where the image will be saved
     */
    async captureScreen(outputPath) {
        const sanitized = this.sanitizeShellArg(outputPath);
        await execAsync(`screencapture -x ${sanitized}`, { timeout: EXEC_TIMEOUT_MS });
    }
    /**
     * Normalizes a URL by ensuring it has a protocol prefix.
     *
     * @param url - The raw URL
     * @returns URL with http(s) protocol
     */
    normalizeUrl(url) {
        if (/^https?:\/\//i.test(url))
            return url;
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url))
            return url;
        return `https://${url}`;
    }
}
exports.MacOSAutomation = MacOSAutomation;
