import { describe, it, expect } from "vitest";
import { createTarget, BrowserTarget, DesktopTarget, AndroidTarget } from "../src/targets/index.js";

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
  });

  it("creates Browser target and verifies stub implementations", async () => {
    const target = createTarget({ type: "browser", adbPath: "adb" }, dummyLogsConfig);
    expect(target).toBeInstanceOf(BrowserTarget);
    expect(target.name).toBe("browser");

    await expect(target.init()).rejects.toThrow(/Browser target adapter is planned for v0.2/);
    await expect(target.captureScreenshot()).rejects.toThrow(/Browser target not initialized/);

    const metrics = await target.getDisplayMetrics();
    expect(metrics).toEqual({ width: 1920, height: 1080, rotation: 0 });

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

    await expect(target.init()).rejects.toThrow(/Desktop target adapter is planned for v0.2/);
    await expect(target.captureScreenshot()).rejects.toThrow(/Desktop target not initialized/);

    const metrics = await target.getDisplayMetrics();
    expect(metrics).toEqual({ width: 1920, height: 1080, rotation: 0 });

    expect(await target.getSemanticHierarchy()).toEqual([]);
    expect(await target.getRecentLogs()).toEqual([]);
    expect(await target.checkCrashWatchdog()).toEqual({ hasCrashed: false });

    await expect(target.tap(10, 10)).resolves.toBeUndefined();
    await expect(target.swipe({ startX: 0, startY: 0, endX: 10, endY: 10, durationMs: 100 })).resolves.toBeUndefined();
    await expect(target.typeText("test")).resolves.toBeUndefined();
    await expect(target.pressKey("enter")).resolves.toBeUndefined();
    await expect(target.close()).resolves.toBeUndefined();
  });
});
