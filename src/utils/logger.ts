import pc from "picocolors";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

class Logger {
  private level: LogLevel = "info";

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error", "silent"];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      console.error(pc.dim(`[peep:debug]`), ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.error(pc.cyan(`[peep]`), ...args);
    }
  }

  success(...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.error(pc.green(`[peep:ok]`), ...args);
    }
  }

  shield(...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.error(pc.magenta(pc.bold(`[peep:shield] 🛡️ `)), ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      console.error(pc.yellow(`[peep:warn]`), ...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog("error")) {
      console.error(pc.red(pc.bold(`[peep:error]`)), ...args);
    }
  }
}

export const logger = new Logger();
