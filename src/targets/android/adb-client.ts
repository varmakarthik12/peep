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

export interface AdbClientOptions {
  adbPath?: string;
  deviceId?: string;
  host?: string; // Remote ADB server host (-H <host>)
  port?: number; // Remote ADB server port (-P <port>)
  connectAddress?: string; // Remote device TCP address to connect (e.g. 192.168.1.100:5555)
}

export class AdbClient {
  private adbPath: string;
  private selectedDeviceId?: string;
  private host?: string;
  private port?: number;
  private connectAddress?: string;
  private activeProcesses = new Set<ChildProcess>();

  constructor(options: AdbClientOptions | string = "adb", deviceId?: string) {
    if (typeof options === "string") {
      this.adbPath = options;
      this.selectedDeviceId = deviceId;
    } else {
      this.adbPath = options.adbPath || "adb";
      this.selectedDeviceId = options.deviceId;
      this.host = options.host;
      this.port = options.port;
      this.connectAddress = options.connectAddress;
    }
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
    const args: string[] = [];
    if (this.host) {
      args.push("-H", this.host);
    }
    if (this.port) {
      args.push("-P", String(this.port));
    }
    if (this.selectedDeviceId) {
      args.push("-s", this.selectedDeviceId);
    }
    return args;
  }

  /**
   * Connects to a remote network device via TCP/IP if connectAddress is specified.
   */
  async connectRemoteDevice(): Promise<void> {
    if (!this.connectAddress) return;

    const baseArgs: string[] = [];
    if (this.host) baseArgs.push("-H", this.host);
    if (this.port) baseArgs.push("-P", String(this.port));

    try {
      logger.info(`Connecting to remote ADB device at ${this.connectAddress}...`);
      const { stdout } = await execFileAsync(this.adbPath, [...baseArgs, "connect", this.connectAddress], {
        timeout: 10000,
      });
      logger.debug(`ADB connect output: ${stdout.trim()}`);
      if (!this.selectedDeviceId) {
        this.selectedDeviceId = this.connectAddress;
      }
    } catch (err) {
      logger.warn(`Failed to connect to remote device ${this.connectAddress}:`, err);
    }
  }

  async listDevices(): Promise<AdbDevice[]> {
    if (this.connectAddress && !this.selectedDeviceId) {
      await this.connectRemoteDevice();
    }

    try {
      const baseArgs: string[] = [];
      if (this.host) baseArgs.push("-H", this.host);
      if (this.port) baseArgs.push("-P", String(this.port));

      const { stdout } = await execFileAsync(this.adbPath, [...baseArgs, "devices", "-l"], {
        timeout: 10000,
      });
      const lines = stdout.split(/\r?\n/);
      const devices: AdbDevice[] = [];

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
    } catch (err) {
      throw new Error(`Failed to list ADB devices: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async autoSelectDevice(): Promise<string> {
    if (this.selectedDeviceId) {
      return this.selectedDeviceId;
    }

    if (this.connectAddress) {
      await this.connectRemoteDevice();
      if (this.selectedDeviceId) return this.selectedDeviceId;
    }

    const devices = await this.listDevices();
    const online = devices.filter((d) => d.status === "device");

    if (online.length === 0) {
      throw new Error(
        `No online Android device/emulator found via ADB${
          this.host ? ` at ${this.host}:${this.port || 5037}` : ""
        }. Ensure your device is connected with USB Debugging enabled or check your remote connection.`
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
      const proc = spawn(this.adbPath, fullArgs);
      this.activeProcesses.add(proc);

      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.activeProcesses.delete(proc);
          proc.kill("SIGKILL");
          reject(new Error(`ADB command timed out after ${timeoutMs}ms [${fullArgs.join(" ")}]`));
        }
      }, timeoutMs);

      proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
      proc.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

      proc.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.activeProcesses.delete(proc);

        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          const errMsg = Buffer.concat(errChunks).toString("utf-8");
          reject(new Error(`ADB process exited with code ${code}: ${errMsg}`));
        }
      });

      proc.on("error", (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.activeProcesses.delete(proc);
        reject(err);
      });
    });
  }

  async getDisplayMetrics(): Promise<DisplayMetrics> {
    const sizeOutput = await this.shell(["wm", "size"]);
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

    let rotation: 0 | 90 | 180 | 270 = 0;
    try {
      const rotOutput = await this.shell(["dumpsys", "display"]);
      const rotMatch = rotOutput.match(/mCurrentRotation=(\d)/);
      if (rotMatch) {
        const val = parseInt(rotMatch[1], 10);
        if (val === 1) rotation = 90;
        else if (val === 2) rotation = 180;
        else if (val === 3) rotation = 270;
      }
    } catch {
      // default 0
    }

    return { width, height, rotation };
  }

  async close(): Promise<void> {
    for (const proc of this.activeProcesses) {
      try {
        proc.kill("SIGKILL");
      } catch {
        // ignore
      }
    }
    this.activeProcesses.clear();
  }
}
