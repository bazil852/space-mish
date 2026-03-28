import { execSync } from 'child_process';

/**
 * Read the current Windows clipboard contents using PowerShell Get-Clipboard.
 */
export function readClipboard(): string {
  try {
    const result = execSync('powershell -command "Get-Clipboard"', {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return result.trimEnd();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read clipboard: ${message}`);
  }
}

/**
 * Write text to the Windows clipboard using PowerShell Set-Clipboard.
 * The text is properly escaped for PowerShell single-quoted strings.
 */
export function writeClipboard(text: string): void {
  try {
    // Escape single quotes for PowerShell by doubling them
    const escaped = text.replace(/'/g, "''");
    execSync(`powershell -command "Set-Clipboard -Value '${escaped}'"`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to write clipboard: ${message}`);
  }
}
