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
});
