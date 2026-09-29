import { describe, it, expect, vi } from "vitest";
import { ScreenCapture } from "../src/targets/android/screencap.js";
import { AdbClient } from "../src/targets/android/adb-client.js";

describe("ScreenCapture", () => {
  const createMockAdb = (buffer: Buffer) => {
    return {
      execRaw: vi.fn().mockResolvedValue(buffer),
    } as unknown as AdbClient;
  };

  it("extracts width, height, and base64 from a valid PNG buffer", async () => {
    // Construct a minimal valid PNG header with IHDR chunk
    // Bytes 0-7: PNG signature 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A
    // Bytes 8-11: IHDR chunk length (13)
    // Bytes 12-15: "IHDR"
    // Bytes 16-19: width (1080)
    // Bytes 20-23: height (2400)
    const buf = Buffer.alloc(32);
    buf[0] = 0x89;
    buf[1] = 0x50; // 'P'
    buf[2] = 0x4e; // 'N'
    buf[3] = 0x47; // 'G'
    buf[4] = 0x0d;
    buf[5] = 0x0a;
    buf[6] = 0x1a;
    buf[7] = 0x0a;

    buf.writeUInt32BE(1080, 16);
    buf.writeUInt32BE(2400, 20);

    const capture = new ScreenCapture(createMockAdb(buf));
    const result = await capture.capture();

    expect(result.width).toBe(1080);
    expect(result.height).toBe(2400);
    expect(result.buffer).toEqual(buf);
    expect(result.base64).toBe(buf.toString("base64"));
  });

  it("throws error if buffer is shorter than 24 bytes", async () => {
    const tinyBuffer = Buffer.alloc(10);
    const capture = new ScreenCapture(createMockAdb(tinyBuffer));

    await expect(capture.capture()).rejects.toThrow(
      /Invalid screencap buffer returned by ADB: only 10 bytes/
    );
  });

  it("throws error if PNG signature does not match", async () => {
    // ADB returned an error message in text instead of PNG binary
    const errorBuffer = Buffer.from("error: device offline (screencap failed to run)");
    const capture = new ScreenCapture(createMockAdb(errorBuffer));

    await expect(capture.capture()).rejects.toThrow(
      /Screencap did not return valid PNG data/
    );
  });
});
