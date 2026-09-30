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

export interface LaunchResult {
  packageName: string;
  activity?: string;
  launchState?: string;
  totalTimeMs?: number;
  waitTimeMs?: number;
  crashDetected?: string;
}

export interface DeviceState {
  foreground: { packageName?: string; activity?: string };
  display: DisplayMetrics;
  battery: { level?: number; charging?: boolean };
}

export interface DeepLinkResult {
  url: string;
  resolvedPackage?: string;
  resolvedActivity?: string;
  crashDetected?: string;
}

export interface ProcessInfo {
  uid: string;
  pid: number;
  ppid: number;
  cmd: string;
  isRoot: boolean;
}

export interface ForceStopResult {
  target: string;
  success: boolean;
  killedPids: number[];
  usedRoot: boolean;
  message: string;
}

export interface SystemServiceRestartResult {
  service: "zygote" | "systemui" | "soft_reboot" | "surfaceflinger";
  success: boolean;
  durationMs: number;
  message: string;
}

export interface SelinuxResult {
  mode: string;
  success: boolean;
  previousMode?: string;
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

  getBaseArgs(deviceId?: string): string[] {
    const args: string[] = [];
    if (this.host) {
      args.push("-H", this.host);
    }
    if (this.port) {
      args.push("-P", String(this.port));
    }
    const target = deviceId || this.selectedDeviceId;
    if (target) {
      args.push("-s", target);
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

  async execAdb(args: string[], timeoutMs = 30000, deviceId?: string): Promise<string> {
    await this.autoSelectDevice();
    const fullArgs = [...this.getBaseArgs(deviceId), ...args];
    try {
      const { stdout } = await execFileAsync(this.adbPath, fullArgs, {
        maxBuffer: 20 * 1024 * 1024,
        timeout: timeoutMs,
      });
      return stdout;
    } catch (err) {
      throw new Error(`ADB exec error [${fullArgs.join(" ")}]: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async shell(command: string | string[], timeoutMs = 15000, deviceId?: string): Promise<string> {
    await this.autoSelectDevice();
    const cmdArgs = Array.isArray(command) ? command : command.split(" ");
    const args = [...this.getBaseArgs(deviceId), "shell", ...cmdArgs];

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

  async startActivity(options: {
    packageName: string;
    activity?: string;
    stopFirst?: boolean;
    wait?: boolean;
    intentAction?: string;
    intentCategory?: string;
    extras?: Record<string, string | number | boolean>;
    deviceId?: string;
  }): Promise<LaunchResult> {
    const args = ["am", "start"];
    if (options.stopFirst ?? true) args.push("-S");
    if (options.wait ?? true) args.push("-W");

    if (options.intentAction) args.push("-a", options.intentAction);
    if (options.intentCategory) args.push("-c", options.intentCategory);

    let activityToLaunch = options.activity;
    if (!activityToLaunch) {
      try {
        const resolveOutput = await this.shell(
          ["cmd", "package", "resolve-activity", "--brief", options.packageName],
          5000,
          options.deviceId
        );
        const lines = resolveOutput.trim().split(/\r?\n/);
        const lastLine = lines[lines.length - 1]?.trim();
        if (lastLine && lastLine.includes("/") && !lastLine.includes("No activity found")) {
          activityToLaunch = lastLine;
        }
      } catch {
        // fallback
      }

      if (!activityToLaunch) {
        try {
          const resolveOutput = await this.shell(
            ["cmd", "package", "resolve-activity", "--brief", "-c", "android.intent.category.LAUNCHER", options.packageName],
            5000,
            options.deviceId
          );
          const lines = resolveOutput.trim().split(/\r?\n/);
          const lastLine = lines[lines.length - 1]?.trim();
          if (lastLine && lastLine.includes("/") && !lastLine.includes("No activity found")) {
            activityToLaunch = lastLine;
          }
        } catch {
          // fallback
        }
      }
    }

    if (activityToLaunch) {
      const comp = activityToLaunch.startsWith(".")
        ? `${options.packageName}/${options.packageName}${activityToLaunch}`
        : activityToLaunch.includes("/")
          ? activityToLaunch
          : `${options.packageName}/${activityToLaunch}`;
      args.push("-n", comp);
    } else {
      if (!options.intentAction) args.push("-a", "android.intent.action.MAIN");
      if (!options.intentCategory) args.push("-c", "android.intent.category.LAUNCHER");
      args.push("--pkg", options.packageName);
    }

    if (options.extras) {
      for (const [key, val] of Object.entries(options.extras)) {
        if (typeof val === "boolean") args.push("--ez", key, String(val));
        else if (typeof val === "number") args.push("--ei", key, String(val));
        else {
          const strVal = String(val);
          const escaped = `'${strVal.replace(/'/g, "'\\''")}'`;
          args.push("--es", key, escaped);
        }
      }
    }

    const output = await this.shell(args, 20000, options.deviceId);
    if (output.includes("Error:") || output.includes("Exception occurred")) {
      throw new Error(`Failed to launch ${options.packageName}: ${output.trim()}`);
    }

    const totalMatch = output.match(/TotalTime:\s*(\d+)/i);
    const waitMatch = output.match(/WaitTime:\s*(\d+)/i);
    const stateMatch = output.match(/LaunchState:\s*(\w+)/i);

    return {
      packageName: options.packageName,
      activity: options.activity,
      launchState: stateMatch ? stateMatch[1] : undefined,
      totalTimeMs: totalMatch ? parseInt(totalMatch[1], 10) : undefined,
      waitTimeMs: waitMatch ? parseInt(waitMatch[1], 10) : undefined,
    };
  }

  async installApk(
    apkPath: string,
    options: {
      reinstall?: boolean;
      grantPermissions?: boolean;
      allowDowngrade?: boolean;
      deviceId?: string;
    } = {}
  ): Promise<void> {
    const flags: string[] = ["install"];
    if (options.reinstall ?? true) flags.push("-r");
    if (options.grantPermissions ?? true) flags.push("-g");
    if (options.allowDowngrade) flags.push("-d");
    flags.push(apkPath);

    const output = await this.execAdb(flags, 60000, options.deviceId);
    if (!output.includes("Success")) {
      throw new Error(`APK installation failed: ${output.trim()}`);
    }
  }

  async uninstallApk(packageName: string, keepData = false, deviceId?: string): Promise<void> {
    const flags: string[] = ["uninstall"];
    if (keepData) flags.push("-k");
    flags.push(packageName);

    const output = await this.execAdb(flags, 30000, deviceId);
    if (!output.includes("Success")) {
      throw new Error(`APK uninstall failed: ${output.trim()}`);
    }
  }

  async forceStop(packageName: string, mode: "force_stop" | "kill_background" = "force_stop", deviceId?: string): Promise<void> {
    if (mode === "kill_background") {
      await this.shell(["am", "kill", packageName], 10000, deviceId);
    } else {
      await this.shell(["am", "force-stop", packageName], 10000, deviceId);
    }
  }

  async clearAppData(packageName: string, deviceId?: string): Promise<void> {
    const output = await this.shell(["pm", "clear", packageName], 15000, deviceId);
    if (!output.toLowerCase().includes("success")) {
      throw new Error(`Failed to clear app data for ${packageName}: ${output.trim()}`);
    }
  }

  async wakeAndUnlock(pinOrPassword?: string, deviceId?: string): Promise<{ screenOn: boolean; keyguardDismissed: boolean }> {
    try {
      const powerOutput = await this.shell(["dumpsys", "power"], 10000, deviceId);
      const isAwake = powerOutput.includes("mWakefulness=Awake");
      if (!isAwake) {
        await this.shell(["input", "keyevent", "KEYCODE_WAKEUP"], 10000, deviceId);
      }
    } catch {
      await this.shell(["input", "keyevent", "26"], 10000, deviceId);
    }

    await this.shell(["wm", "dismiss-keyguard"], 10000, deviceId);
    if (pinOrPassword) {
      const escaped = pinOrPassword.replace(/'/g, "'\\''");
      await this.shell(["input", "text", `'${escaped}'`], 10000, deviceId);
      await this.shell(["input", "keyevent", "66"], 10000, deviceId);
    }
    return { screenOn: true, keyguardDismissed: true };
  }

  async setClipboard(text: string, deviceId?: string): Promise<void> {
    const escaped = text.replace(/'/g, "'\\''");
    try {
      await this.shell(["cmd", "clipboard", "set", "text", `'${escaped}'`], 10000, deviceId);
    } catch {
      await this.shell(["am", "broadcast", "-a", "clipper.set", "-e", "text", `'${escaped}'`], 10000, deviceId);
    }
  }

  async getClipboard(deviceId?: string): Promise<string> {
    try {
      const out = await this.shell(["cmd", "clipboard", "get"], 10000, deviceId);
      return out.trim();
    } catch {
      return "";
    }
  }

  async pasteClipboard(deviceId?: string): Promise<void> {
    await this.shell(["input", "keyevent", "279"], 10000, deviceId);
  }

  async getForegroundActivity(deviceId?: string): Promise<{ packageName?: string; activity?: string }> {
    try {
      const output = await this.shell(["dumpsys", "window", "displays"], 10000, deviceId);
      const focusMatch =
        output.match(/mCurrentFocus=Window\{.*?\s+([a-zA-Z0-9_\.]+)\/([^\}\s]+)\}/) ||
        output.match(/mFocusedApp=.*?([a-zA-Z0-9_\.]+)\/([^\}\s]+)/);
      if (focusMatch) {
        return { packageName: focusMatch[1], activity: focusMatch[2] };
      }
    } catch {
      // Fallback
    }

    try {
      const actOutput = await this.shell(["dumpsys", "activity", "activities"], 10000, deviceId);
      const resumedMatch = actOutput.match(
        /(?:topResumedActivity|mResumedActivity)=ActivityRecord\{.*?\s+([a-zA-Z0-9_\.]+)\/([^\s\}]+)/
      );
      if (resumedMatch) {
        return { packageName: resumedMatch[1], activity: resumedMatch[2] };
      }
    } catch {
      // Fallback
    }

    return {};
  }

  async getDeviceState(deviceId?: string): Promise<DeviceState> {
    const foreground = await this.getForegroundActivity(deviceId);
    const display = await this.getDisplayMetrics();

    let level: number | undefined;
    let charging: boolean | undefined;

    try {
      const batteryRaw = await this.shell(["dumpsys", "battery"], 10000, deviceId);
      const levelMatch = batteryRaw.match(/level:\s*(\d+)/i);
      const acMatch = batteryRaw.match(/AC powered:\s*(true|false)/i);
      const usbMatch = batteryRaw.match(/USB powered:\s*(true|false)/i);
      if (levelMatch) level = parseInt(levelMatch[1], 10);
      if (acMatch || usbMatch) charging = acMatch?.[1] === "true" || usbMatch?.[1] === "true";
    } catch {
      // ignore
    }

    return {
      foreground,
      display,
      battery: { level, charging },
    };
  }

  async openDeepLink(url: string, packageName?: string, deviceId?: string): Promise<DeepLinkResult> {
    const escapedUrl = `'${url.replace(/'/g, "'\\''")}'`;
    const args = ["am", "start", "-a", "android.intent.action.VIEW", "-d", escapedUrl];
    if (packageName) args.push("-p", packageName);

    await this.shell(args, 15000, deviceId);
    await new Promise((r) => setTimeout(r, 400));
    const fg = await this.getForegroundActivity(deviceId);

    return {
      url,
      resolvedPackage: fg.packageName,
      resolvedActivity: fg.activity,
    };
  }

  async managePermissions(
    action: "grant" | "revoke" | "list",
    packageName: string,
    permission?: string,
    deviceId?: string
  ): Promise<{ permissions: string[] }> {
    if (action === "grant") {
      if (!permission) throw new Error("Permission name required for grant");
      const permName = permission.includes(".") ? permission : `android.permission.${permission}`;
      const out = await this.shell(["pm", "grant", packageName, permName], 10000, deviceId);
      if (out.includes("Exception") || out.includes("Error")) {
        throw new Error(`Failed to grant permission ${permName} to ${packageName}: ${out.trim()}`);
      }
      return { permissions: [permName] };
    } else if (action === "revoke") {
      if (!permission) throw new Error("Permission name required for revoke");
      const permName = permission.includes(".") ? permission : `android.permission.${permission}`;
      const out = await this.shell(["pm", "revoke", packageName, permName], 10000, deviceId);
      if (out.includes("Exception") || out.includes("Error")) {
        throw new Error(`Failed to revoke permission ${permName} from ${packageName}: ${out.trim()}`);
      }
      return { permissions: [] };
    } else {
      const dump = await this.shell(["dumpsys", "package", packageName], 15000, deviceId);
      const lines = dump.split(/\r?\n/);
      const perms: string[] = [];
      let inPerms = false;
      for (const line of lines) {
        if (line.includes("runtime permissions:")) inPerms = true;
        else if (inPerms && line.match(/^\s*[a-zA-Z0-9_\.]+: granted=true/)) {
          const m = line.trim().split(":")[0];
          perms.push(m);
        } else if (inPerms && !line.startsWith(" ")) {
          break;
        }
      }
      return { permissions: perms };
    }
  }

  async setScreenOrientation(orientation: "portrait" | "landscape" | "auto", deviceId?: string): Promise<void> {
    if (orientation === "auto") {
      await this.shell(["settings", "put", "system", "accelerometer_rotation", "1"], 10000, deviceId);
    } else {
      await this.shell(["settings", "put", "system", "accelerometer_rotation", "0"], 10000, deviceId);
      const rot = orientation === "landscape" ? "1" : "0";
      await this.shell(["settings", "put", "system", "user_rotation", rot], 10000, deviceId);
    }
  }

  async manageFiles(
    action: "push" | "pull" | "delete",
    devicePath: string,
    hostPath?: string,
    triggerMediaScan = true,
    deviceId?: string
  ): Promise<{ success: boolean; message?: string }> {
    if (action === "push") {
      if (!hostPath) throw new Error("hostPath required for file push");
      await this.execAdb(["push", hostPath, devicePath], 60000, deviceId);
      if (triggerMediaScan) {
        await this.shell(["am", "broadcast", "-a", "android.intent.action.MEDIA_SCANNER_SCAN_FILE", "-d", `file://${devicePath}`], 10000, deviceId);
      }
      return { success: true, message: `Pushed ${hostPath} -> ${devicePath}` };
    } else if (action === "pull") {
      if (!hostPath) throw new Error("hostPath required for file pull");
      await this.execAdb(["pull", devicePath, hostPath], 60000, deviceId);
      return { success: true, message: `Pulled ${devicePath} -> ${hostPath}` };
    } else {
      await this.shell(["rm", "-f", devicePath], 10000, deviceId);
      return { success: true, message: `Deleted ${devicePath}` };
    }
  }

  async listApps(
    filter: "third_party" | "system" | "all" = "third_party",
    search?: string,
    limit = 25,
    deviceId?: string
  ): Promise<Array<{ packageName: string; isSystem: boolean }>> {
    const flags = ["pm", "list", "packages"];
    if (filter === "third_party") flags.push("-3");
    if (filter === "system") flags.push("-s");

    let systemSet: Set<string> | undefined;
    if (filter === "all") {
      try {
        const sysOut = await this.shell(["pm", "list", "packages", "-s"], 15000, deviceId);
        systemSet = new Set(
          sysOut
            .split(/\r?\n/)
            .filter((l) => l.startsWith("package:"))
            .map((l) => l.replace("package:", "").trim())
        );
      } catch {
        // fallback
      }
    }

    const out = await this.shell(flags, 15000, deviceId);
    const lines = out.split(/\r?\n/).filter((l) => l.startsWith("package:"));
    const results: Array<{ packageName: string; isSystem: boolean }> = [];

    for (const line of lines) {
      const pkg = line.replace("package:", "").trim();
      if (!pkg) continue;
      if (search && !pkg.toLowerCase().includes(search.toLowerCase())) continue;
      results.push({
        packageName: pkg,
        isSystem: filter === "system" || (filter === "all" && systemSet ? systemSet.has(pkg) : false),
      });
      if (results.length >= limit) break;
    }

    return results;
  }

  async isRootAvailable(deviceId?: string): Promise<{ available: boolean; method: "adbd_root" | "su_binary" | "none" }> {
    try {
      const idOut = await this.shell(["id"], 5000, deviceId);
      if (idOut.includes("uid=0(root)")) {
        return { available: true, method: "adbd_root" };
      }
    } catch {
      // ignore
    }
    try {
      const suOut = await this.shell(["su", "-c", "id"], 5000, deviceId);
      if (suOut.includes("uid=0(root)")) {
        return { available: true, method: "su_binary" };
      }
    } catch {
      // ignore
    }
    return { available: false, method: "none" };
  }

  async executeRootCommand(
    command: string,
    timeoutMs = 15000,
    deviceId?: string
  ): Promise<{ stdout: string; success: boolean }> {
    const rootInfo = await this.isRootAvailable(deviceId);
    if (!rootInfo.available) {
      throw new Error("Root access is not available on this device (neither adbd is running as root nor is 'su' working).");
    }
    if (rootInfo.method === "adbd_root") {
      const out = await this.shell(["sh", "-c", command], timeoutMs, deviceId);
      return { stdout: out, success: true };
    } else {
      const escaped = command.replace(/'/g, "'\\''");
      const out = await this.shell(["su", "-c", `'${escaped}'`], timeoutMs, deviceId);
      return { stdout: out, success: true };
    }
  }

  async forceStopProcess(
    target: string | number,
    options: { useRoot?: boolean; killAllMatching?: boolean; deviceId?: string } = {}
  ): Promise<ForceStopResult> {
    const targetStr = String(target);
    const isPid = /^\d+$/.test(targetStr);
    const killedPids: number[] = [];
    const usedRoot = options.useRoot ?? false;

    if (isPid) {
      const pid = parseInt(targetStr, 10);
      if (usedRoot) {
        await this.executeRootCommand(`kill -9 ${pid}`, 10000, options.deviceId);
      } else {
        await this.shell(["kill", "-9", String(pid)], 10000, options.deviceId);
      }
      killedPids.push(pid);
      return {
        target: targetStr,
        success: true,
        killedPids,
        usedRoot,
        message: `Killed process PID ${pid} with SIGKILL${usedRoot ? " (root)" : ""}`,
      };
    }

    const packageName = targetStr;

    // 1. Gather all matching PIDs before kill
    try {
      const pgrepOut = await this.shell(["pgrep", "-f", packageName], 5000, options.deviceId);
      const pids = pgrepOut
        .split(/\r?\n/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);
      killedPids.push(...pids);
    } catch {
      // none
    }

    // 2. Standard ActivityManager force-stop
    try {
      await this.shell(["am", "force-stop", packageName], 10000, options.deviceId);
    } catch {
      // ignore
    }

    // 3. If root or killAllMatching requested, exterminate any remaining or detached daemons/processes
    if (options.useRoot || options.killAllMatching) {
      try {
        let remainingPids: number[] = [];
        try {
          const pgrepRemaining = await this.shell(["pgrep", "-f", packageName], 5000, options.deviceId);
          remainingPids = pgrepRemaining
            .split(/\r?\n/)
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n) && n > 0);
        } catch {
          // none
        }

        if (remainingPids.length > 0) {
          const pidList = remainingPids.join(" ");
          if (usedRoot) {
            await this.executeRootCommand(`kill -9 ${pidList}`, 10000, options.deviceId);
          } else {
            await this.shell(["kill", "-9", ...remainingPids.map(String)], 10000, options.deviceId);
          }
          for (const p of remainingPids) {
            if (!killedPids.includes(p)) killedPids.push(p);
          }
        }
      } catch {
        // ignore
      }
    }

    return {
      target: packageName,
      success: true,
      killedPids,
      usedRoot,
      message: `Force-stopped ${packageName}${killedPids.length > 0 ? ` (terminated ${killedPids.length} process(es): ${killedPids.join(", ")})` : ""}`,
    };
  }

  async restartApp(options: {
    packageOrComponent: string;
    useRootKill?: boolean;
    resetState?: boolean;
    waitForLaunch?: boolean;
    extras?: Record<string, string | number | boolean>;
    deviceId?: string;
  }): Promise<LaunchResult & { killedPids: number[] }> {
    const pkg = options.packageOrComponent.includes("/")
      ? options.packageOrComponent.split("/")[0]
      : options.packageOrComponent;

    const stopResult = await this.forceStopProcess(pkg, {
      useRoot: options.useRootKill,
      killAllMatching: true,
      deviceId: options.deviceId,
    });

    if (options.resetState) {
      try {
        await this.clearAppData(pkg, options.deviceId);
      } catch {
        // ignore
      }
    }

    const launchResult = await this.startActivity({
      packageName: pkg,
      activity: options.packageOrComponent.includes("/")
        ? options.packageOrComponent.split("/")[1]
        : undefined,
      stopFirst: false,
      wait: options.waitForLaunch ?? true,
      extras: options.extras,
      deviceId: options.deviceId,
    });

    return {
      ...launchResult,
      killedPids: stopResult.killedPids,
    };
  }

  async restartSystemService(
    service: "zygote" | "systemui" | "soft_reboot" | "surfaceflinger",
    deviceId?: string
  ): Promise<SystemServiceRestartResult> {
    const start = Date.now();

    if (service === "zygote") {
      try {
        await this.executeRootCommand("setprop ctl.restart zygote; setprop ctl.restart zygote_secondary", 15000, deviceId);
      } catch {
        await this.shell(["pkill", "-9", "zygote"], 10000, deviceId);
      }
      await new Promise((r) => setTimeout(r, 1500));
      return {
        service,
        success: true,
        durationMs: Date.now() - start,
        message: "Restarted 32/64-bit Zygote framework. All hooked processes and framework modules reloaded.",
      };
    } else if (service === "systemui") {
      try {
        await this.executeRootCommand("pkill -9 -f com.android.systemui", 10000, deviceId);
      } catch {
        await this.shell(["pkill", "-9", "-f", "com.android.systemui"], 10000, deviceId);
      }
      await new Promise((r) => setTimeout(r, 1200));
      return {
        service,
        success: true,
        durationMs: Date.now() - start,
        message: "Restarted SystemUI (com.android.systemui). Status bar and UI overlays reloaded.",
      };
    } else if (service === "surfaceflinger") {
      try {
        await this.executeRootCommand("setprop ctl.restart surfaceflinger", 10000, deviceId);
      } catch {
        await this.shell(["pkill", "-9", "-f", "surfaceflinger"], 10000, deviceId);
      }
      await new Promise((r) => setTimeout(r, 1000));
      return {
        service,
        success: true,
        durationMs: Date.now() - start,
        message: "Restarted SurfaceFlinger compositor.",
      };
    } else {
      try {
        await this.executeRootCommand("setprop ctl.restart surfaceflinger; setprop ctl.restart zygote; setprop ctl.restart zygote_secondary", 15000, deviceId);
      } catch {
        await this.shell(["stop"], 10000, deviceId);
        await this.shell(["start"], 10000, deviceId);
      }
      await new Promise((r) => setTimeout(r, 2000));
      return {
        service,
        success: true,
        durationMs: Date.now() - start,
        message: "Soft-reboot completed. Android framework restarted without device hardware reboot.",
      };
    }
  }

  async manageSelinux(
    action: "get" | "permissive" | "enforcing",
    deviceId?: string
  ): Promise<SelinuxResult> {
    const prev = (await this.shell(["getenforce"], 5000, deviceId)).trim();

    if (action === "get") {
      return { mode: prev, success: true };
    } else if (action === "permissive") {
      await this.executeRootCommand("setenforce 0", 10000, deviceId);
      const updated = (await this.shell(["getenforce"], 5000, deviceId)).trim();
      return { mode: updated, success: updated.toLowerCase().includes("permissive"), previousMode: prev };
    } else {
      await this.executeRootCommand("setenforce 1", 10000, deviceId);
      const updated = (await this.shell(["getenforce"], 5000, deviceId)).trim();
      return { mode: updated, success: updated.toLowerCase().includes("enforcing"), previousMode: prev };
    }
  }

  async listProcesses(
    filter?: string,
    limit = 50,
    deviceId?: string
  ): Promise<ProcessInfo[]> {
    let out = "";
    try {
      out = await this.shell(["ps", "-A", "-o", "UID,PID,PPID,CMD"], 15000, deviceId);
    } catch {
      out = await this.shell(["ps", "-ef"], 15000, deviceId);
    }

    const lines = out.split(/\r?\n/).filter(Boolean);
    const results: ProcessInfo[] = [];
    if (lines.length < 2) return results;

    const header = lines[0].trim().toUpperCase().split(/\s+/);
    let uidIdx = header.findIndex((h) => h === "UID" || h === "USER");
    let pidIdx = header.findIndex((h) => h === "PID");
    let ppidIdx = header.findIndex((h) => h === "PPID");
    let cmdIdx = header.findIndex((h) => h === "CMD" || h === "COMMAND" || h === "NAME");

    if (uidIdx === -1) uidIdx = 0;
    if (pidIdx === -1) pidIdx = 1;
    if (ppidIdx === -1) ppidIdx = 2;
    if (cmdIdx === -1) cmdIdx = 3;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(/\s+/);
      if (parts.length > Math.max(uidIdx, pidIdx, ppidIdx)) {
        const uid = parts[uidIdx] || "unknown";
        const pid = parseInt(parts[pidIdx], 10);
        const ppid = ppidIdx !== -1 && parts[ppidIdx] ? parseInt(parts[ppidIdx], 10) : 0;
        const cmd = parts.slice(cmdIdx).join(" ") || parts[parts.length - 1];
        if (!isNaN(pid)) {
          if (filter && !cmd.toLowerCase().includes(filter.toLowerCase()) && !String(pid).includes(filter)) {
            continue;
          }
          results.push({
            uid,
            pid,
            ppid: isNaN(ppid) ? 0 : ppid,
            cmd,
            isRoot: uid === "0" || uid === "root",
          });
          if (results.length >= limit) break;
        }
      }
    }

    return results;
  }

  async setComponentEnabled(
    component: string,
    enabled: boolean,
    useRoot = false,
    deviceId?: string
  ): Promise<{ component: string; enabled: boolean }> {
    const cmd = ["pm", enabled ? "enable" : "disable", component];
    if (useRoot) {
      await this.executeRootCommand(`pm ${enabled ? "enable" : "disable"} ${component}`, 10000, deviceId);
    } else {
      const out = await this.shell(cmd, 10000, deviceId);
      if (out.includes("Exception occurred") || out.includes("SecurityException")) {
        throw new Error(`Failed to ${enabled ? "enable" : "disable"} ${component}: ${out.trim()}`);
      }
    }
    return { component, enabled };
  }

  async getSystemProperty(name: string, deviceId?: string): Promise<string> {
    const out = await this.shell(["getprop", name], 5000, deviceId);
    return out.trim();
  }

  async setSystemProperty(
    name: string,
    value: string,
    useRoot = false,
    deviceId?: string
  ): Promise<{ name: string; value: string }> {
    if (useRoot) {
      await this.executeRootCommand(`setprop ${name} '${value.replace(/'/g, "'\\''")}'`, 10000, deviceId);
    } else {
      await this.shell(["setprop", name, value], 10000, deviceId);
    }
    return { name, value };
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
