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
  override readonly isReady = true;

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

  async launchApp(options: {
    packageOrComponent: string;
    stopExisting?: boolean;
    resetState?: boolean;
    waitForLaunch?: boolean;
    extras?: Record<string, string | number | boolean>;
  }) {
    let packageName = options.packageOrComponent;
    let activity: string | undefined;

    if (packageName.includes("/")) {
      const parts = packageName.split("/");
      packageName = parts[0];
      activity = parts[1];
    }

    if (options.resetState) {
      try {
        await this.adb.clearAppData(packageName);
      } catch {
        // ignore
      }
    }

    const res = await this.adb.startActivity({
      packageName,
      activity,
      stopFirst: options.stopExisting ?? true,
      wait: options.waitForLaunch ?? true,
      extras: options.extras,
    });

    await new Promise((r) => setTimeout(r, 300));
    const watchdog = await this.checkCrashWatchdog();
    if (watchdog.hasCrashed) {
      return { ...res, crashDetected: watchdog.reason };
    }
    return res;
  }

  async installApp(
    apkPath: string,
    options?: { reinstall?: boolean; grantPermissions?: boolean; allowDowngrade?: boolean }
  ) {
    return this.adb.installApk(apkPath, options);
  }

  async uninstallApp(packageName: string, keepData?: boolean) {
    return this.adb.uninstallApk(packageName, keepData);
  }

  async stopApp(packageName: string) {
    return this.adb.forceStop(packageName);
  }

  async clearAppData(packageName: string) {
    return this.adb.clearAppData(packageName);
  }

  async wakeAndUnlock(pinOrPassword?: string) {
    return this.adb.wakeAndUnlock(pinOrPassword);
  }

  async setClipboard(text: string) {
    return this.adb.setClipboard(text);
  }

  async getClipboard() {
    return this.adb.getClipboard();
  }

  async pasteClipboard() {
    return this.adb.pasteClipboard();
  }

  async getDeviceState() {
    return this.adb.getDeviceState();
  }

  async openDeepLink(url: string, packageName?: string) {
    const res = await this.adb.openDeepLink(url, packageName);
    const watchdog = await this.checkCrashWatchdog();
    if (watchdog.hasCrashed) {
      return { ...res, crashDetected: watchdog.reason };
    }
    return res;
  }

  async managePermissions(
    action: "grant" | "revoke" | "list",
    packageName: string,
    permission?: string
  ) {
    return this.adb.managePermissions(action, packageName, permission);
  }

  async setScreenOrientation(orientation: "portrait" | "landscape" | "auto") {
    return this.adb.setScreenOrientation(orientation);
  }

  async manageFiles(
    action: "push" | "pull" | "delete",
    devicePath: string,
    hostPath?: string,
    triggerMediaScan?: boolean
  ) {
    return this.adb.manageFiles(action, devicePath, hostPath, triggerMediaScan);
  }

  async listApps(
    filter?: "third_party" | "system" | "all",
    search?: string,
    limit?: number
  ) {
    return this.adb.listApps(filter, search, limit);
  }

  async getForegroundActivity() {
    return this.adb.getForegroundActivity();
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
