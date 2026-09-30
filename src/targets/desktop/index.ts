import { BaseTarget, SemanticElement, ScreenFrame } from "../base.js";
import { DisplayMetrics } from "../../core/coordinate-mapper.js";
import { SwipeCoordinates } from "../../core/gesture-engine.js";
import { logger } from "../../utils/logger.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface DesktopWindowInfo {
  id?: string;
  title: string;
  processName?: string;
  isActive?: boolean;
}

export class DesktopTarget extends BaseTarget {
  readonly name = "desktop";
  override isReady = false;
  override readonly scaffoldNotice =
    "Desktop target adapter: Window management and display inspection are available. Full native coordinate grounding requires OS accessibility permissions.";

  async init(): Promise<void> {
    logger.info("Initializing Desktop target adapter for OS: " + process.platform);
    this.isReady = true;
  }

  async getDisplayMetrics(): Promise<DisplayMetrics> {
    // In CI environments (headless runners), avoid slow powershell System.Windows.Forms startup
    if (process.env.CI) {
      return { width: 1920, height: 1080, rotation: 0 };
    }

    // Attempt to determine native display resolution
    if (process.platform === "win32") {
      try {
        const { stdout } = await execFileAsync(
          "powershell",
          [
            "-NoProfile",
            "-Command",
            "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds | ConvertTo-Json",
          ],
          { timeout: 2500 }
        );
        const bounds = JSON.parse(stdout);
        return {
          width: bounds.Width || 1920,
          height: bounds.Height || 1080,
          rotation: 0,
        };
      } catch {
        // fallback
      }
    }
    return { width: 1920, height: 1080, rotation: 0 };
  }

  async captureScreenshot(): Promise<ScreenFrame> {
    throw new Error(
      "Desktop display capture requires native display capture library or OS screen recording permission."
    );
  }

  async listWindows(): Promise<DesktopWindowInfo[]> {
    if (process.platform === "win32") {
      try {
        const cmd = "Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object Id, ProcessName, MainWindowTitle | ConvertTo-Json";
        const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Command", cmd], { timeout: 2500 });
        const parsed = JSON.parse(stdout);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        return list.map((w: any) => ({
          id: String(w.Id),
          title: w.MainWindowTitle,
          processName: w.ProcessName,
        }));
      } catch {
        return [];
      }
    } else if (process.platform === "darwin") {
      try {
        const script = `tell application "System Events" to get name of every window of (every process whose background only is false)`;
        const { stdout } = await execFileAsync("osascript", ["-e", script], { timeout: 2500 });
        return stdout
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((title) => ({ title }));
      } catch {
        return [];
      }
    }
    return [];
  }

  async focusWindow(titleSubstr: string): Promise<boolean> {
    if (process.platform === "win32") {
      try {
        const psScript = `
$p = Get-Process | Where-Object { $_.MainWindowTitle -like '*${titleSubstr.replace(/'/g, "''")}*' } | Select-Object -First 1
if ($p) {
  $wshell = New-Object -ComObject WScript.Shell
  $wshell.AppActivate($p.Id)
  Write-Output "OK"
}
`;
        const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Command", psScript], { timeout: 2500 });
        return stdout.includes("OK");
      } catch {
        return false;
      }
    }
    return false;
  }

  async getSemanticHierarchy(): Promise<SemanticElement[]> {
    return [];
  }

  async tap(_x: number, _y: number): Promise<void> {}
  async swipe(_coords: SwipeCoordinates): Promise<void> {}
  async typeText(_text: string): Promise<void> {}
  async pressKey(_key: string): Promise<void> {}
  async getRecentLogs(_filter?: string): Promise<string[]> {
    return [];
  }
  async checkCrashWatchdog(): Promise<{ hasCrashed: boolean; reason?: string }> {
    return { hasCrashed: false };
  }
  async close(): Promise<void> {}
}
