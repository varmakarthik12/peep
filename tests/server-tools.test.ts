import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerTools } from "../src/server/tools.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AndroidTarget } from "../src/targets/android/index.js";
import { TargetManager } from "../src/targets/index.js";
import { BaseInferenceProvider } from "../src/providers/base.js";
import { CoordinateMapper } from "../src/core/coordinate-mapper.js";
import { tokenShield } from "../src/core/token-shield.js";

describe("MCP Server Tools Registration & Handlers", () => {
  let tools: Record<string, Function> = {};
  let mockServer: McpServer;
  let mockTarget: AndroidTarget;
  let mockProvider: BaseInferenceProvider;
  let mapper: CoordinateMapper;

  beforeEach(() => {
    tokenShield.reset();
    tools = {};

    mockServer = {
      tool: vi.fn((name: string, _desc: string, _schema: any, handler: Function) => {
        tools[name] = handler;
      }),
    } as unknown as McpServer;

    mockTarget = Object.assign(Object.create(AndroidTarget.prototype), {
      name: "android",
      isReady: true,
      init: vi.fn(),
      getDisplayMetrics: vi.fn().mockResolvedValue({ width: 1080, height: 2400, rotation: 0 }),
      captureScreenshot: vi.fn().mockResolvedValue({
        buffer: Buffer.alloc(10),
        base64: "dummybase64",
        width: 1080,
        height: 2400,
      }),
      tap: vi.fn().mockResolvedValue(undefined),
      swipe: vi.fn().mockResolvedValue(undefined),
      typeText: vi.fn().mockResolvedValue(undefined),
      pressKey: vi.fn().mockResolvedValue(undefined),
      findSemanticElement: vi.fn(),
      getRecentLogs: vi.fn().mockResolvedValue(["Line 1", "Line 2"]),
      checkCrashWatchdog: vi.fn().mockResolvedValue({ hasCrashed: false }),
    });

    mockProvider = {
      name: "mock_provider",
      checkHealth: vi.fn(),
      groundElement: vi.fn(),
      assertCondition: vi.fn(),
      summarizeLogAnomalies: vi.fn().mockResolvedValue({
        hasFatalError: false,
        summary: "No crash found in logs.",
      }),
      decideNextAction: vi.fn().mockResolvedValue({
        action: "done",
        thought: "Goal reached",
      }),
    } as unknown as BaseInferenceProvider;

    mapper = new CoordinateMapper({ width: 1080, height: 2400 });

    registerTools(mockServer, mockTarget, mockProvider, mapper);
  });

  it("registers all 8 core Peep MCP tools", () => {
    expect(tools["peep_find_and_tap"]).toBeDefined();
    expect(tools["peep_type_text"]).toBeDefined();
    expect(tools["peep_swipe"]).toBeDefined();
    expect(tools["peep_press_key"]).toBeDefined();
    expect(tools["peep_assert_screen_state"]).toBeDefined();
    expect(tools["peep_tail_and_filter_logs"]).toBeDefined();
    expect(tools["peep_execute_goal"]).toBeDefined();
    expect(tools["peep_get_telemetry"]).toBeDefined();
  });

  describe("peep_find_and_tap", () => {
    it("taps element immediately when found in Tier 0 semantic tree", async () => {
      mockTarget.findSemanticElement = vi.fn().mockResolvedValue({
        text: "Submit",
        id: "com.example:id/btn_submit",
        bounds: { left: 100, top: 200, right: 300, bottom: 400 },
        clickable: true,
      });

      const res = await tools["peep_find_and_tap"]({
        target: "Submit",
        strategy: "auto",
      });

      expect(mockTarget.tap).toHaveBeenCalledWith(200, 300);
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.method).toBe("tier0_semantic_tree");
      expect(data.tappedPoint).toEqual([200, 300]);
    });

    it("falls back to Tier 2 local VLM when not in semantic tree", async () => {
      mockTarget.findSemanticElement = vi.fn().mockResolvedValue(null);
      mockProvider.groundElement = vi.fn().mockResolvedValue({
        found: true,
        thought: "Found blue shopping cart icon",
        point: { x: 800, y: 150 },
        confidence: 0.92,
      });

      const res = await tools["peep_find_and_tap"]({
        target: "Cart icon",
        strategy: "auto",
      });

      expect(mockTarget.tap).toHaveBeenCalled();
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.method).toBe("tier2_local_vlm");
    });

    it("returns NOT_FOUND when neither tree nor VLM finds the element", async () => {
      mockTarget.findSemanticElement = vi.fn().mockResolvedValue(null);
      mockProvider.groundElement = vi.fn().mockResolvedValue({
        found: false,
        thought: "Cannot locate target",
      });

      const res = await tools["peep_find_and_tap"]({
        target: "Unknown button",
        strategy: "auto",
      });

      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("NOT_FOUND");
      expect(data.method).toBe("tier2_local_vlm");
    });

    it("respects tree_only strategy without invoking VLM", async () => {
      mockTarget.findSemanticElement = vi.fn().mockResolvedValue(null);

      const res = await tools["peep_find_and_tap"]({
        target: "Invisible icon",
        strategy: "tree_only",
      });

      expect(mockProvider.groundElement).not.toHaveBeenCalled();
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("NOT_FOUND");
      expect(data.method).toBe("tree_only");
    });
  });

  describe("peep_type_text", () => {
    it("types text into active field", async () => {
      const res = await tools["peep_type_text"]({
        text: "test@example.com",
        clearFirst: false,
      });

      expect(mockTarget.typeText).toHaveBeenCalledWith("test@example.com");
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.textTyped).toBe("test@example.com");
    });

    it("clears field first if clearFirst is true", async () => {
      await tools["peep_type_text"]({
        text: "new-text",
        clearFirst: true,
      });

      expect(mockTarget.pressKey).toHaveBeenCalledWith("backspace");
      expect(mockTarget.typeText).toHaveBeenCalledWith("new-text");
    });
  });

  describe("peep_swipe & peep_press_key", () => {
    it("executes swipe gesture", async () => {
      const res = await tools["peep_swipe"]({
        direction: "up",
        distance: "medium",
      });

      expect(mockTarget.swipe).toHaveBeenCalled();
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.direction).toBe("up");
    });

    it("presses specified navigation or hardware key", async () => {
      const res = await tools["peep_press_key"]({ key: "back" });

      expect(mockTarget.pressKey).toHaveBeenCalledWith("back");
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.keyDispatched).toBe("back");
    });
  });

  describe("peep_assert_screen_state", () => {
    it("evaluates visual assertion passing", async () => {
      mockProvider.assertCondition = vi.fn().mockResolvedValue({
        passed: true,
        confidence: 0.95,
        explanation: "Dialog box confirmed",
      });

      const res = await tools["peep_assert_screen_state"]({
        expectedState: "Dialog is open",
      });

      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("PASS");
      expect(data.assertionPassed).toBe(true);
      expect(data.confidence).toBe(0.95);
    });

    it("evaluates visual assertion failing", async () => {
      mockProvider.assertCondition = vi.fn().mockResolvedValue({
        passed: false,
        confidence: 0.88,
        explanation: "Dialog box was not found",
      });

      const res = await tools["peep_assert_screen_state"]({
        expectedState: "Dialog is open",
      });

      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("FAIL");
      expect(data.assertionPassed).toBe(false);
    });
  });

  describe("peep_tail_and_filter_logs", () => {
    it("tails logs and runs SLM crash diagnosis", async () => {
      const res = await tools["peep_tail_and_filter_logs"]({
        searchCrashes: true,
        limit: 50,
      });

      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.rawLinesBuffered).toBe(2);
      expect(data.diagnosis.hasFatalError).toBe(false);
    });
  });

  describe("peep_execute_goal", () => {
    it("runs autonomous micro-loop and returns result", async () => {
      const res = await tools["peep_execute_goal"]({
        goal: "Test goal",
        maxSteps: 3,
      });

      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.goal).toBe("Test goal");
    });
  });

  describe("peep_get_telemetry", () => {
    it("returns cumulative session token metrics", async () => {
      tokenShield.recordShieldedScreenshot(50);
      const res = await tools["peep_get_telemetry"]();

      const data = JSON.parse(res.content[0].text);
      expect(data.totalActions).toBe(1);
      expect(data.screenshotsShielded).toBe(1);
      expect(data.cloudTokensSaved).toBe(1600);
    });
  });

  describe("Platform Routing & Unsupported Target Handling", () => {
    let multiTools: Record<string, Function> = {};

    beforeEach(() => {
      multiTools = {};
      const server = {
        tool: vi.fn((name: string, _desc: string, _schema: any, handler: Function) => {
          multiTools[name] = handler;
        }),
      } as unknown as McpServer;

      const multiTargetManager = new TargetManager(
        { enabled: ["android", "browser", "desktop"], defaultPlatform: "android" },
        { ringBufferSize: 1000, filterNoise: true, watchdog: false, maxAnomalyLines: 10 }
      );

      registerTools(server, multiTargetManager, mockProvider, mapper);
    });

    it("returns UNSUPPORTED_PLATFORM when peep_find_and_tap is called with platform: browser", async () => {
      const res = await multiTools["peep_find_and_tap"]({
        target: "Submit",
        platform: "browser",
      });

      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("UNSUPPORTED_PLATFORM");
      expect(data.platform).toBe("browser");
      expect(data.message).toContain("Browser target adapter is planned for v0.2");
      expect(data.activePlatforms).toEqual(["android"]);
    });

    it("returns UNSUPPORTED_PLATFORM when peep_swipe is called with platform: desktop", async () => {
      const res = await multiTools["peep_swipe"]({
        direction: "up",
        platform: "desktop",
      });

      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("UNSUPPORTED_PLATFORM");
      expect(data.platform).toBe("desktop");
      expect(data.message).toContain("Desktop target adapter is planned for v0.2");
    });

    it("returns UNSUPPORTED_PLATFORM for peep_assert_screen_state on browser without throwing error", async () => {
      const res = await multiTools["peep_assert_screen_state"]({
        expectedState: "Dashboard loaded",
        platform: "browser",
      });

      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("UNSUPPORTED_PLATFORM");
      expect(data.platform).toBe("browser");
    });
  });
});
