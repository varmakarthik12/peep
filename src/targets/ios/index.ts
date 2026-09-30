import { BaseTarget, SemanticElement, ScreenFrame } from "../base.js";
import { DisplayMetrics } from "../../core/coordinate-mapper.js";
import { SwipeCoordinates } from "../../core/gesture-engine.js";
import { IosTargetConfig } from "../../config/schema.js";
import { logger } from "../../utils/logger.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class IosTarget extends BaseTarget {
  readonly name = "ios";
  override isReady = false;
  override readonly scaffoldNotice =
    "iOS target is initialized in adapter mode. Ensure Xcode command-line tools (xcrun simctl) or go-ios/idb are installed for simulator or physical device automation.";

  private config: IosTargetConfig;
  private simulatorUdid?: string;

  constructor(config: Partial<IosTargetConfig> = {}) {
    super();
    this.config = {
      deviceType: "simulator",
      wdaPort: 8100,
      simctlPath: "xcrun",
      goIosPath: "ios",
      ...config,
    };
    this.simulatorUdid = config.udid;
  }

  async init(): Promise<void> {
    logger.info(`Initializing iOS target adapter (mode: ${this.config.deviceType})...`);
    // Check if xcrun simctl or go-ios is available
    if (process.platform === "darwin") {
      try {
        const { stdout } = await execFileAsync("xcrun", ["simctl", "list", "devices", "booted"]);
        if (stdout.includes("Booted")) {
          logger.info("Found booted iOS simulator.");
          this.isReady = true;
          return;
        }
      } catch (err) {
        logger.debug(`xcrun simctl check: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Physical device or non-macOS host via go-ios / idb
    try {
      const { stdout } = await execFileAsync("go-ios", ["version"]);
      if (stdout) {
        logger.info("go-ios detected for iOS physical device automation.");
        this.isReady = true;
        return;
      }
    } catch {
      // not found
    }

    logger.debug(this.scaffoldNotice);
  }

  async getDisplayMetrics(): Promise<DisplayMetrics> {
    return { width: 1170, height: 2532, rotation: 0 }; // Default iPhone screen
  }

  async captureScreenshot(): Promise<ScreenFrame> {
    if (!this.isReady) {
      throw new Error("iOS target not ready. No booted iOS simulator or connected device found.");
    }
    // Screenshot via xcrun simctl io booted screenshot
    const { stdout } = await execFileAsync("xcrun", ["simctl", "io", "booted", "screenshot", "-"], {
      encoding: "buffer",
      maxBuffer: 15 * 1024 * 1024,
    });
    return {
      buffer: stdout,
      base64: stdout.toString("base64"),
      width: 1170,
      height: 2532,
    };
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
