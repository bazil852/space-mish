import { execSync } from 'child_process';

/**
 * Read the current macOS clipboard contents using pbpaste.
 */
export function readClipboard(): string {
  try {
    const result = execSync('pbpaste', { encoding: 'utf-8', timeout: 5000 });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read clipboard: ${message}`);
  }
}

/**
 * Write text to the macOS clipboard using pbcopy.
 */
export function writeClipboard(text: string): void {
  try {
    execSync('pbcopy', {
      input: text,
      encoding: 'utf-8',
      timeout: 5000,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to write clipboard: ${message}`);
  }
}
