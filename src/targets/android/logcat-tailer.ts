import { spawn, ChildProcess } from "node:child_process";
import readline from "node:readline";
import { AdbClient } from "./adb-client.js";
import { logger } from "../../utils/logger.js";

const NOISE_PATTERNS = [
  /Choreographer:\s+Skipped \d+ frames/i,
  /GC_(?:CONCURRENT|FOR_ALLOC|EXPLICIT)/i,
  /ViewRootImpl/i,
  /InputMethodManager/i,
  /CompatibilityChangeReporter/i,
  /SurfaceView/i,
  /OpenGLRenderer/i,
  /chatty\s+:\s+uid=\d+/i,
  /hwcomposer/i,
  /gralloc/i,
  /BatteryStats/i,
];

const CRASH_PATTERNS = [
  /FATAL EXCEPTION/i,
  /AndroidRuntime:\s+FATAL/i,
  /\bANR in\b/i,
  /Fatal signal \d+/i,
  /\bSIGSEGV\b/i,
  /java\.lang\.\w+Exception/i,
  /Process \S+ has died/i,
];

export class LogcatTailer {
  private adb: AdbClient;
  private ringBufferSize: number;
  private filterNoise: boolean;
  private ringBuffer: string[] = [];
  private proc?: ChildProcess;
  private rl?: readline.Interface;
  private hasCrashed = false;
  private crashReason?: string;
  private isStarted = false;

  constructor(adb: AdbClient, ringBufferSize = 2000, filterNoise = true) {
    this.adb = adb;
    this.ringBufferSize = ringBufferSize;
    this.filterNoise = filterNoise;
  }

  async start(): Promise<void> {
    if (this.isStarted) return;
    if (this.proc) {
      this.stop();
    }
    await this.adb.autoSelectDevice();

    const baseArgs = typeof this.adb.getBaseArgs === "function" ? this.adb.getBaseArgs() : [];
    const args = [...baseArgs, "logcat", "-v", "time"];

    // Clear old logcat before tailing
    try {
      await this.adb.shell(["logcat", "-c"]);
    } catch {
      // ignore
    }

    const adbPath = typeof this.adb.getAdbPath === "function" ? this.adb.getAdbPath() : "adb";
    this.proc = spawn(adbPath, args, { stdio: ["ignore", "pipe", "ignore"] });
    this.isStarted = true;

    if (this.proc.stdout) {
      this.rl = readline.createInterface({ input: this.proc.stdout });

      this.rl.on("line", (line) => {
        this.processLine(line);
      });
    }

    this.proc.on("error", (err) => {
      logger.debug("Logcat process error:", err);
      this.isStarted = false;
    });

    this.proc.on("close", () => {
      this.isStarted = false;
    });
  }

  private processLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Check crash patterns for watchdog (ignore non-fatal V/D/I/W levels unless explicitly FATAL or died)
    const isNonFatalLevel = /(?:^|\s)[VDIW]\/\S+/.test(trimmed);
    if (!isNonFatalLevel || /FATAL|died/i.test(trimmed)) {
      for (const pattern of CRASH_PATTERNS) {
        if (pattern.test(trimmed)) {
          this.hasCrashed = true;
          this.crashReason = trimmed;
          logger.warn(`[Watchdog] Crash detected: ${trimmed}`);
          break;
        }
      }
    }

    // Filter noise
    if (this.filterNoise) {
      for (const noise of NOISE_PATTERNS) {
        if (noise.test(trimmed)) return;
      }
    }

    // Append to ring buffer
    this.ringBuffer.push(trimmed);
    if (this.ringBuffer.length > this.ringBufferSize) {
      this.ringBuffer.shift();
    }
  }

  getRecentLogs(filterPattern?: string, limit = 200): string[] {
    let logs = this.ringBuffer;

    if (filterPattern) {
      try {
        const regex = new RegExp(filterPattern, "i");
        logs = logs.filter((l) => regex.test(l));
      } catch {
        const lower = filterPattern.toLowerCase();
        logs = logs.filter((l) => l.toLowerCase().includes(lower));
      }
    }

    return logs.slice(-limit);
  }

  checkWatchdog(): { hasCrashed: boolean; reason?: string } {
    const crashed = this.hasCrashed;
    const reason = this.crashReason;
    return { hasCrashed: crashed, reason };
  }

  resetWatchdog(): void {
    this.hasCrashed = false;
    this.crashReason = undefined;
  }

  stop(): void {
    if (this.rl) {
      try {
        this.rl.close();
      } catch {
        // ignore
      }
      this.rl = undefined;
    }
    if (this.proc) {
      try {
        this.proc.stdout?.destroy();
        this.proc.kill();
      } catch {
        // ignore
      }
      this.proc = undefined;
    }
    this.isStarted = false;
  }
}
