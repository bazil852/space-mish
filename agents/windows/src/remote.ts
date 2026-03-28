import { execSync, execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCREENSHOT_PATH = path.join(os.tmpdir(), 'spacemish-screen.jpg');
const CAPTURE_SCRIPT_PATH = path.join(os.tmpdir(), 'spacemish-capture.ps1');

// Write the PowerShell capture script once on startup
const CAPTURE_SCRIPT = `
param([string]$OutPath, [int]$Quality = 60)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$screen = [System.Windows.Forms.Screen]::PrimaryScreen
$bounds = $screen.Bounds
$bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$encoderInfo = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
$bitmap.Save($OutPath, $encoderInfo, $encoderParams)
$graphics.Dispose()
$bitmap.Dispose()
`;

// Input injection script
const INPUT_SCRIPT_PATH = path.join(os.tmpdir(), 'spacemish-input.ps1');
const INPUT_SCRIPT = `
param([string]$Action, [int]$X = 0, [int]$Y = 0, [string]$Key = "", [string]$Button = "left")

Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class NativeInput {
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, int dx, int dy, int cData, IntPtr dwExtraInfo);
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, IntPtr dwExtraInfo);

    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;
    public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    public const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    public const uint MOUSEEVENTF_WHEEL = 0x0800;
}
"@

switch ($Action) {
    "move" {
        [NativeInput]::SetCursorPos($X, $Y)
    }
    "click" {
        [NativeInput]::SetCursorPos($X, $Y)
        Start-Sleep -Milliseconds 10
        if ($Button -eq "right") {
            [NativeInput]::mouse_event([NativeInput]::MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, [IntPtr]::Zero)
            [NativeInput]::mouse_event([NativeInput]::MOUSEEVENTF_RIGHTUP, 0, 0, 0, [IntPtr]::Zero)
        } else {
            [NativeInput]::mouse_event([NativeInput]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [IntPtr]::Zero)
            [NativeInput]::mouse_event([NativeInput]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [IntPtr]::Zero)
        }
    }
    "dblclick" {
        [NativeInput]::SetCursorPos($X, $Y)
        Start-Sleep -Milliseconds 10
        [NativeInput]::mouse_event([NativeInput]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [IntPtr]::Zero)
        [NativeInput]::mouse_event([NativeInput]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [IntPtr]::Zero)
        Start-Sleep -Milliseconds 50
        [NativeInput]::mouse_event([NativeInput]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [IntPtr]::Zero)
        [NativeInput]::mouse_event([NativeInput]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [IntPtr]::Zero)
    }
    "scroll" {
        [NativeInput]::SetCursorPos($X, $Y)
        [NativeInput]::mouse_event([NativeInput]::MOUSEEVENTF_WHEEL, 0, 0, $Y, [IntPtr]::Zero)
    }
    "type" {
        [System.Windows.Forms.SendKeys]::SendWait($Key)
    }
}
`;

let initialized = false;

export function initRemote(): void {
  if (initialized) return;
  fs.writeFileSync(CAPTURE_SCRIPT_PATH, CAPTURE_SCRIPT, 'utf-8');
  fs.writeFileSync(INPUT_SCRIPT_PATH, INPUT_SCRIPT, 'utf-8');
  initialized = true;
}

export function captureScreenshot(quality: number = 50): Buffer | null {
  initRemote();
  try {
    execSync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${CAPTURE_SCRIPT_PATH}" -OutPath "${SCREENSHOT_PATH}" -Quality ${quality}`,
      { timeout: 8000, windowsHide: true, stdio: 'ignore' }
    );
    return fs.readFileSync(SCREENSHOT_PATH);
  } catch (err) {
    console.error('[remote] Screenshot capture failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export function getScreenSize(): { width: number; height: number } {
  try {
    const result = execSync(
      'powershell -NoProfile -NonInteractive -Command "[System.Windows.Forms.Screen]::PrimaryScreen.Bounds | Select-Object Width,Height | ConvertTo-Json"',
      { encoding: 'utf-8', timeout: 5000, windowsHide: true }
    );
    const parsed = JSON.parse(result.trim());
    return { width: parsed.Width, height: parsed.Height };
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
  initRemote();
  try {
    const args: string[] = [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', INPUT_SCRIPT_PATH,
      '-Action', event.action,
    ];

    if (event.x !== undefined) args.push('-X', String(Math.round(event.x)));
    if (event.y !== undefined) args.push('-Y', String(Math.round(event.y)));
    if (event.key) args.push('-Key', event.key);
    if (event.button) args.push('-Button', event.button);

    execSync(`powershell ${args.join(' ')}`, {
      timeout: 3000,
      windowsHide: true,
      stdio: 'ignore',
    });
  } catch (err) {
    console.error('[remote] Input injection failed:', err instanceof Error ? err.message : err);
  }
}
