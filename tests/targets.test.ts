import { describe, it, expect } from "vitest";
import { createTarget, BrowserTarget, DesktopTarget, AndroidTarget, BaseTarget, TargetManager } from "../src/targets/index.js";

describe("Targets Factory & Adapters", () => {
  const dummyLogsConfig = {
    ringBufferSize: 1000,
    filterNoise: true,
    watchdog: true,
    maxAnomalyLines: 10,
  };

  it("creates Android target by default", () => {
    const target = createTarget({ type: "android", adbPath: "adb" }, dummyLogsConfig);
    expect(target).toBeInstanceOf(AndroidTarget);
    expect(target.name).toBe("android");
    expect(target.isReady).toBe(true);
  });

  it("creates Browser target and verifies stub implementations", async () => {
    const target = createTarget({ type: "browser", adbPath: "adb" }, dummyLogsConfig);
    expect(target).toBeInstanceOf(BrowserTarget);
    expect(target.name).toBe("browser");
    expect(target.isReady).toBe(false);
    expect(target.scaffoldNotice).toContain("Browser target requires Playwright");

    await expect(target.captureScreenshot()).rejects.toThrow(/Browser target not initialized/);

    const metrics = await target.getDisplayMetrics();
    expect(metrics).toEqual({ width: 1280, height: 800, rotation: 0 });

    expect(await target.getSemanticHierarchy()).toEqual([]);
    expect(await target.getRecentLogs()).toEqual([]);
    expect(await target.checkCrashWatchdog()).toEqual({ hasCrashed: false });

    await expect(target.tap(10, 10)).resolves.toBeUndefined();
    await expect(target.swipe({ startX: 0, startY: 0, endX: 10, endY: 10, durationMs: 100 })).resolves.toBeUndefined();
    await expect(target.typeText("test")).resolves.toBeUndefined();
    await expect(target.pressKey("back")).resolves.toBeUndefined();
    await expect(target.close()).resolves.toBeUndefined();
  });

  it("creates Desktop target and verifies stub implementations", async () => {
    const target = createTarget({ type: "desktop", adbPath: "adb" }, dummyLogsConfig);
    expect(target).toBeInstanceOf(DesktopTarget);
    expect(target.name).toBe("desktop");
    expect(target.scaffoldNotice).toContain("Desktop target adapter");

    await expect(target.captureScreenshot()).rejects.toThrow(/Desktop display capture requires/);

    const metrics = await target.getDisplayMetrics();
    expect(metrics.width).toBeGreaterThan(0);
    expect(metrics.height).toBeGreaterThan(0);

    expect(await target.getSemanticHierarchy()).toEqual([]);
    expect(await target.getRecentLogs()).toEqual([]);
    expect(await target.checkCrashWatchdog()).toEqual({ hasCrashed: false });

    await expect(target.tap(10, 10)).resolves.toBeUndefined();
    await expect(target.swipe({ startX: 0, startY: 0, endX: 10, endY: 10, durationMs: 100 })).resolves.toBeUndefined();
    await expect(target.typeText("test")).resolves.toBeUndefined();
    await expect(target.pressKey("enter")).resolves.toBeUndefined();
    await expect(target.close()).resolves.toBeUndefined();
  });

  it("creates iOS target and verifies adapter properties", async () => {
    const { IosTarget } = await import("../src/targets/ios/index.js");
    const target = createTarget({ type: "ios", adbPath: "adb" }, dummyLogsConfig);
    expect(target).toBeInstanceOf(IosTarget);
    expect(target.name).toBe("ios");
    expect(target.isReady).toBe(false);
    expect(target.scaffoldNotice).toContain("iOS target is initialized in adapter mode");

    const metrics = await target.getDisplayMetrics();
    expect(metrics).toEqual({ width: 1170, height: 2532, rotation: 0 });
  });

  describe("TargetManager Multi-Platform Routing & Fallbacks", () => {
    it("manages multiple platforms and provides status queries", async () => {
      const { TargetManager } = await import("../src/targets/index.js");
      const manager = new TargetManager(
        { enabled: ["android", "browser"], defaultPlatform: "android" },
        dummyLogsConfig
      );

      expect(manager.getEnabledPlatforms()).toEqual(["android", "browser"]);
      expect(manager.getActivePlatforms()).toEqual(["android"]);
      expect(manager.getPrimaryTarget().name).toBe("android");
      expect(manager.getTarget("browser").name).toBe("browser");

      // Requesting an unknown or non-enabled platform falls back to first available target
      const fallbackTarget = manager.getTarget("ios" as any);
      expect(fallbackTarget.name).toBe("android");

      await expect(manager.initAll()).resolves.toBeUndefined();
      await expect(manager.closeAll()).resolves.toBeUndefined();
    });

    it("throws error when getTarget is called and no targets are configured", async () => {
      const { TargetManager } = await import("../src/targets/index.js");
      const emptyManager = new TargetManager({ enabled: [] }, dummyLogsConfig);

      expect(() => emptyManager.getTarget()).toThrow(/No target available for platform/);
    });
  });

  describe("BaseTarget default findSemanticElement implementation", () => {
    class ConcreteTestTarget extends BaseTarget {
      readonly name = "test";
      async init(): Promise<void> {}
      async getDisplayMetrics(): Promise<any> { return { width: 100, height: 100, rotation: 0 }; }
      async captureScreenshot(): Promise<any> { throw new Error("not implemented"); }
      async getSemanticHierarchy(): Promise<any[]> {
        return [
          { text: "Confirm Payment", bounds: { left: 0, top: 0, right: 10, bottom: 10 } },
          { contentDescription: "Account settings", bounds: { left: 10, top: 10, right: 20, bottom: 20 } },
          { id: "com.test:id/btn_cancel", bounds: { left: 20, top: 20, right: 30, bottom: 30 } },
        ];
      }
      async tap(): Promise<void> {}
      async swipe(): Promise<void> {}
      async typeText(): Promise<void> {}
      async pressKey(): Promise<void> {}
      async getRecentLogs(): Promise<string[]> { return []; }
      async checkCrashWatchdog(): Promise<any> { return { hasCrashed: false }; }
      async close(): Promise<void> {}
    }

    it("matches text, contentDescription, and resource-id case-insensitively", async () => {
      const target = new ConcreteTestTarget();

      const textMatch = await target.findSemanticElement("confirm");
      expect(textMatch?.text).toBe("Confirm Payment");

      const descMatch = await target.findSemanticElement("settings");
      expect(descMatch?.contentDescription).toBe("Account settings");

      const idMatch = await target.findSemanticElement("btn_cancel");
      expect(idMatch?.id).toBe("com.test:id/btn_cancel");

      const noMatch = await target.findSemanticElement("nonexistent");
      expect(noMatch).toBeNull();
    });
  });
});
