// ============================================================
// JARVIS Guardian AI — App Aliases
// Maps common application names to macOS system names
// ============================================================

/**
 * Comprehensive mapping of common application names to their
 * official macOS system application names.
 *
 * Keys are lowercase common names; values are the exact names
 * macOS uses (e.g., for `open -a "Name"`).
 */
export const APP_ALIASES: Record<string, string> = {
  // --- Browsers ---
  chrome: 'Google Chrome',
  'google chrome': 'Google Chrome',
  firefox: 'Firefox',
  safari: 'Safari',
  brave: 'Brave Browser',
  arc: 'Arc',
  edge: 'Microsoft Edge',
  opera: 'Opera',
  vivaldi: 'Vivaldi',
  tor: 'Tor Browser',

  // --- Development ---
  vscode: 'Visual Studio Code',
  code: 'Visual Studio Code',
  'visual studio code': 'Visual Studio Code',
  cursor: 'Cursor',
  xcode: 'Xcode',
  'android studio': 'Android Studio',
  sublime: 'Sublime Text',
  'sublime text': 'Sublime Text',
  atom: 'Atom',
  webstorm: 'WebStorm',
  intellij: 'IntelliJ IDEA',
  pycharm: 'PyCharm',

  // --- Terminal & Shell ---
  terminal: 'Terminal',
  iterm: 'iTerm',
  iterm2: 'iTerm',
  warp: 'Warp',
  hyper: 'Hyper',
  alacritty: 'Alacritty',
  kitty: 'kitty',

  // --- Apple Built-in ---
  finder: 'Finder',
  notes: 'Notes',
  calculator: 'Calculator',
  calendar: 'Calendar',
  reminders: 'Reminders',
  mail: 'Mail',
  messages: 'Messages',
  imessage: 'Messages',
  music: 'Music',
  'apple music': 'Music',
  itunes: 'Music',
  photos: 'Photos',
  preview: 'Preview',
  'app store': 'App Store',
  appstore: 'App Store',
  settings: 'System Preferences',
  preferences: 'System Preferences',
  'system preferences': 'System Preferences',
  'system settings': 'System Settings',
  maps: 'Maps',
  books: 'Books',
  news: 'News',
  stocks: 'Stocks',
  weather: 'Weather',
  clock: 'Clock',
  'voice memos': 'Voice Memos',
  'facetime': 'FaceTime',
  contacts: 'Contacts',
  keychain: 'Keychain Access',
  'disk utility': 'Disk Utility',
  'activity monitor': 'Activity Monitor',
  automator: 'Automator',
  'font book': 'Font Book',
  textedit: 'TextEdit',

  // --- Communication ---
  slack: 'Slack',
  discord: 'Discord',
  teams: 'Microsoft Teams',
  'microsoft teams': 'Microsoft Teams',
  zoom: 'zoom.us',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  signal: 'Signal',
  skype: 'Skype',
  webex: 'Webex',

  // --- Productivity ---
  notion: 'Notion',
  obsidian: 'Obsidian',
  evernote: 'Evernote',
  todoist: 'Todoist',
  trello: 'Trello',
  asana: 'Asana',
  linear: 'Linear',
  '1password': '1Password',
  onepassword: '1Password',
  lastpass: 'LastPass',
  bitwarden: 'Bitwarden',

  // --- Microsoft Office ---
  word: 'Microsoft Word',
  'microsoft word': 'Microsoft Word',
  excel: 'Microsoft Excel',
  'microsoft excel': 'Microsoft Excel',
  powerpoint: 'Microsoft PowerPoint',
  'microsoft powerpoint': 'Microsoft PowerPoint',
  outlook: 'Microsoft Outlook',
  'microsoft outlook': 'Microsoft Outlook',
  onenote: 'Microsoft OneNote',

  // --- Design ---
  figma: 'Figma',
  sketch: 'Sketch',
  photoshop: 'Adobe Photoshop',
  illustrator: 'Adobe Illustrator',
  'after effects': 'Adobe After Effects',
  'premiere pro': 'Adobe Premiere Pro',
  canva: 'Canva',
  blender: 'Blender',

  // --- Development Tools ---
  postman: 'Postman',
  docker: 'Docker',
  'docker desktop': 'Docker Desktop',
  insomnia: 'Insomnia',
  tableplus: 'TablePlus',
  sourcetree: 'Sourcetree',
  'github desktop': 'GitHub Desktop',

  // --- Media ---
  spotify: 'Spotify',
  vlc: 'VLC',
  'quicktime': 'QuickTime Player',
  handbrake: 'HandBrake',
  obs: 'OBS',

  // --- Utilities ---
  'clean my mac': 'CleanMyMac X',
  bartender: 'Bartender',
  alfred: 'Alfred',
  raycast: 'Raycast',
  magnet: 'Magnet',
  rectangle: 'Rectangle',
  'the unarchiver': 'The Unarchiver',
  keka: 'Keka',
  appcleaner: 'AppCleaner',
  istat: 'iStat Menus',

  // --- Other ---
  'google earth': 'Google Earth Pro',
  steam: 'Steam',
  'epic games': 'Epic Games Launcher'
}

/**
 * Resolves a user-provided application name to its macOS system name.
 *
 * Performs a case-insensitive lookup against the alias map.
 * Returns the original input if no alias is found.
 *
 * @param input - The user-provided app name (e.g., "chrome", "vscode")
 * @returns The macOS system application name (e.g., "Google Chrome", "Visual Studio Code")
 *
 * @example
 * ```ts
 * resolveAppName('chrome')   // 'Google Chrome'
 * resolveAppName('VSCode')   // 'Visual Studio Code'
 * resolveAppName('MyApp')    // 'MyApp' (passthrough — no alias found)
 * ```
 */
export function resolveAppName(input: string): string {
  if (!input || input.trim().length === 0) return input

  const normalized = input.trim().toLowerCase()
  return APP_ALIASES[normalized] ?? input.trim()
}
