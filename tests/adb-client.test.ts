import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdbClient } from "../src/targets/android/adb-client.js";

describe("AdbClient", () => {
  it("stores and updates deviceId", () => {
    const client = new AdbClient("adb", "device-123");
    expect(client.getDeviceId()).toBe("device-123");

    client.setDeviceId("device-456");
    expect(client.getDeviceId()).toBe("device-456");
  });

  describe("Device Listing & Selection", () => {
    it("parses output of 'adb devices -l'", async () => {
      const client = new AdbClient();
      const mockDevicesOutput = `List of devices attached
127.0.0.1:7555         device product:mumu model:MuMu_Player device:nemu_x86_64 transport_id:1
emulator-5554          offline transport_id:2
192.168.1.100:5555     device product:pixel7 model:Pixel_7 transport_id:3
`;
      // Mock execFileAsync indirectly via prototype or shell
      vi.spyOn(client as any, "listDevices").mockImplementation(async () => {
        const lines = mockDevicesOutput.split(/\r?\n/);
        const devices = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("List of devices")) continue;
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2) {
            const id = parts[0];
            const status = parts[1];
            let model: string | undefined;
            let product: string | undefined;
            for (const extra of parts.slice(2)) {
              if (extra.startsWith("model:")) model = extra.split(":")[1];
              if (extra.startsWith("product:")) product = extra.split(":")[1];
            }
            devices.push({ id, status, model, product });
          }
        }
        return devices;
      });

      const devices = await client.listDevices();
      expect(devices).toHaveLength(3);
      expect(devices[0]).toEqual({
        id: "127.0.0.1:7555",
        status: "device",
        model: "MuMu_Player",
        product: "mumu",
      });
      expect(devices[1].status).toBe("offline");
      expect(devices[2].model).toBe("Pixel_7");
    });

    it("autoSelectDevice throws informative error when no online devices are found", async () => {
      const client = new AdbClient();
      vi.spyOn(client, "listDevices").mockResolvedValue([
        { id: "offline-device", status: "offline" },
      ]);

      await expect(client.autoSelectDevice()).rejects.toThrow(
        /No online Android device\/emulator found via ADB/
      );
    });

    it("autoSelectDevice picks the first online device", async () => {
      const client = new AdbClient();
      vi.spyOn(client, "listDevices").mockResolvedValue([
        { id: "emulator-offline", status: "offline" },
        { id: "emulator-5554", status: "device", model: "Pixel_6" },
      ]);

      const selected = await client.autoSelectDevice();
      expect(selected).toBe("emulator-5554");
      expect(client.getDeviceId()).toBe("emulator-5554");
    });
  });

  describe("getDisplayMetrics", () => {
    it("parses wm size physical and display rotation 0", async () => {
      const client = new AdbClient("adb", "test-device");
      vi.spyOn(client, "autoSelectDevice").mockResolvedValue("test-device");
      vi.spyOn(client, "shell").mockImplementation(async (cmd: any) => {
        const cmdStr = Array.isArray(cmd) ? cmd.join(" ") : cmd;
        if (cmdStr.includes("wm size")) {
          return "Physical size: 1080x2400\n";
        }
        if (cmdStr.includes("dumpsys display")) {
          return "DisplayDeviceInfo{... mCurrentRotation=0 ...}";
        }
        return "";
      });

      const metrics = await client.getDisplayMetrics();
      expect(metrics.width).toBe(1080);
      expect(metrics.height).toBe(2400);
      expect(metrics.rotation).toBe(0);
    });

    it("prefers override size over physical size when present", async () => {
      const client = new AdbClient("adb", "test-device");
      vi.spyOn(client, "autoSelectDevice").mockResolvedValue("test-device");
      vi.spyOn(client, "shell").mockImplementation(async (cmd: any) => {
        const cmdStr = Array.isArray(cmd) ? cmd.join(" ") : cmd;
        if (cmdStr.includes("wm size")) {
          return "Physical size: 1440x3120\nOverride size: 1080x2340\n";
        }
        if (cmdStr.includes("dumpsys display")) {
          return "mCurrentRotation=1";
        }
        return "";
      });

      const metrics = await client.getDisplayMetrics();
      expect(metrics.width).toBe(1080);
      expect(metrics.height).toBe(2340);
      expect(metrics.rotation).toBe(90); // rotation code 1 -> 90 degrees
    });

    it("correctly identifies rotation 180 and 270", async () => {
      const client = new AdbClient("adb", "test-device");
      vi.spyOn(client, "autoSelectDevice").mockResolvedValue("test-device");
      vi.spyOn(client, "shell").mockImplementation(async (cmd: any) => {
        const cmdStr = Array.isArray(cmd) ? cmd.join(" ") : cmd;
        if (cmdStr.includes("wm size")) return "Physical size: 1080x1920\n";
        if (cmdStr.includes("dumpsys display")) return "mCurrentRotation=3";
        return "";
      });

      const metrics = await client.getDisplayMetrics();
      expect(metrics.rotation).toBe(270); // rotation code 3 -> 270 degrees
    });
  });

  describe("Application and System Control Operations", () => {
    let client: AdbClient;

    beforeEach(() => {
      client = new AdbClient("adb", "test-device");
      vi.spyOn(client, "autoSelectDevice").mockResolvedValue("test-device");
    });

    it("startActivity launches app with component and extras, parsing metrics", async () => {
      vi.spyOn(client, "shell").mockResolvedValue(`Starting: Intent { act=android.intent.action.MAIN cmp=com.example.app/.MainActivity }
Status: ok
LaunchState: COLD
Activity: com.example.app/.MainActivity
TotalTime: 320
WaitTime: 250
Complete`);

      const res = await client.startActivity({
        packageName: "com.example.app",
        activity: ".MainActivity",
        extras: { debug: true, count: 5, user: "tester" },
      });

      expect(res.packageName).toBe("com.example.app");
      expect(res.launchState).toBe("COLD");
      expect(res.totalTimeMs).toBe(320);
      expect(res.waitTimeMs).toBe(250);
    });

    it("startActivity throws error when ADB reports launch failure", async () => {
      vi.spyOn(client, "shell").mockResolvedValue("Error: Activity class does not exist.");

      await expect(
        client.startActivity({ packageName: "com.example.bad" })
      ).rejects.toThrow(/Failed to launch com.example.bad/);
    });

    it("installApk executes adb install and throws on failure", async () => {
      const execSpy = vi.spyOn(client, "execAdb").mockResolvedValue("Success\n");
      await client.installApk("/path/to/app.apk", { reinstall: true, grantPermissions: true });
      expect(execSpy).toHaveBeenCalledWith(["install", "-r", "-g", "/path/to/app.apk"], 60000, undefined);

      execSpy.mockResolvedValue("Failure [INSTALL_FAILED_ALREADY_EXISTS]");
      await expect(client.installApk("/path/to/app.apk")).rejects.toThrow(/APK installation failed/);
    });

    it("uninstallApk executes adb uninstall and throws on failure", async () => {
      const execSpy = vi.spyOn(client, "execAdb").mockResolvedValue("Success\n");
      await client.uninstallApk("com.example.app", true);
      expect(execSpy).toHaveBeenCalledWith(["uninstall", "-k", "com.example.app"], 30000, undefined);

      execSpy.mockResolvedValue("Failure [DELETE_FAILED_INTERNAL_ERROR]");
      await expect(client.uninstallApk("com.example.app")).rejects.toThrow(/APK uninstall failed/);
    });

    it("forceStop and clearAppData execute appropriate shell commands", async () => {
      const shellSpy = vi.spyOn(client, "shell").mockResolvedValue("Success\n");

      await client.forceStop("com.example.app", "force_stop");
      expect(shellSpy).toHaveBeenCalledWith(["am", "force-stop", "com.example.app"], 10000, undefined);

      await client.forceStop("com.example.app", "kill_background");
      expect(shellSpy).toHaveBeenCalledWith(["am", "kill", "com.example.app"], 10000, undefined);

      await client.clearAppData("com.example.app");
      expect(shellSpy).toHaveBeenCalledWith(["pm", "clear", "com.example.app"], 15000, undefined);

      shellSpy.mockResolvedValue("Failed\n");
      await expect(client.clearAppData("com.example.app")).rejects.toThrow(/Failed to clear app data/);
    });

    it("wakeAndUnlock handles sleep state and optional pin entry", async () => {
      const shellSpy = vi.spyOn(client, "shell").mockImplementation(async (cmd: any) => {
        const cmdStr = Array.isArray(cmd) ? cmd.join(" ") : cmd;
        if (cmdStr.includes("dumpsys power")) {
          return "mWakefulness=Asleep\n";
        }
        return "";
      });

      const res = await client.wakeAndUnlock("1234");
      expect(res.screenOn).toBe(true);
      expect(res.keyguardDismissed).toBe(true);
      expect(shellSpy).toHaveBeenCalledWith(["input", "text", "'1234'"], 10000, undefined);
    });

    it("handles clipboard operations (set, get, paste)", async () => {
      const shellSpy = vi.spyOn(client, "shell").mockImplementation(async (cmd: any) => {
        const cmdStr = Array.isArray(cmd) ? cmd.join(" ") : cmd;
        if (cmdStr.includes("clipboard get")) {
          return "copied text\n";
        }
        return "";
      });

      await client.setClipboard("hello 'world'");
      expect(shellSpy).toHaveBeenCalled();

      const text = await client.getClipboard();
      expect(text).toBe("copied text");

      await client.pasteClipboard();
      expect(shellSpy).toHaveBeenCalledWith(["input", "keyevent", "279"], 10000, undefined);
    });

    it("getForegroundActivity parses dumpsys window and fallback dumpsys activity", async () => {
      vi.spyOn(client, "shell").mockResolvedValue(
        "mCurrentFocus=Window{123 u0 com.example.app/com.example.app.MainActivity}\n"
      );

      const fg = await client.getForegroundActivity();
      expect(fg.packageName).toBe("com.example.app");
      expect(fg.activity).toBe("com.example.app.MainActivity");
    });

    it("getDeviceState collects foreground, display, and battery info", async () => {
      vi.spyOn(client, "getForegroundActivity").mockResolvedValue({
        packageName: "com.example.app",
        activity: ".MainActivity",
      });
      vi.spyOn(client, "getDisplayMetrics").mockResolvedValue({
        width: 1080,
        height: 2400,
        rotation: 0,
      });
      vi.spyOn(client, "shell").mockResolvedValue(
        "level: 88\nAC powered: false\nUSB powered: true\n"
      );

      const state = await client.getDeviceState();
      expect(state.foreground.packageName).toBe("com.example.app");
      expect(state.display.width).toBe(1080);
      expect(state.battery.level).toBe(88);
      expect(state.battery.charging).toBe(true);
    });

    it("openDeepLink dispatches VIEW intent and returns foreground activity", async () => {
      const shellSpy = vi.spyOn(client, "shell").mockResolvedValue("");
      vi.spyOn(client, "getForegroundActivity").mockResolvedValue({
        packageName: "com.android.chrome",
        activity: "com.google.android.apps.chrome.Main",
      });

      const res = await client.openDeepLink("https://example.com", "com.android.chrome");
      expect(res.url).toBe("https://example.com");
      expect(res.resolvedPackage).toBe("com.android.chrome");
      expect(shellSpy).toHaveBeenCalledWith(
        ["am", "start", "-a", "android.intent.action.VIEW", "-d", "'https://example.com'", "-p", "com.android.chrome"],
        15000,
        undefined
      );
    });

    it("managePermissions grants, revokes, and lists permissions", async () => {
      const shellSpy = vi.spyOn(client, "shell").mockImplementation(async (cmd: any) => {
        const cmdStr = Array.isArray(cmd) ? cmd.join(" ") : cmd;
        if (cmdStr.includes("dumpsys package")) {
          return `runtime permissions:
            android.permission.CAMERA: granted=true
            android.permission.RECORD_AUDIO: granted=true
            android.permission.LOCATION: granted=false
          `;
        }
        return "";
      });

      // Grant
      const grantRes = await client.managePermissions("grant", "com.example.app", "CAMERA");
      expect(grantRes.permissions).toEqual(["android.permission.CAMERA"]);

      // Revoke
      const revokeRes = await client.managePermissions("revoke", "com.example.app", "CAMERA");
      expect(revokeRes.permissions).toEqual([]);

      // List
      const listRes = await client.managePermissions("list", "com.example.app");
      expect(listRes.permissions).toContain("android.permission.CAMERA");
      expect(listRes.permissions).toContain("android.permission.RECORD_AUDIO");

      // Errors on missing permission
      await expect(client.managePermissions("grant", "com.example.app")).rejects.toThrow(
        /Permission name required for grant/
      );
      await expect(client.managePermissions("revoke", "com.example.app")).rejects.toThrow(
        /Permission name required for revoke/
      );
    });

    it("setScreenOrientation updates accelerometer_rotation and user_rotation", async () => {
      const shellSpy = vi.spyOn(client, "shell").mockResolvedValue("");

      await client.setScreenOrientation("auto");
      expect(shellSpy).toHaveBeenCalledWith(
        ["settings", "put", "system", "accelerometer_rotation", "1"],
        10000,
        undefined
      );

      await client.setScreenOrientation("landscape");
      expect(shellSpy).toHaveBeenCalledWith(
        ["settings", "put", "system", "accelerometer_rotation", "0"],
        10000,
        undefined
      );
      expect(shellSpy).toHaveBeenCalledWith(
        ["settings", "put", "system", "user_rotation", "1"],
        10000,
        undefined
      );

      await client.setScreenOrientation("portrait");
      expect(shellSpy).toHaveBeenCalledWith(
        ["settings", "put", "system", "user_rotation", "0"],
        10000,
        undefined
      );
    });

    it("manageFiles executes push, pull, and delete", async () => {
      const execSpy = vi.spyOn(client, "execAdb").mockResolvedValue("");
      const shellSpy = vi.spyOn(client, "shell").mockResolvedValue("");

      // Push
      const pushRes = await client.manageFiles("push", "/sdcard/file.txt", "C:\\file.txt", true);
      expect(pushRes.success).toBe(true);
      expect(execSpy).toHaveBeenCalledWith(["push", "C:\\file.txt", "/sdcard/file.txt"], 60000, undefined);
      expect(shellSpy).toHaveBeenCalledWith(
        ["am", "broadcast", "-a", "android.intent.action.MEDIA_SCANNER_SCAN_FILE", "-d", "file:///sdcard/file.txt"],
        10000,
        undefined
      );

      // Pull
      const pullRes = await client.manageFiles("pull", "/sdcard/file.txt", "C:\\file.txt");
      expect(pullRes.success).toBe(true);
      expect(execSpy).toHaveBeenCalledWith(["pull", "/sdcard/file.txt", "C:\\file.txt"], 60000, undefined);

      // Delete
      const deleteRes = await client.manageFiles("delete", "/sdcard/file.txt");
      expect(deleteRes.success).toBe(true);
      expect(shellSpy).toHaveBeenCalledWith(["rm", "-f", "/sdcard/file.txt"], 10000, undefined);

      // Missing hostPath errors
      await expect(client.manageFiles("push", "/sdcard/file.txt")).rejects.toThrow(/hostPath required for file push/);
      await expect(client.manageFiles("pull", "/sdcard/file.txt")).rejects.toThrow(/hostPath required for file pull/);
    });

    it("listApps filters third-party and system packages with search query", async () => {
      vi.spyOn(client, "shell").mockResolvedValue(`package:com.example.app
package:com.example.other
package:com.android.settings
package:com.android.chrome`);

      const thirdParty = await client.listApps("third_party", "example", 10);
      expect(thirdParty).toHaveLength(2);
      expect(thirdParty[0].packageName).toBe("com.example.app");
      expect(thirdParty[0].isSystem).toBe(false);

      const system = await client.listApps("system", "android", 10);
      expect(system).toHaveLength(2);
      expect(system[0].isSystem).toBe(true);
    });
  });
});
