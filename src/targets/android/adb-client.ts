import { spawn, execFile, ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { DisplayMetrics } from "../../core/coordinate-mapper.js";
import { logger } from "../../utils/logger.js";

const execFileAsync = promisify(execFile);

export interface AdbDevice {
  id: string;
  status: string;
  model?: string;
  product?: string;
}

export class AdbClient {
  private adbPath: string;
  private selectedDeviceId?: string;
  private activeProcesses = new Set<ChildProcess>();

  constructor(adbPath = "adb", deviceId?: string) {
    this.adbPath = adbPath;
    this.selectedDeviceId = deviceId;
  }

  getAdbPath(): string {
    return this.adbPath;
  }

  setDeviceId(deviceId: string): void {
    this.selectedDeviceId = deviceId;
  }

  getDeviceId(): string | undefined {
    return this.selectedDeviceId;
  }

  private getBaseArgs(): string[] {
    if (this.selectedDeviceId) {
      return ["-s", this.selectedDeviceId];
    }
    return [];
  }

  async listDevices(): Promise<AdbDevice[]> {
    try {
      const { stdout } = await execFileAsync(this.adbPath, ["devices", "-l"]);
      const lines = stdout.split(/\r?\n/);
      const devices: AdbDevice[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("List of devices") || trimmed.startsWith("*")) continue;

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
    } catch (err) {
      throw new Error(`Failed to list ADB devices: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async autoSelectDevice(): Promise<string> {
    if (this.selectedDeviceId) {
      return this.selectedDeviceId;
    }

    const devices = await this.listDevices();
    const online = devices.filter((d) => d.status === "device");

    if (online.length === 0) {
      throw new Error(
        "No online Android device/emulator found via ADB. Ensure your device is connected with USB Debugging enabled or start an emulator."
      );
    }

    this.selectedDeviceId = online[0].id;
    logger.debug(`Auto-selected ADB device: ${this.selectedDeviceId} (${online[0].model || "unknown"})`);
    return this.selectedDeviceId;
  }

  async shell(command: string | string[], timeoutMs = 15000): Promise<string> {
    await this.autoSelectDevice();
    const cmdArgs = Array.isArray(command) ? command : command.split(" ");
    const args = [...this.getBaseArgs(), "shell", ...cmdArgs];

    try {
      const { stdout } = await execFileAsync(this.adbPath, args, {
        maxBuffer: 10 * 1024 * 1024,
        timeout: timeoutMs,
      });
      return stdout;
    } catch (err) {
      throw new Error(`ADB shell error [${args.join(" ")}]: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async execRaw(args: string[], timeoutMs = 20000): Promise<Buffer> {
    await this.autoSelectDevice();
    const fullArgs = [...this.getBaseArgs(), ...args];

    return new Promise((resolve, reject) => {
      let settled = false;
      const proc = spawn(this.adbPath, fullArgs);
      this.activeProcesses.add(proc);

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.activeProcesses.delete(proc);
          try {
            proc.kill("SIGKILL");
          } catch {
            // ignore
          }
          reject(new Error(`ADB execRaw timed out after ${timeoutMs}ms [${fullArgs.join(" ")}]`));
        }
      }, timeoutMs);

      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];

      proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
      proc.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

      proc.on("close", (code) => {
        clearTimeout(timer);
        this.activeProcesses.delete(proc);
        if (settled) return;
        settled = true;

        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          const errMsg = Buffer.concat(errChunks).toString("utf-8");
          reject(new Error(`ADB process exited with code ${code}: ${errMsg}`));
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        this.activeProcesses.delete(proc);
        if (settled) return;
        settled = true;
        reject(err);
      });
    });
  }

  async getDisplayMetrics(): Promise<DisplayMetrics> {
    const sizeOutput = await this.shell(["wm", "size"]);
    // Output looks like:
    // Physical size: 1080x2400
    // Override size: 1080x2400 (if set)
    let width = 1080;
    let height = 2400;

    const overrideMatch = sizeOutput.match(/Override size:\s*(\d+)x(\d+)/i);
    const physicalMatch = sizeOutput.match(/Physical size:\s*(\d+)x(\d+)/i);

    if (overrideMatch) {
      width = parseInt(overrideMatch[1], 10);
      height = parseInt(overrideMatch[2], 10);
    } else if (physicalMatch) {
      width = parseInt(physicalMatch[1], 10);
      height = parseInt(physicalMatch[2], 10);
    }

    // Get orientation
    let rotation: 0 | 90 | 180 | 270 = 0;
    try {
      const rotOutput = await this.shell(["dumpsys", "display"]);
      const rotMatch =
        rotOutput.match(/(?:mCurrentRotation|mRotation|mDisplayRotation)=(?:ROTATION_)?(\d+)/i) ||
        rotOutput.match(/\bROTATION_(0|90|180|270)\b/i);
      if (rotMatch) {
        const val = parseInt(rotMatch[1], 10);
        if (val === 1 || val === 90) rotation = 90;
        else if (val === 2 || val === 180) rotation = 180;
        else if (val === 3 || val === 270) rotation = 270;
      }
    } catch {
      // default 0
    }

    return { width, height, rotation };
  }

  async close(): Promise<void> {
    for (const proc of this.activeProcesses) {
      try {
        proc.kill("SIGTERM");
      } catch {
        // ignore
      }
    }
    this.activeProcesses.clear();
  }
}
