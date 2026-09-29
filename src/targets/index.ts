import { BaseTarget } from "./base.js";
import { AndroidTarget } from "./android/index.js";
import { BrowserTarget } from "./browser/index.js";
import { DesktopTarget } from "./desktop/index.js";
import { TargetConfig, LogsConfig } from "../config/schema.js";

export function createTarget(
  targetConfig: TargetConfig,
  logsConfig: LogsConfig
): BaseTarget {
  switch (targetConfig.type) {
    case "android":
      return new AndroidTarget(targetConfig, logsConfig);
    case "browser":
      return new BrowserTarget();
    case "desktop":
      return new DesktopTarget();
    default:
      return new AndroidTarget(targetConfig, logsConfig);
  }
}

export * from "./base.js";
export * from "./android/index.js";
export * from "./browser/index.js";
export * from "./desktop/index.js";
