import { BaseTarget, SemanticElement, ScreenFrame } from "../base.js";
import { DisplayMetrics } from "../../core/coordinate-mapper.js";
import { SwipeCoordinates, GestureEngine } from "../../core/gesture-engine.js";
import { AdbClient, AdbClientOptions } from "./adb-client.js";
import { ScreenCapture } from "./screencap.js";
import { UiHierarchyParser } from "./ui-hierarchy.js";
import { LogcatTailer } from "./logcat-tailer.js";
import { TargetConfig, LogsConfig } from "../../config/schema.js";
import { logger } from "../../utils/logger.js";

export class AndroidTarget extends BaseTarget {
  readonly name = "android";

  private adb: AdbClient;
  private capture: ScreenCapture;
  private hierarchy: UiHierarchyParser;
  private logcat: LogcatTailer;
  private metrics?: DisplayMetrics;

  constructor(targetConfig: TargetConfig, logsConfig: LogsConfig) {
    super();
    const androidConfig = targetConfig.android || {};
    const options: AdbClientOptions = {
      adbPath: androidConfig.adbPath || targetConfig.adbPath || "adb",
      deviceId: androidConfig.deviceId || targetConfig.deviceId,
      host: androidConfig.adbHost,
      port: androidConfig.adbPort,
      connectAddress: androidConfig.connectAddress,
    };

    this.adb = new AdbClient(options);
    this.capture = new ScreenCapture(this.adb);
    this.hierarchy = new UiHierarchyParser(this.adb);
    this.logcat = new LogcatTailer(
      this.adb,
      logsConfig.ringBufferSize,
      logsConfig.filterNoise
    );
  }

  async init(): Promise<void> {
    const selected = await this.adb.autoSelectDevice();
    this.metrics = await this.adb.getDisplayMetrics();
    logger.info(
      `Connected to Android device: ${selected} (${this.metrics.width}x${this.metrics.height}, rotation: ${this.metrics.rotation}°)`
    );

    // Start background logcat ring buffer
    await this.logcat.start();
  }

  async getDisplayMetrics(): Promise<DisplayMetrics> {
    if (!this.metrics) {
      this.metrics = await this.adb.getDisplayMetrics();
    }
    return this.metrics;
  }

  async captureScreenshot(): Promise<ScreenFrame> {
    return this.capture.capture();
  }

  async getSemanticHierarchy(): Promise<SemanticElement[]> {
    return this.hierarchy.dumpHierarchy();
  }

  async findSemanticElement(query: string): Promise<SemanticElement | null> {
    return this.hierarchy.findElement(query);
  }

  async tap(x: number, y: number): Promise<void> {
    await this.adb.shell(["input", "tap", String(x), String(y)]);
  }

  async swipe(coords: SwipeCoordinates): Promise<void> {
    await this.adb.shell([
      "input",
      "swipe",
      String(coords.startX),
      String(coords.startY),
      String(coords.endX),
      String(coords.endY),
      String(coords.durationMs),
    ]);
  }

  async typeText(text: string): Promise<void> {
    const sanitized = GestureEngine.sanitizeAdbText(text);
    await this.adb.shell(["input", "text", `"${sanitized}"`]);
  }

  async pressKey(key: string): Promise<void> {
    const code = GestureEngine.resolveKeycode(key);
    await this.adb.shell(["input", "keyevent", String(code)]);
  }

  async getRecentLogs(filter?: string): Promise<string[]> {
    return this.logcat.getRecentLogs(filter);
  }

  async checkCrashWatchdog(): Promise<{ hasCrashed: boolean; reason?: string }> {
    return this.logcat.checkWatchdog();
  }

  resetCrashWatchdog(): void {
    this.logcat.resetWatchdog();
  }

  async close(): Promise<void> {
    this.logcat.stop();
    await this.adb.close();
  }
}

export * from "./adb-client.js";
export * from "./screencap.js";
export * from "./ui-hierarchy.js";
export * from "./logcat-tailer.js";
