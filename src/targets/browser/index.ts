import { BaseTarget, SemanticElement, ScreenFrame } from "../base.js";
import { DisplayMetrics } from "../../core/coordinate-mapper.js";
import { SwipeCoordinates } from "../../core/gesture-engine.js";

export class BrowserTarget extends BaseTarget {
  readonly name = "browser";
  override readonly isReady = false;
  override readonly scaffoldNotice =
    "Browser target adapter is planned for v0.2. To use Peep today, run with target: android (ADB / Emulator).";

  async init(): Promise<void> {
    throw new Error(this.scaffoldNotice);
  }

  async getDisplayMetrics(): Promise<DisplayMetrics> {
    return { width: 1920, height: 1080, rotation: 0 };
  }

  async captureScreenshot(): Promise<ScreenFrame> {
    throw new Error("Browser target not initialized.");
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
