import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { PeepConfig, PeepConfigSchema } from "./schema.js";
import { logger } from "../utils/logger.js";

const DEFAULT_CONFIG_FILENAMES = ["peep.yaml", "peep.yml", ".peep.yaml", ".peep.yml"];

export function loadConfig(explicitPath?: string, overrides: Partial<PeepConfig> = {}): PeepConfig {
  let fileConfig: Record<string, unknown> = {};

  const configPath = explicitPath || process.env.PEEP_CONFIG;

  if (configPath) {
    const resolved = path.resolve(configPath);
    if (fs.existsSync(resolved)) {
      try {
        const raw = fs.readFileSync(resolved, "utf-8");
        fileConfig = (yaml.parse(raw) as Record<string, unknown>) || {};
        logger.debug(`Loaded configuration from ${resolved}`);
      } catch (err) {
        logger.warn(`Failed to parse configuration at ${resolved}:`, err);
      }
    } else {
      logger.warn(`Specified config file not found: ${resolved}`);
    }
  } else {
    for (const filename of DEFAULT_CONFIG_FILENAMES) {
      const candidate = path.resolve(process.cwd(), filename);
      if (fs.existsSync(candidate)) {
        try {
          const raw = fs.readFileSync(candidate, "utf-8");
          fileConfig = (yaml.parse(raw) as Record<string, unknown>) || {};
          logger.debug(`Found local configuration in ${candidate}`);
          break;
        } catch (err) {
          logger.warn(`Failed to parse ${candidate}:`, err);
        }
      }
    }
  }

  // Merge environment variables
  const envConfig: Record<string, unknown> = {
    provider: {},
    target: {
      android: {},
    },
    perception: {},
    logs: {},
  };

  const providerObj = envConfig.provider as Record<string, unknown>;
  if (process.env.PEEP_PROVIDER_TYPE) providerObj.type = process.env.PEEP_PROVIDER_TYPE;
  if (process.env.PEEP_BASE_URL) providerObj.baseUrl = process.env.PEEP_BASE_URL;
  if (process.env.PEEP_API_KEY) providerObj.apiKey = process.env.PEEP_API_KEY;
  if (process.env.PEEP_MODEL) providerObj.model = process.env.PEEP_MODEL;
  if (process.env.PEEP_VISION_MODEL) providerObj.visionModel = process.env.PEEP_VISION_MODEL;
  if (process.env.PEEP_TEXT_MODEL) providerObj.textModel = process.env.PEEP_TEXT_MODEL;
  if (process.env.PEEP_VLM_MODEL) providerObj.vlmModel = process.env.PEEP_VLM_MODEL;
  if (process.env.PEEP_SLM_MODEL) providerObj.slmModel = process.env.PEEP_SLM_MODEL;

  const targetObj = envConfig.target as Record<string, unknown>;
  const androidObj = targetObj.android as Record<string, unknown>;

  if (process.env.PEEP_TARGETS_ENABLED) {
    targetObj.enabled = process.env.PEEP_TARGETS_ENABLED.split(",").map((s) => s.trim());
  }
  if (process.env.PEEP_DEFAULT_PLATFORM) {
    targetObj.defaultPlatform = process.env.PEEP_DEFAULT_PLATFORM;
  }
  if (process.env.PEEP_TARGET_TYPE) {
    targetObj.defaultPlatform = process.env.PEEP_TARGET_TYPE;
  }

  // Android specific env
  if (process.env.PEEP_DEVICE_ID) {
    androidObj.deviceId = process.env.PEEP_DEVICE_ID;
    targetObj.deviceId = process.env.PEEP_DEVICE_ID;
  }
  if (process.env.PEEP_ADB_PATH) {
    androidObj.adbPath = process.env.PEEP_ADB_PATH;
    targetObj.adbPath = process.env.PEEP_ADB_PATH;
  }
  if (process.env.PEEP_ADB_HOST) {
    androidObj.adbHost = process.env.PEEP_ADB_HOST;
  }
  if (process.env.PEEP_ADB_PORT) {
    androidObj.adbPort = parseInt(process.env.PEEP_ADB_PORT, 10);
  }
  if (process.env.PEEP_ADB_CONNECT) {
    androidObj.connectAddress = process.env.PEEP_ADB_CONNECT;
  }

  if (process.env.PEEP_LOG_LEVEL) {
    envConfig.logLevel = process.env.PEEP_LOG_LEVEL;
  }

  // Deep merge
  const merged = deepMerge(fileConfig, envConfig);
  const finalMerged = deepMerge(merged, overrides as Record<string, unknown>);

  const parsed = PeepConfigSchema.parse(finalMerged);
  logger.setLevel(parsed.logLevel);
  return parsed;
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof output[key] === "object" &&
      output[key] !== null
    ) {
      output[key] = deepMerge(
        output[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else if (value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}
