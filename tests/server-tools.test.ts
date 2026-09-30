import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerTools } from "../src/server/tools.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AndroidTarget, BrowserTarget, DesktopTarget } from "../src/targets/index.js";
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
      launchApp: vi.fn().mockResolvedValue({
        packageName: "com.example.app",
        totalTimeMs: 250,
        waitTimeMs: 180,
        launchState: "COLD",
      }),
      installApp: vi.fn().mockResolvedValue(undefined),
      uninstallApp: vi.fn().mockResolvedValue(undefined),
      stopApp: vi.fn().mockResolvedValue(undefined),
      clearAppData: vi.fn().mockResolvedValue(undefined),
      wakeAndUnlock: vi.fn().mockResolvedValue({ screenOn: true, keyguardDismissed: true }),
      setClipboard: vi.fn().mockResolvedValue(undefined),
      getClipboard: vi.fn().mockResolvedValue("sample clipboard text"),
      pasteClipboard: vi.fn().mockResolvedValue(undefined),
      getDeviceState: vi.fn().mockResolvedValue({
        foreground: { packageName: "com.example.app", activity: ".MainActivity" },
        display: { width: 1080, height: 2400, rotation: 0 },
        battery: { level: 95, charging: true },
      }),
      openDeepLink: vi.fn().mockResolvedValue({
        url: "https://example.com/test",
        resolvedPackage: "com.android.chrome",
        resolvedActivity: "com.google.android.apps.chrome.Main",
      }),
      managePermissions: vi.fn().mockResolvedValue({
        permissions: ["android.permission.CAMERA", "android.permission.RECORD_AUDIO"],
      }),
      setScreenOrientation: vi.fn().mockResolvedValue(undefined),
      manageFiles: vi.fn().mockResolvedValue({ success: true, message: "File pushed successfully" }),
      listApps: vi.fn().mockResolvedValue([
        { packageName: "com.example.app", isSystem: false },
        { packageName: "com.android.chrome", isSystem: true },
      ]),
      forceStopProcess: vi.fn().mockResolvedValue({
        target: "com.example.app",
        killed: true,
        method: "am_force_stop",
        terminatedPids: [1234],
      }),
      restartApp: vi.fn().mockResolvedValue({
        packageName: "com.example.app",
        totalTimeMs: 250,
        waitTimeMs: 180,
        launchState: "HOT",
        hasCrashed: false,
      }),
      restartSystemService: vi.fn().mockResolvedValue({
        service: "zygote",
        success: true,
        executionTimeMs: 120,
        message: "Service zygote restarted successfully.",
      }),
      executeRootCommand: vi.fn().mockResolvedValue({
        command: "id",
        success: true,
        exitCode: 0,
        stdout: "uid=0(root) gid=0(root)",
        stderr: "",
        durationMs: 45,
      }),
      manageSelinux: vi.fn().mockResolvedValue({
        mode: "Permissive",
        previousMode: "Enforcing",
        success: true,
      }),
      listProcesses: vi.fn().mockResolvedValue([
        { user: "root", pid: 1, ppid: 0, cmd: "init" },
        { user: "u0_a123", pid: 1234, ppid: 567, cmd: "com.example.app" },
      ]),
      setComponentEnabled: vi.fn().mockResolvedValue({
        component: "com.example.app/.MainActivity",
        enabled: true,
        success: true,
      }),
      getSystemProperty: vi.fn().mockResolvedValue("1"),
      setSystemProperty: vi.fn().mockResolvedValue({
        name: "debug.test",
        value: "1",
        success: true,
      }),
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
      analyzeScreen: vi.fn(),
    } as unknown as BaseInferenceProvider;

    mapper = new CoordinateMapper({ width: 1080, height: 2400 });

    registerTools(mockServer, mockTarget, mockProvider, mapper);
  });

  it("registers all 31 Peep MCP tools (including Root & LSPosed Developer Suite)", () => {
    const expectedTools = [
      "peep_find_and_tap",
      "peep_locate_element",
      "peep_analyze_screen",
      "peep_type_text",
      "peep_swipe",
      "peep_press_key",
      "peep_assert_screen_state",
      "peep_tail_and_filter_logs",
      "peep_execute_goal",
      "peep_get_telemetry",
      "peep_launch_app",
      "peep_install_app",
      "peep_stop_app",
      "peep_clear_app_data",
      "peep_wake_and_unlock",
      "peep_clipboard",
      "peep_get_device_state",
      "peep_open_deep_link",
      "peep_manage_permissions",
      "peep_set_screen_orientation",
      "peep_manage_files",
      "peep_list_apps",
      "peep_browser_navigate",
      "peep_browser_get_distilled_dom",
      "peep_window_management",
      "peep_force_stop_process",
      "peep_restart_app",
      "peep_restart_system_service",
      "peep_execute_root_command",
      "peep_manage_selinux",
      "peep_list_processes",
      "peep_set_component_enabled",
      "peep_system_properties",
    ];

    expect(Object.keys(tools)).toHaveLength(33);
    for (const name of expectedTools) {
      expect(tools[name]).toBeDefined();
    }
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

  describe("peep_locate_element", () => {
    it("locates element in semantic tree without executing tap", async () => {
      mockTarget.findSemanticElement = vi.fn().mockResolvedValue({
        text: "Save",
        id: "com.example:id/btn_save",
        bounds: { left: 100, top: 200, right: 300, bottom: 400 },
        clickable: true,
        scrollable: false,
      });

      const res = await tools["peep_locate_element"]({
        target: "Save",
        strategy: "auto",
      });

      expect(mockTarget.tap).not.toHaveBeenCalled();
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.found).toBe(true);
      expect(data.method).toBe("tier0_semantic_tree");
      expect(data.point).toEqual([200, 300]);
      expect(data.box).toEqual({ left: 100, top: 200, right: 300, bottom: 400 });
      expect(data.cloudTokensSaved).toBeGreaterThan(0);
    });

    it("falls back to local VLM for element location without tapping", async () => {
      mockTarget.findSemanticElement = vi.fn().mockResolvedValue(null);
      mockProvider.groundElement = vi.fn().mockResolvedValue({
        found: true,
        point: { x: 500, y: 500 },
        confidence: 0.92,
        thought: "Located icon near center",
      });

      const res = await tools["peep_locate_element"]({
        target: "Profile icon",
        strategy: "auto",
      });

      expect(mockTarget.tap).not.toHaveBeenCalled();
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.found).toBe(true);
      expect(data.method).toBe("tier2_local_vlm");
      expect(data.confidence).toBe(0.92);
      expect(data.cloudTokensSaved).toBeGreaterThan(0);
    });

    it("returns NOT_FOUND when element cannot be located in tree or VLM", async () => {
      mockTarget.findSemanticElement = vi.fn().mockResolvedValue(null);
      mockProvider.groundElement = vi.fn().mockResolvedValue({
        found: false,
        thought: "Element not visible",
      });

      const res = await tools["peep_locate_element"]({
        target: "Missing item",
        strategy: "auto",
      });

      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("NOT_FOUND");
      expect(data.found).toBe(false);
    });
  });

  describe("peep_analyze_screen", () => {
    it("analyzes screen via local vision model and returns structured visual assessment", async () => {
      mockProvider.analyzeScreen = vi.fn().mockResolvedValue({
        screenSummary: "Settings overview page with connectivity options",
        scrollState: {
          isScrollable: true,
          position: "top",
          canScrollUp: false,
          canScrollDown: true,
          scrollbarVisible: true,
        },
        visibleKeyElements: [
          { label: "Wi-Fi", type: "list_item", point: { x: 500, y: 200 } },
          { label: "Bluetooth", type: "list_item", point: { x: 500, y: 350 } },
        ],
        hasActiveOverlay: false,
        confidence: 0.95,
      });

      const res = await tools["peep_analyze_screen"]({
        prompt: "Check scroll position and items",
        focus: "all",
        useLocalVision: true,
      });

      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.method).toBe("local_vlm");
      expect(data.screenSummary).toContain("Settings overview page");
      expect(data.scrollState.position).toBe("top");
      expect(data.scrollState.canScrollDown).toBe(true);
      expect(data.visibleKeyElements).toHaveLength(2);
      expect(data.cloudTokensSaved).toBeGreaterThan(0);
    });

    it("synthesizes screen analysis from semantic hierarchy when useLocalVision is false", async () => {
      mockTarget.getSemanticHierarchy = vi.fn().mockResolvedValue([
        {
          id: "com.example:id/list",
          scrollable: true,
          bounds: { left: 0, top: 0, right: 1080, bottom: 1920 },
        },
        {
          text: "Item 1",
          clickable: true,
          bounds: { left: 100, top: 100, right: 500, bottom: 200 },
        },
      ]);

      const res = await tools["peep_analyze_screen"]({
        useLocalVision: false,
      });

      expect(mockProvider.analyzeScreen).not.toHaveBeenCalled();
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.method).toBe("tier0_semantic_tree");
      expect(data.scrollState.isScrollable).toBe(true);
      expect(data.visibleKeyElements.length).toBeGreaterThan(0);
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
      expect(data.message).toContain("Browser target");
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
      expect(data.message).toContain("Desktop target adapter");
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

  describe("New v0.2.0 Domain Tools", () => {
    it("peep_launch_app launches application and returns timing and status", async () => {
      const res = await tools["peep_launch_app"]({
        app: "com.example.app/.MainActivity",
        stopExisting: true,
        resetState: false,
        waitForLaunch: true,
      });

      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.app).toBe("com.example.app/.MainActivity");
      expect(data.totalTimeMs).toBe(250);
      expect(mockTarget.launchApp).toHaveBeenCalledWith({
        packageOrComponent: "com.example.app/.MainActivity",
        stopExisting: true,
        resetState: false,
        waitForLaunch: true,
        extras: undefined,
      });
    });

    it("peep_install_app installs APK with runtime permissions", async () => {
      const res = await tools["peep_install_app"]({
        path: "C:\\path\\to\\app.apk",
        grantPermissions: true,
        reinstall: true,
        allowDowngrade: false,
      });

      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.message).toContain("Successfully installed APK");
      expect(mockTarget.installApp).toHaveBeenCalledWith("C:\\path\\to\\app.apk", {
        grantPermissions: true,
        reinstall: true,
        allowDowngrade: false,
      });
    });

    it("peep_stop_app force-stops the target package", async () => {
      const res = await tools["peep_stop_app"]({ app: "com.example.app" });
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(mockTarget.stopApp).toHaveBeenCalledWith("com.example.app");
    });

    it("peep_clear_app_data clears app data and cache", async () => {
      const res = await tools["peep_clear_app_data"]({ app: "com.example.app" });
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(mockTarget.clearAppData).toHaveBeenCalledWith("com.example.app");
    });

    it("peep_wake_and_unlock wakes screen and dismisses keyguard", async () => {
      const res = await tools["peep_wake_and_unlock"]({ pin: "1234" });
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.screenOn).toBe(true);
      expect(data.keyguardDismissed).toBe(true);
      expect(mockTarget.wakeAndUnlock).toHaveBeenCalledWith("1234");
    });

    it("peep_clipboard supports set, get, and paste", async () => {
      // Set
      const setRes = await tools["peep_clipboard"]({ action: "set", text: "secret password" });
      const setData = JSON.parse(setRes.content[0].text);
      expect(setData.status).toBe("SUCCESS");
      expect(setData.action).toBe("set");
      expect(mockTarget.setClipboard).toHaveBeenCalledWith("secret password");

      // Get
      const getRes = await tools["peep_clipboard"]({ action: "get" });
      const getData = JSON.parse(getRes.content[0].text);
      expect(getData.status).toBe("SUCCESS");
      expect(getData.text).toBe("sample clipboard text");

      // Paste
      const pasteRes = await tools["peep_clipboard"]({ action: "paste" });
      const pasteData = JSON.parse(pasteRes.content[0].text);
      expect(pasteData.status).toBe("SUCCESS");
      expect(mockTarget.pasteClipboard).toHaveBeenCalled();
    });

    it("peep_get_device_state returns foreground, resolution, and battery metrics", async () => {
      const res = await tools["peep_get_device_state"]({});
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.foreground.packageName).toBe("com.example.app");
      expect(data.battery.level).toBe(95);
      expect(data.battery.charging).toBe(true);
    });

    it("peep_open_deep_link dispatches URL to intent handler", async () => {
      const res = await tools["peep_open_deep_link"]({ url: "https://example.com/test", app: "com.android.chrome" });
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.url).toBe("https://example.com/test");
      expect(mockTarget.openDeepLink).toHaveBeenCalledWith("https://example.com/test", "com.android.chrome");
    });

    it("peep_manage_permissions grants, revokes, or lists permissions", async () => {
      const res = await tools["peep_manage_permissions"]({
        app: "com.example.app",
        action: "grant",
        permission: "POST_NOTIFICATIONS",
      });
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.app).toBe("com.example.app");
      expect(mockTarget.managePermissions).toHaveBeenCalledWith("grant", "com.example.app", "POST_NOTIFICATIONS");
    });

    it("peep_set_screen_orientation modifies screen rotation", async () => {
      const res = await tools["peep_set_screen_orientation"]({ orientation: "landscape" });
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.orientation).toBe("landscape");
      expect(mockTarget.setScreenOrientation).toHaveBeenCalledWith("landscape");
    });

    it("peep_manage_files handles file transfer operations", async () => {
      const res = await tools["peep_manage_files"]({
        action: "push",
        devicePath: "/sdcard/test.txt",
        hostPath: "C:\\local\\test.txt",
      });
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(mockTarget.manageFiles).toHaveBeenCalledWith("push", "/sdcard/test.txt", "C:\\local\\test.txt", true);
    });

    it("peep_list_apps returns list of installed applications", async () => {
      const res = await tools["peep_list_apps"]({ filter: "third_party", limit: 10 });
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.count).toBe(2);
      expect(mockTarget.listApps).toHaveBeenCalledWith("third_party", undefined, 10);
    });

    it("peep_browser_navigate routes through android target when chrome is available", async () => {
      const res = await tools["peep_browser_navigate"]({
        url: "https://google.com",
        platform: "android",
      });
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.method).toBe("android_chrome_intent");
      expect(mockTarget.openDeepLink).toHaveBeenCalledWith("https://google.com", "com.android.chrome");
    });

    it("peep_manage_permissions supports revoke and list actions", async () => {
      // Revoke
      await tools["peep_manage_permissions"]({
        app: "com.example.app",
        action: "revoke",
        permission: "CAMERA",
      });
      expect(mockTarget.managePermissions).toHaveBeenCalledWith("revoke", "com.example.app", "CAMERA");

      // List
      const listRes = await tools["peep_manage_permissions"]({
        app: "com.example.app",
        action: "list",
      });
      const listData = JSON.parse(listRes.content[0].text);
      expect(listData.status).toBe("SUCCESS");
      expect(listData.permissions).toEqual(["android.permission.CAMERA", "android.permission.RECORD_AUDIO"]);
    });

    it("peep_manage_files supports pull and delete actions", async () => {
      // Pull
      await tools["peep_manage_files"]({
        action: "pull",
        devicePath: "/sdcard/download.jpg",
        hostPath: "C:\\tmp\\download.jpg",
      });
      expect(mockTarget.manageFiles).toHaveBeenCalledWith("pull", "/sdcard/download.jpg", "C:\\tmp\\download.jpg", true);

      // Delete
      await tools["peep_manage_files"]({
        action: "delete",
        devicePath: "/sdcard/download.jpg",
      });
      expect(mockTarget.manageFiles).toHaveBeenCalledWith("delete", "/sdcard/download.jpg", undefined, true);
    });

    it("peep_find_and_tap with vision_only strategy bypasses semantic tree directly to VLM", async () => {
      mockProvider.groundElement = vi.fn().mockResolvedValue({
        found: true,
        thought: "Located using pure vision",
        point: { x: 500, y: 500 },
        confidence: 0.95,
      });

      const res = await tools["peep_find_and_tap"]({
        target: "Play Video Button",
        strategy: "vision_only",
        context: "Center of player card",
      });

      expect(mockTarget.findSemanticElement).not.toHaveBeenCalled();
      expect(mockProvider.groundElement).toHaveBeenCalledWith("Play Video Button (Center of player card)", "dummybase64");
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.method).toBe("tier2_local_vlm");
    });
  });

  describe("Root & LSPosed Developer Suite Tools", () => {
    it("peep_force_stop_process kills persistent apps and detached daemons", async () => {
      const res = await tools["peep_force_stop_process"]({
        target: "com.example.app",
        useRoot: true,
        killAllMatching: true,
      });
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.target).toBe("com.example.app");
      expect(data.killed).toBe(true);
      expect(mockTarget.forceStopProcess).toHaveBeenCalledWith("com.example.app", {
        useRoot: true,
        killAllMatching: true,
      });
    });

    it("peep_restart_app performs hot restart with crash watchdog monitoring", async () => {
      const res = await tools["peep_restart_app"]({
        app: "com.example.app",
        useRootKill: true,
        resetState: false,
        waitForLaunch: true,
      });
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.app).toBe("com.example.app");
      expect(data.totalTimeMs).toBe(250);
      expect(mockTarget.restartApp).toHaveBeenCalledWith({
        packageOrComponent: "com.example.app",
        useRootKill: true,
        resetState: false,
        waitForLaunch: true,
        extras: undefined,
      });
    });

    it("peep_restart_system_service performs instant Zygote and SystemUI hook reload", async () => {
      const res = await tools["peep_restart_system_service"]({
        service: "zygote",
      });
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.service).toBe("zygote");
      expect(data.executionTimeMs).toBe(120);
      expect(mockTarget.restartSystemService).toHaveBeenCalledWith("zygote");
    });

    it("peep_execute_root_command executes privileged root command and returns output", async () => {
      const res = await tools["peep_execute_root_command"]({
        command: "id",
        timeoutMs: 5000,
      });
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.stdout).toBe("uid=0(root) gid=0(root)");
      expect(mockTarget.executeRootCommand).toHaveBeenCalledWith("id", 5000);
    });

    it("peep_manage_selinux queries and toggles SELinux enforcement", async () => {
      const res = await tools["peep_manage_selinux"]({
        action: "permissive",
      });
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.mode).toBe("Permissive");
      expect(data.previousMode).toBe("Enforcing");
      expect(mockTarget.manageSelinux).toHaveBeenCalledWith("permissive");
    });

    it("peep_list_processes parses running processes with filter and limit", async () => {
      const res = await tools["peep_list_processes"]({
        filter: "example",
        limit: 10,
      });
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.count).toBe(2);
      expect(data.processes).toHaveLength(2);
      expect(mockTarget.listProcesses).toHaveBeenCalledWith("example", 10);
    });

    it("peep_set_component_enabled enables or disables application components", async () => {
      const res = await tools["peep_set_component_enabled"]({
        component: "com.example.app/.MainActivity",
        enabled: true,
        useRoot: true,
      });
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.component).toBe("com.example.app/.MainActivity");
      expect(data.enabled).toBe(true);
      expect(mockTarget.setComponentEnabled).toHaveBeenCalledWith("com.example.app/.MainActivity", true, true);
    });

    it("peep_system_properties gets and sets system properties", async () => {
      // Get
      const getRes = await tools["peep_system_properties"]({
        action: "get",
        name: "debug.test",
      });
      const getData = JSON.parse(getRes.content[0].text);
      expect(getData.status).toBe("SUCCESS");
      expect(getData.value).toBe("1");
      expect(mockTarget.getSystemProperty).toHaveBeenCalledWith("debug.test");

      // Set
      const setRes = await tools["peep_system_properties"]({
        action: "set",
        name: "debug.test",
        value: "1",
        useRoot: true,
      });
      const setData = JSON.parse(setRes.content[0].text);
      expect(setData.status).toBe("SUCCESS");
      expect(setData.name).toBe("debug.test");
      expect(mockTarget.setSystemProperty).toHaveBeenCalledWith("debug.test", "1", true);
    });
  });

  describe("Browser & Desktop Target Specific Tools", () => {
    let browserTools: Record<string, Function> = {};
    let mockBrowserTarget: BrowserTarget;

    let desktopTools: Record<string, Function> = {};
    let mockDesktopTarget: DesktopTarget;

    beforeEach(() => {
      browserTools = {};
      const browserServer = {
        tool: vi.fn((name: string, _desc: string, _schema: any, handler: Function) => {
          browserTools[name] = handler;
        }),
      } as unknown as McpServer;

      mockBrowserTarget = Object.assign(Object.create(BrowserTarget.prototype), {
        name: "browser",
        isReady: true,
        getDistilledDom: vi.fn().mockResolvedValue([
          { refId: "elem_1", tag: "button", text: "Login", selector: "button#login" },
          { refId: "elem_2", tag: "input", text: "", selector: "input#email" },
        ]),
        navigate: vi.fn().mockResolvedValue({
          status: 200,
          url: "https://example.com/login",
          title: "Login Page",
        }),
      });

      registerTools(browserServer, mockBrowserTarget, mockProvider, mapper);

      desktopTools = {};
      const desktopServer = {
        tool: vi.fn((name: string, _desc: string, _schema: any, handler: Function) => {
          desktopTools[name] = handler;
        }),
      } as unknown as McpServer;

      mockDesktopTarget = Object.assign(Object.create(DesktopTarget.prototype), {
        name: "desktop",
        isReady: true,
        listWindows: vi.fn().mockResolvedValue([
          { id: "1001", title: "Visual Studio Code", processName: "Code" },
          { id: "1002", title: "Terminal", processName: "wt" },
        ]),
        focusWindow: vi.fn().mockImplementation(async (title: string) => {
          return title.toLowerCase().includes("code");
        }),
        getDisplayMetrics: vi.fn().mockResolvedValue({ width: 1920, height: 1080, rotation: 0 }),
      });

      registerTools(desktopServer, mockDesktopTarget, mockProvider, mapper);
    });

    it("peep_browser_get_distilled_dom extracts landmark elements and saves tokens", async () => {
      const res = await browserTools["peep_browser_get_distilled_dom"]({
        selector: "form#loginForm",
        maxDepth: 4,
      });

      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.count).toBe(2);
      expect(data.elements[0].refId).toBe("elem_1");
      expect(data.cloudTokensSaved).toBeGreaterThan(0);
      expect(mockBrowserTarget.getDistilledDom).toHaveBeenCalledWith("form#loginForm", 4);
    });

    it("peep_browser_get_distilled_dom returns UNSUPPORTED_TARGET on non-browser targets", async () => {
      const res = await tools["peep_browser_get_distilled_dom"]({
        selector: "body",
      });

      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("UNSUPPORTED_TARGET");
      expect(data.target).toBe("android");
    });

    it("peep_browser_navigate interacts with BrowserTarget", async () => {
      const res = await browserTools["peep_browser_navigate"]({
        url: "https://example.com/login",
        waitForLoad: true,
        timeoutMs: 15000,
      });

      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.httpStatus).toBe(200);
      expect(data.url).toBe("https://example.com/login");
      expect(data.title).toBe("Login Page");
      expect(mockBrowserTarget.navigate).toHaveBeenCalledWith("https://example.com/login", true, 15000);
    });

    it("peep_browser_navigate returns UNSUPPORTED_TARGET on DesktopTarget", async () => {
      const res = await desktopTools["peep_browser_navigate"]({
        url: "https://example.com",
      });

      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("UNSUPPORTED_TARGET");
      expect(data.target).toBe("desktop");
    });

    it("peep_window_management executes list, focus, and get_metrics actions on DesktopTarget", async () => {
      // List
      const listRes = await desktopTools["peep_window_management"]({ action: "list" });
      const listData = JSON.parse(listRes.content[0].text);
      expect(listData.status).toBe("SUCCESS");
      expect(listData.count).toBe(2);
      expect(listData.windows[0].title).toBe("Visual Studio Code");

      // Focus found
      const focusFoundRes = await desktopTools["peep_window_management"]({ action: "focus", title: "Code" });
      const focusFoundData = JSON.parse(focusFoundRes.content[0].text);
      expect(focusFoundData.status).toBe("SUCCESS");
      expect(focusFoundData.focused).toBe(true);

      // Focus not found
      const focusMissingRes = await desktopTools["peep_window_management"]({ action: "focus", title: "NonExistent" });
      const focusMissingData = JSON.parse(focusMissingRes.content[0].text);
      expect(focusMissingData.status).toBe("NOT_FOUND");
      expect(focusMissingData.focused).toBe(false);

      // Focus without title throws Error
      await expect(desktopTools["peep_window_management"]({ action: "focus" })).rejects.toThrow(
        /title parameter required for focus action/
      );

      // Get metrics
      const metricsRes = await desktopTools["peep_window_management"]({ action: "get_metrics" });
      const metricsData = JSON.parse(metricsRes.content[0].text);
      expect(metricsData.status).toBe("SUCCESS");
      expect(metricsData.metrics.width).toBe(1920);
    });

    it("peep_window_management returns UNSUPPORTED_TARGET on non-desktop targets", async () => {
      const res = await tools["peep_window_management"]({ action: "list" });
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("UNSUPPORTED_TARGET");
      expect(data.target).toBe("android");
    });

    it("peep_get_device_state returns display metrics on DesktopTarget", async () => {
      const res = await desktopTools["peep_get_device_state"]({});
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe("SUCCESS");
      expect(data.platform).toBe("desktop");
      expect(data.display.width).toBe(1920);
    });

    it("returns UNSUPPORTED_TARGET for Android-only tools when called on DesktopTarget", async () => {
      const toolsToTest = [
        () => desktopTools["peep_install_app"]({ path: "test.apk" }),
        () => desktopTools["peep_stop_app"]({ app: "test.pkg" }),
        () => desktopTools["peep_clear_app_data"]({ app: "test.pkg" }),
        () => desktopTools["peep_wake_and_unlock"]({}),
        () => desktopTools["peep_clipboard"]({ action: "paste" }),
        () => desktopTools["peep_open_deep_link"]({ url: "https://test.com" }),
        () => desktopTools["peep_manage_permissions"]({ app: "test.pkg", action: "grant", permission: "CAMERA" }),
        () => desktopTools["peep_set_screen_orientation"]({ orientation: "portrait" }),
        () => desktopTools["peep_manage_files"]({ action: "delete", devicePath: "/test" }),
        () => desktopTools["peep_list_apps"]({}),
        () => desktopTools["peep_force_stop_process"]({ target: "test.pkg" }),
        () => desktopTools["peep_restart_app"]({ app: "test.pkg" }),
        () => desktopTools["peep_restart_system_service"]({ service: "zygote" }),
        () => desktopTools["peep_execute_root_command"]({ command: "id" }),
        () => desktopTools["peep_manage_selinux"]({ action: "get" }),
        () => desktopTools["peep_list_processes"]({}),
        () => desktopTools["peep_set_component_enabled"]({ component: "pkg/.Act", state: "enable" }),
        () => desktopTools["peep_system_properties"]({ action: "get", name: "prop" }),
      ];

      for (const runTool of toolsToTest) {
        const res = await runTool();
        const data = JSON.parse(res.content[0].text);
        expect(data.status).toBe("UNSUPPORTED_TARGET");
        expect(data.target).toBe("desktop");
      }
    });
  });
});
