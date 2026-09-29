import { AdbClient } from "./adb-client.js";
import { ScreenFrame } from "../base.js";

export class ScreenCapture {
  private adb: AdbClient;

  constructor(adb: AdbClient) {
    this.adb = adb;
  }

  /**
   * Captures screen buffer via ADB exec-out screencap -p.
   * Extracts PNG width and height directly from the IHDR chunk without native dependencies.
   */
  async capture(): Promise<ScreenFrame> {
    const buffer = await this.adb.execRaw(["exec-out", "screencap", "-p"]);

    if (buffer.length < 24) {
      throw new Error(`Invalid screencap buffer returned by ADB: only ${buffer.length} bytes.`);
    }

    // Verify PNG signature: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    if (
      buffer[0] !== 0x89 ||
      buffer[1] !== 0x50 ||
      buffer[2] !== 0x4e ||
      buffer[3] !== 0x47
    ) {
      // Sometimes ADB on Windows might have CRLF issues or return an error message
      const text = buffer.slice(0, 100).toString("utf-8");
      throw new Error(`Screencap did not return valid PNG data. Header: ${text}`);
    }

    // Extract width and height from PNG IHDR chunk (bytes 16-19 and 20-23)
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);

    const base64 = buffer.toString("base64");

    return {
      buffer,
      base64,
      width,
      height,
    };
  }
}
