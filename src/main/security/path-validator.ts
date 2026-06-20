// ============================================================
// AEGIS Security Companion — Path Validator Utility
// Sanitizes and restricts filesystem access on sensitive paths
// ============================================================

import * as path from 'path'

/**
 * Helper to validate if a file path is safe for application operations.
 * Resolves paths and denies hidden files, directory traversal, and sensitive system folders.
 *
 * @param filePath - The raw file path to validate
 * @returns True if path is safe to access, false otherwise
 */
export function isValidFilePath(filePath: string): boolean {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    return false
  }

  try {
    const absolutePath = path.resolve(path.normalize(filePath))

    // 1. Prevent traversal tricks
    if (filePath.includes('..') || absolutePath.includes('..')) {
      return false
    }

    // Split path into individual components
    const parts = absolutePath.split(path.sep)

    // 2. Prevent hidden files / dotfiles (e.g., .ssh, .env, .git)
    const hasHidden = parts.some(
      (part) => part.startsWith('.') && part !== '.' && part !== '..'
    )
    if (hasHidden) {
      return false
    }

    // 3. Block sensitive operating system / system configuration folders on macOS/Unix
    const blockedDirs = new Set([
      'etc',
      'var',
      'System',
      'Library',
      'private',
      'bin',
      'sbin',
      'usr',
      'opt'
    ])
    // Check if the absolute path starts with any of the blocked folders
    if (parts.length > 1 && blockedDirs.has(parts[1])) {
      return false
    }

    return true
  } catch (error) {
    return false
  }
}
