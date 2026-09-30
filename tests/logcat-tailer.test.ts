import { describe, it, expect, vi } from "vitest";
import { LogcatTailer } from "../src/targets/android/logcat-tailer.js";
import { AdbClient } from "../src/targets/android/adb-client.js";

describe("LogcatTailer & Log Filtering Regexes", () => {
  const createMockAdb = () => {
    return {
      autoSelectDevice: vi.fn().mockResolvedValue("emulator-5554"),
      getDeviceId: vi.fn().mockReturnValue("emulator-5554"),
      shell: vi.fn().mockResolvedValue(""),
    } as unknown as AdbClient;
  };

  describe("Noise Patterns Filtering", () => {
    it("filters out common framework noise patterns when filterNoise is true", () => {
      const tailer = new LogcatTailer(createMockAdb(), 100, true);
      const processLine = (tailer as unknown as { processLine: (l: string) => void }).processLine.bind(tailer);

      const noiseLines = [
        "09-29 22:00:01.123 1234 5678 I Choreographer: Skipped 42 frames! The application may be doing too much work on its main thread.",
        "09-29 22:00:01.124 1234 5678 D dalvikvm: GC_CONCURRENT freed 2048K, 20% free",
        "09-29 22:00:01.125 1234 5678 D dalvikvm: GC_FOR_ALLOC freed 1024K, 15% free",
        "09-29 22:00:01.126 1234 5678 D dalvikvm: GC_EXPLICIT freed 512K, 10% free",
        "09-29 22:00:01.127 1234 5678 D ViewRootImpl[MainActivity]: ViewPostIme pointer 0",
        "09-29 22:00:01.128 1234 5678 D InputMethodManager: HSI mode - hideStatusIcon",
        "09-29 22:00:01.129 1234 5678 D CompatibilityChangeReporter: Compat change id reported: 12345678",
        "09-29 22:00:01.130 1234 5678 D SurfaceView: surfaceDestroyed callback",
        "09-29 22:00:01.131 1234 5678 D OpenGLRenderer: End frame 1024 in 12ms",
        "09-29 22:00:01.132 1234 5678 I chatty : uid=1000 expire 4 lines",
        "09-29 22:00:01.133 1234 5678 D hwcomposer: vsync period set to 16666666",
        "09-29 22:00:01.134 1234 5678 D gralloc: GraphicBuffer allocated 1080x2400",
        "09-29 22:00:01.135 1234 5678 D BatteryStats: noteStartSensor 1000 1",
      ];

      for (const line of noiseLines) {
        processLine(line);
      }

      // All noise should be discarded
      expect(tailer.getRecentLogs()).toHaveLength(0);
    });

    it("retains noisy lines if filterNoise is disabled", () => {
      const tailer = new LogcatTailer(createMockAdb(), 100, false);
      const processLine = (tailer as unknown as { processLine: (l: string) => void }).processLine.bind(tailer);

      processLine("I Choreographer: Skipped 15 frames");
      processLine("D ViewRootImpl: updateView");

      expect(tailer.getRecentLogs()).toHaveLength(2);
    });

    it("retains valid application log lines", () => {
      const tailer = new LogcatTailer(createMockAdb(), 100, true);
      const processLine = (tailer as unknown as { processLine: (l: string) => void }).processLine.bind(tailer);

      processLine("I MyApp: User tapped checkout button");
      processLine("D MyApp: HTTP POST https://api.example.com/checkout returned 200 OK");
      processLine("W MyApp: Slow network response detected: 1200ms");

      const logs = tailer.getRecentLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0]).toBe("I MyApp: User tapped checkout button");
      expect(logs[1]).toBe("D MyApp: HTTP POST https://api.example.com/checkout returned 200 OK");
      expect(logs[2]).toBe("W MyApp: Slow network response detected: 1200ms");
    });
  });

  describe("Crash Patterns & Watchdog", () => {
    const crashTestCases = [
      "FATAL EXCEPTION: main",
      "E AndroidRuntime: FATAL EXCEPTION in thread main",
      "ANR in com.example.app (com.example.app/.MainActivity)",
      "Fatal signal 11 (SIGSEGV), code 1 (SEGV_MAPERR), fault addr 0x0",
      "SIGSEGV at 0x7f001234",
      "java.lang.NullPointerException: Attempt to invoke virtual method on a null object reference",
      "java.lang.IllegalArgumentException: Invalid view id",
      "Process com.example.app has died",
    ];

    for (const crashLine of crashTestCases) {
      it(`detects crash pattern: "${crashLine.substring(0, 30)}..."`, () => {
        const tailer = new LogcatTailer(createMockAdb(), 100, true);
        const processLine = (tailer as unknown as { processLine: (l: string) => void }).processLine.bind(tailer);

        expect(tailer.checkWatchdog().hasCrashed).toBe(false);

        processLine(crashLine);

        const status = tailer.checkWatchdog();
        expect(status.hasCrashed).toBe(true);
        expect(status.reason).toBe(crashLine);
      });
    }

    it("resets watchdog state correctly", () => {
      const tailer = new LogcatTailer(createMockAdb(), 100, true);
      const processLine = (tailer as unknown as { processLine: (l: string) => void }).processLine.bind(tailer);

      processLine("FATAL EXCEPTION: main");
      expect(tailer.checkWatchdog().hasCrashed).toBe(true);

      tailer.resetWatchdog();
      expect(tailer.checkWatchdog().hasCrashed).toBe(false);
      expect(tailer.checkWatchdog().reason).toBeUndefined();
    });
  });

  describe("Ring Buffer & Filtering", () => {
    it("ignores empty or whitespace-only lines", () => {
      const tailer = new LogcatTailer(createMockAdb(), 100, true);
      const processLine = (tailer as unknown as { processLine: (l: string) => void }).processLine.bind(tailer);

      processLine("");
      processLine("   ");
      processLine("\t\r\n");

      expect(tailer.getRecentLogs()).toHaveLength(0);
    });

    it("caps buffer capacity to ringBufferSize and shifts oldest lines", () => {
      const bufferSize = 5;
      const tailer = new LogcatTailer(createMockAdb(), bufferSize, true);
      const processLine = (tailer as unknown as { processLine: (l: string) => void }).processLine.bind(tailer);

      for (let i = 1; i <= 10; i++) {
        processLine(`App log line ${i}`);
      }

      const logs = tailer.getRecentLogs();
      expect(logs).toHaveLength(5);
      expect(logs[0]).toBe("App log line 6");
      expect(logs[4]).toBe("App log line 10");
    });

    it("filters logs with regex filter pattern case-insensitively", () => {
      const tailer = new LogcatTailer(createMockAdb(), 100, true);
      const processLine = (tailer as unknown as { processLine: (l: string) => void }).processLine.bind(tailer);

      processLine("I Network: Fetching user profile");
      processLine("I Database: Query executed in 4ms");
      processLine("E Network: Timeout connecting to host");
      processLine("I UI: Rendered profile screen");

      const networkLogs = tailer.getRecentLogs("network");
      expect(networkLogs).toHaveLength(2);
      expect(networkLogs[0]).toBe("I Network: Fetching user profile");
      expect(networkLogs[1]).toBe("E Network: Timeout connecting to host");
    });

    it("slices logs to the specified limit", () => {
      const tailer = new LogcatTailer(createMockAdb(), 100, true);
      const processLine = (tailer as unknown as { processLine: (l: string) => void }).processLine.bind(tailer);

      for (let i = 1; i <= 20; i++) {
        processLine(`Message ${i}`);
      }

      const recent = tailer.getRecentLogs(undefined, 3);
      expect(recent).toHaveLength(3);
      expect(recent).toEqual(["Message 18", "Message 19", "Message 20"]);
    });

    it("gracefully stops without error when not running or when running", () => {
      const tailer = new LogcatTailer(createMockAdb(), 100, true);
      expect(() => tailer.stop()).not.toThrow();

      // Mock running process
      const mockProc = { kill: vi.fn() };
      (tailer as unknown as { proc: typeof mockProc; isStarted: boolean }).proc = mockProc;
      (tailer as unknown as { proc: typeof mockProc; isStarted: boolean }).isStarted = true;

      tailer.stop();
      expect(mockProc.kill).toHaveBeenCalled();
    });

    it("suppresses non-fatal levels (V/D/I/W) even if they contain exception class names", () => {
      const tailer = new LogcatTailer(createMockAdb(), 100, true);
      const processLine = (tailer as unknown as { processLine: (l: string) => void }).processLine.bind(tailer);

      // Non-fatal debug and info logs with caught exceptions
      processLine("09-30 11:00:00.000 100 200 D/NetworkHandler: Caught java.lang.NullPointerException gracefully");
      processLine("09-30 11:00:00.001 100 200 I/AuthService: java.lang.IllegalArgumentException handled in retry loop");
      processLine("09-30 11:00:00.002 100 200 W/DiskCache: java.lang.RuntimeException recovered");

      expect(tailer.checkWatchdog().hasCrashed).toBe(false);

      // But an Error-level log (E/) with exception MUST trigger crash
      processLine("09-30 11:00:00.003 100 200 E/AndroidRuntime: java.lang.NullPointerException: Null pointer at line 42");
      expect(tailer.checkWatchdog().hasCrashed).toBe(true);
      expect(tailer.checkWatchdog().reason).toContain("NullPointerException");
    });

    it("triggers watchdog on non-fatal levels if line explicitly contains FATAL or died", () => {
      const tailer = new LogcatTailer(createMockAdb(), 100, true);
      const processLine = (tailer as unknown as { processLine: (l: string) => void }).processLine.bind(tailer);

      // D/ level but has FATAL
      processLine("09-30 11:00:00.000 100 200 D/Worker: FATAL EXCEPTION in thread worker-1");
      expect(tailer.checkWatchdog().hasCrashed).toBe(true);

      tailer.resetWatchdog();
      // W/ level but has died
      processLine("09-30 11:00:00.001 100 200 W/ActivityManager: Process com.example.app has died");
      expect(tailer.checkWatchdog().hasCrashed).toBe(true);
    });

    it("handles empty or complex regex filtering gracefully", () => {
      const tailer = new LogcatTailer(createMockAdb(), 100, true);
      const processLine = (tailer as unknown as { processLine: (l: string) => void }).processLine.bind(tailer);

      processLine("I/UserAuth: Token refreshed for user 101");
      processLine("E/UserAuth[Worker]: Connection timeout to auth.server.com:443");
      processLine("D/Database: Query returned 15 rows");

      // Empty string returns all logs
      const all = tailer.getRecentLogs("");
      expect(all).toHaveLength(3);

      // Complex regex with brackets and wildcard
      const filtered = tailer.getRecentLogs("UserAuth\\[Worker\\].*timeout");
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toContain("auth.server.com:443");

      // Limit 1 returns only the latest line
      const singleLimit = tailer.getRecentLogs(undefined, 1);
      expect(singleLimit).toHaveLength(1);
      expect(singleLimit[0]).toContain("Database");
    });

    it("handles invalid regex gracefully without throwing syntax error", () => {
      const tailer = new LogcatTailer(createMockAdb(), 100, true);
      const processLine = (tailer as unknown as { processLine: (l: string) => void }).processLine.bind(tailer);

      processLine("I/UserAuth: Token refreshed for user 101");
      processLine("E/UserAuth[Worker]: Connection timeout to auth.server.com:443");

      // Invalid regex like unclosed bracket [Worker or dangling *
      const res1 = tailer.getRecentLogs("*");
      expect(res1).toHaveLength(0);

      const res2 = tailer.getRecentLogs("[Worker");
      expect(res2).toHaveLength(1);
      expect(res2[0]).toContain("auth.server.com:443");
    });
  });
});
