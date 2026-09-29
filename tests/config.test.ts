import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  PeepConfigSchema,
  InferenceProviderConfigSchema,
  PerceptionConfigSchema,
  TargetConfigSchema,
  LogsConfigSchema,
} from "../src/config/schema.js";
import { loadConfig } from "../src/config/index.js";

describe("Configuration & Schema Validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clean up Peep environment variables before each test
    delete process.env.PEEP_CONFIG;
    delete process.env.PEEP_PROVIDER_TYPE;
    delete process.env.PEEP_BASE_URL;
    delete process.env.PEEP_API_KEY;
    delete process.env.PEEP_VLM_MODEL;
    delete process.env.PEEP_SLM_MODEL;
    delete process.env.PEEP_TARGET_TYPE;
    delete process.env.PEEP_DEVICE_ID;
    delete process.env.PEEP_ADB_PATH;
    delete process.env.PEEP_LOG_LEVEL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("PeepConfigSchema Defaults & Validation", () => {
    it("parses empty object and populates complete default configuration", () => {
      const config = PeepConfigSchema.parse({});

      expect(config.logLevel).toBe("info");
      expect(config.provider.type).toBe("openai");
      expect(config.provider.model).toBe("auto");
      expect(config.provider.visionModel).toBe("auto");
      expect(config.provider.textModel).toBe("auto");
      expect(config.provider.timeoutMs).toBe(45000);
      expect(config.provider.temperature).toBe(0.1);

      expect(config.target.type).toBe("android");
      expect(config.target.defaultPlatform).toBe("android");
      expect(config.target.enabled).toEqual(["android", "browser", "desktop"]);

      expect(config.perception.strategy).toBe("auto");
      expect(config.perception.confidenceThreshold).toBe(0.7);
      expect(config.perception.coordinateScale).toBe(1000);

      expect(config.logs.ringBufferSize).toBe(2000);
      expect(config.logs.filterNoise).toBe(true);
      expect(config.logs.watchdog).toBe(true);
      expect(config.logs.maxAnomalyLines).toBe(10);
    });

    it("rejects invalid provider type", () => {
      expect(() =>
        InferenceProviderConfigSchema.parse({ type: "invalid_provider" })
      ).toThrow();
    });

    it("rejects invalid target type", () => {
      expect(() => TargetConfigSchema.parse({ type: "ios" })).toThrow();
    });

    it("rejects confidenceThreshold outside 0 to 1 range", () => {
      expect(() =>
        PerceptionConfigSchema.parse({ confidenceThreshold: 1.5 })
      ).toThrow();
      expect(() =>
        PerceptionConfigSchema.parse({ confidenceThreshold: -0.2 })
      ).toThrow();
    });

    it("rejects negative timeout or ringBufferSize", () => {
      expect(() =>
        InferenceProviderConfigSchema.parse({ timeoutMs: -1000 })
      ).toThrow();
      expect(() => LogsConfigSchema.parse({ ringBufferSize: 0 })).toThrow();
    });

    it("rejects invalid log level", () => {
      expect(() => PeepConfigSchema.parse({ logLevel: "verbose" })).toThrow();
    });
  });

  describe("loadConfig Functionality & Environment Overrides", () => {
    it("loads default config when no file is specified", () => {
      const config = loadConfig();
      expect(config.provider.type).toBe("openai");
      expect(config.target.type).toBe("android");
    });

    it("applies CLI overrides over defaults", () => {
      const config = loadConfig(undefined, {
        logLevel: "debug",
        provider: {
          type: "ollama",
          baseUrl: "http://192.168.1.50:11434",
          vlmModel: "llava:13b",
          slmModel: "gemma:2b",
          timeoutMs: 60000,
          temperature: 0.2,
        },
      });

      expect(config.logLevel).toBe("debug");
      expect(config.provider.type).toBe("ollama");
      expect(config.provider.baseUrl).toBe("http://192.168.1.50:11434");
      expect(config.provider.vlmModel).toBe("llava:13b");
    });

    it("merges environment variables into config", () => {
      process.env.PEEP_PROVIDER_TYPE = "ollama";
      process.env.PEEP_BASE_URL = "http://remote-gpu:11434";
      process.env.PEEP_API_KEY = "test-secret-key";
      process.env.PEEP_VLM_MODEL = "custom-vlm";
      process.env.PEEP_SLM_MODEL = "custom-slm";
      process.env.PEEP_LOG_LEVEL = "warn";
      process.env.PEEP_DEVICE_ID = "emulator-5556";
      process.env.PEEP_ADB_PATH = "/usr/bin/adb";

      const config = loadConfig();

      expect(config.provider.type).toBe("ollama");
      expect(config.provider.baseUrl).toBe("http://remote-gpu:11434");
      expect(config.provider.apiKey).toBe("test-secret-key");
      expect(config.provider.vlmModel).toBe("custom-vlm");
      expect(config.provider.slmModel).toBe("custom-slm");
      expect(config.logLevel).toBe("warn");
      expect(config.target.deviceId).toBe("emulator-5556");
      expect(config.target.adbPath).toBe("/usr/bin/adb");
    });

    it("handles non-existent explicit config path gracefully", () => {
      const config = loadConfig("non_existent_peep_config.yaml");
      // Should fall back to defaults
      expect(config.provider.type).toBe("openai");
      expect(config.target.type).toBe("android");
    });
  });
});
