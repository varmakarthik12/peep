import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MacroRunner } from "../src/core/macro-runner.js";
import { BaseInferenceProvider, MacroActionStep } from "../src/providers/base.js";
import { BaseTarget, ScreenFrame } from "../src/targets/base.js";
import { CoordinateMapper } from "../src/core/coordinate-mapper.js";
import { tokenShield } from "../src/core/token-shield.js";

describe("MacroRunner Autonomous Micro-Loop", () => {
  let setTimeoutSpy: any;

  beforeEach(() => {
    tokenShield.reset();
    // Fast-forward setTimeout to make test execution immediate
    setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: Function) => {
      fn();
      return 0 as any;
    }) as any);
  });

  afterEach(() => {
    setTimeoutSpy?.mockRestore();
    vi.restoreAllMocks();
  });

  const mockFrame: ScreenFrame = {
    buffer: Buffer.alloc(32),
    base64: "dummybase64",
    width: 1080,
    height: 2400,
  };

  const createMockTarget = (overrides: Partial<BaseTarget> = {}) => {
    return {
      name: "mock_target",
      init: vi.fn(),
      getDisplayMetrics: vi.fn().mockResolvedValue({ width: 1080, height: 2400, rotation: 0 }),
      captureScreenshot: vi.fn().mockResolvedValue(mockFrame),
      tap: vi.fn().mockResolvedValue(undefined),
      swipe: vi.fn().mockResolvedValue(undefined),
      typeText: vi.fn().mockResolvedValue(undefined),
      pressKey: vi.fn().mockResolvedValue(undefined),
      getRecentLogs: vi.fn().mockResolvedValue([]),
      checkCrashWatchdog: vi.fn().mockResolvedValue({ hasCrashed: false }),
      close: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    } as unknown as BaseTarget;
  };

  const createMockProvider = (decisions: MacroActionStep[]) => {
    let callCount = 0;
    return {
      name: "mock_provider",
      checkHealth: vi.fn(),
      groundElement: vi.fn(),
      assertCondition: vi.fn(),
      summarizeLogAnomalies: vi.fn(),
      decideNextAction: vi.fn().mockImplementation(async () => {
        const step = decisions[callCount] || {
          action: "done",
          thought: "Default done",
        };
        callCount++;
        return step;
      }),
    } as unknown as BaseInferenceProvider;
  };

  const mapper = new CoordinateMapper({ width: 1080, height: 2400 });

  it("completes successfully when provider returns 'done' action", async () => {
    const provider = createMockProvider([
      { action: "done", thought: "Settings screen is open" },
    ]);
    const target = createMockTarget();
    const runner = new MacroRunner(provider, target, mapper);

    const result = await runner.runGoal("Open Settings", 5);

    expect(result.status).toBe("SUCCESS");
    expect(result.stepsExecuted).toBe(1);
    expect(result.goal).toBe("Open Settings");
    expect(result.history[0]).toContain("Done (Settings screen is open)");
    expect(result.cloudTokensSaved).toBe(1900);
  });

  it("handles failure when provider returns 'fail' action", async () => {
    const provider = createMockProvider([
      { action: "fail", thought: "Login failed with invalid credentials popup" },
    ]);
    const target = createMockTarget();
    const runner = new MacroRunner(provider, target, mapper);

    const result = await runner.runGoal("Login to app", 5);

    expect(result.status).toBe("FAILED");
    expect(result.stepsExecuted).toBe(1);
    expect(result.error).toBe("Login failed with invalid credentials popup");
  });

  it("executes multi-step sequences before completing", async () => {
    const provider = createMockProvider([
      { action: "tap", point: { x: 500, y: 500 }, thought: "Tap input field" },
      { action: "type", text: "hello@example.com", thought: "Type email" },
      { action: "key", key: "enter", thought: "Press enter" },
      { action: "swipe", direction: "up", thought: "Scroll down" },
      { action: "wait", thought: "Waiting for network" },
      { action: "done", thought: "Submitted" },
    ]);
    const target = createMockTarget();
    const runner = new MacroRunner(provider, target, mapper);

    const result = await runner.runGoal("Fill form", 10);

    expect(result.status).toBe("SUCCESS");
    expect(result.stepsExecuted).toBe(6);
    expect(target.tap).toHaveBeenCalledTimes(1);
    expect(target.typeText).toHaveBeenCalledWith("hello@example.com");
    expect(target.pressKey).toHaveBeenCalledWith("enter");
    expect(target.swipe).toHaveBeenCalled();
    expect(result.cloudTokensSaved).toBe(6 * 1900);
  });

  it("aborts when crash watchdog detects an app crash", async () => {
    const provider = createMockProvider([
      { action: "tap", point: { x: 200, y: 300 }, thought: "Tap button that crashes app" },
      { action: "done", thought: "Done" },
    ]);
    const target = createMockTarget({
      checkCrashWatchdog: vi.fn().mockResolvedValue({
        hasCrashed: true,
        reason: "FATAL EXCEPTION: NullPointerException in MainActivity",
      }),
    });
    const runner = new MacroRunner(provider, target, mapper);

    const result = await runner.runGoal("Tap feature", 5);

    expect(result.status).toBe("FAILED");
    expect(result.stepsExecuted).toBe(1);
    expect(result.error).toContain("Crash detected during macro execution");
    expect(result.error).toContain("NullPointerException");
  });

  it("stops and returns MAX_STEPS_REACHED when step limit is hit", async () => {
    const provider = createMockProvider([
      { action: "tap", point: { x: 100, y: 100 }, thought: "Tapping 1" },
      { action: "tap", point: { x: 100, y: 100 }, thought: "Tapping 2" },
      { action: "tap", point: { x: 100, y: 100 }, thought: "Tapping 3" },
    ]);
    const target = createMockTarget();
    const runner = new MacroRunner(provider, target, mapper);

    const result = await runner.runGoal("Endless task", 2);

    expect(result.status).toBe("MAX_STEPS_REACHED");
    expect(result.stepsExecuted).toBe(2);
    expect(result.cloudTokensSaved).toBe(2 * 1900);
  });

  it("records action execution errors into history and continues", async () => {
    const provider = createMockProvider([
      { action: "tap", point: { x: 100, y: 100 }, thought: "Broken tap" },
      { action: "done", thought: "Done" },
    ]);
    const target = createMockTarget({
      tap: vi.fn().mockRejectedValue(new Error("Input device unresponsive")),
    });
    const runner = new MacroRunner(provider, target, mapper);

    const result = await runner.runGoal("Try tapping", 5);

    expect(result.status).toBe("SUCCESS");
    expect(result.history[0]).toContain("Error executing action: Error: Input device unresponsive");
  });
});
