import { BaseTarget } from "./base.js";
import { AndroidTarget } from "./android/index.js";
import { BrowserTarget } from "./browser/index.js";
import { DesktopTarget } from "./desktop/index.js";
import { TargetConfig, LogsConfig, TargetPlatform } from "../config/schema.js";
import { logger } from "../utils/logger.js";

export class TargetManager {
  private targets = new Map<TargetPlatform, BaseTarget>();
  private defaultPlatform: TargetPlatform;

  constructor(targetConfig: TargetConfig, logsConfig: LogsConfig) {
    this.defaultPlatform = targetConfig.type || targetConfig.defaultPlatform || "android";

    const enabled = targetConfig.enabled || ["android", "browser", "desktop"];

    if (enabled.includes("android")) {
      this.targets.set("android", new AndroidTarget(targetConfig, logsConfig));
    }
    if (enabled.includes("browser")) {
      this.targets.set("browser", new BrowserTarget());
    }
    if (enabled.includes("desktop")) {
      this.targets.set("desktop", new DesktopTarget());
    }
  }

  async initAll(): Promise<void> {
    for (const [platform, target] of this.targets.entries()) {
      try {
        await target.init();
      } catch (err) {
        logger.debug(`Target '${platform}' not active at startup: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  getTarget(platform?: TargetPlatform): BaseTarget {
    const selectedPlatform = platform || this.defaultPlatform;
    const target = this.targets.get(selectedPlatform);

    if (target) {
      return target;
    }

    // Fallback to first available target
    const first = this.targets.values().next().value;
    if (first) {
      return first;
    }

    throw new Error(`No target available for platform '${selectedPlatform}'. Enabled: ${Array.from(this.targets.keys()).join(", ")}`);
  }

  getPrimaryTarget(): BaseTarget {
    return this.getTarget(this.defaultPlatform);
  }

  getEnabledPlatforms(): TargetPlatform[] {
    return Array.from(this.targets.keys());
  }

  async closeAll(): Promise<void> {
    for (const target of this.targets.values()) {
      try {
        await target.close();
      } catch {
        // ignore
      }
    }
  }
}

export function createTarget(
  targetConfig: TargetConfig,
  logsConfig: LogsConfig
): BaseTarget {
  // Legacy convenience function returning primary target
  const manager = new TargetManager(targetConfig, logsConfig);
  return manager.getPrimaryTarget();
}

export * from "./base.js";
export * from "./android/index.js";
export * from "./browser/index.js";
export * from "./desktop/index.js";
