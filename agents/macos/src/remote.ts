import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCREENSHOT_PATH = path.join(os.tmpdir(), 'spacemish-screen.jpg');

export function captureScreenshot(quality: number = 50): Buffer | null {
  try {
    // screencapture: -x no sound, -t jpg format, -l0 captures main display
    execSync(`screencapture -x -t jpg "${SCREENSHOT_PATH}"`, {
      timeout: 5000,
      stdio: 'ignore',
    });

    // Compress with sips if quality < 100
    if (quality < 80) {
      const scaleFactor = quality < 40 ? 50 : 75;
      const tmpPath = SCREENSHOT_PATH + '.tmp.jpg';
      execSync(
        `sips --resampleHeightWidthMax 1080 -s format jpeg -s formatOptions ${scaleFactor} "${SCREENSHOT_PATH}" --out "${tmpPath}" 2>/dev/null && mv "${tmpPath}" "${SCREENSHOT_PATH}"`,
        { timeout: 5000, stdio: 'ignore' }
      );
    }

    return fs.readFileSync(SCREENSHOT_PATH);
  } catch (err) {
    console.error('[remote] Screenshot capture failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export function getScreenSize(): { width: number; height: number } {
  try {
    const result = execSync(
      "system_profiler SPDisplaysDataType | grep Resolution | head -1 | awk '{print $2, $4}'",
      { encoding: 'utf-8', timeout: 5000 }
    );
    const parts = result.trim().split(' ');
    return { width: parseInt(parts[0]) || 1920, height: parseInt(parts[1]) || 1080 };
  } catch {
    return { width: 1920, height: 1080 };
  }
}

export interface InputEvent {
  action: 'move' | 'click' | 'dblclick' | 'scroll' | 'type';
  x?: number;
  y?: number;
  button?: 'left' | 'right';
  key?: string;
  delta?: number;
}

export function injectInput(event: InputEvent): void {
  try {
    const x = Math.round(event.x || 0);
    const y = Math.round(event.y || 0);

    switch (event.action) {
      case 'move':
        // Use AppleScript to move mouse - requires cliclick or AppleScript
        execSync(
          `osascript -e 'tell application "System Events" to set position of mouse to {${x}, ${y}}'`,
          { timeout: 2000, stdio: 'ignore' }
        );
        break;

      case 'click':
        execSync(
          `osascript -e '
            tell application "System Events"
              click at {${x}, ${y}}
            end tell'`,
          { timeout: 2000, stdio: 'ignore' }
        );
        break;

      case 'type':
        if (event.key) {
          // Escape single quotes for AppleScript
          const escaped = event.key.replace(/'/g, "'\"'\"'");
          execSync(
            `osascript -e 'tell application "System Events" to keystroke "${escaped}"'`,
            { timeout: 2000, stdio: 'ignore' }
          );
        }
        break;

      case 'scroll':
        execSync(
          `osascript -e '
            tell application "System Events"
              scroll area 1 by ${event.delta || 0}
            end tell'`,
          { timeout: 2000, stdio: 'ignore' }
        );
        break;
    }
  } catch (err) {
    console.error('[remote] Input injection failed:', err instanceof Error ? err.message : err);
    console.error('[remote] Note: macOS requires Accessibility permission for input injection');
  }
}
