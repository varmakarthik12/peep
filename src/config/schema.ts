import { z } from "zod";

export const InferenceProviderConfigSchema = z
  .object({
    type: z.enum(["openai", "ollama"]).default("openai"),
    baseUrl: z.string().default("http://localhost:11434/v1"),
    apiKey: z.string().optional(),
    // Unified primary model - if specified, used for both vision and text
    model: z.string().default("auto"),
    // Optional specialized overrides (fall back to model if omitted)
    visionModel: z.string().optional(),
    textModel: z.string().optional(),
    // Backward compatibility aliases
    vlmModel: z.string().optional(),
    slmModel: z.string().optional(),
    timeoutMs: z.number().int().positive().default(45000),
    temperature: z.number().min(0).max(2).default(0.1),
  })
  .transform((data) => {
    // Resolve vision model: visionModel > vlmModel > model
    const resolvedVision = data.visionModel || data.vlmModel || data.model;
    // Resolve text model: textModel > slmModel > model
    const resolvedText = data.textModel || data.slmModel || data.model;

    return {
      ...data,
      model: data.model,
      visionModel: resolvedVision,
      textModel: resolvedText,
      vlmModel: resolvedVision,
      slmModel: resolvedText,
    };
  });

export const AndroidTargetConfigSchema = z.object({
  deviceId: z.string().optional(),
  adbPath: z.string().default("adb"),
  adbHost: z.string().optional(), // Remote ADB server host (-H <host>)
  adbPort: z.number().int().positive().optional(), // Remote ADB server port (-P <port>)
  connectAddress: z.string().optional(), // Remote TCP/IP device to auto-connect (e.g. 192.168.1.100:5555)
  scrcpyPath: z.string().optional(),
});

export const BrowserTargetConfigSchema = z.object({
  headless: z.boolean().default(false),
  defaultUrl: z.string().optional(),
  viewport: z
    .object({
      width: z.number().int().default(1920),
      height: z.number().int().default(1080),
    })
    .default({ width: 1920, height: 1080 }),
});

export const DesktopTargetConfigSchema = z.object({
  displayIndex: z.number().int().default(0),
});

export const TargetPlatformEnum = z.enum(["android", "browser", "desktop"]);
export type TargetPlatform = z.infer<typeof TargetPlatformEnum>;

export const TargetConfigSchema = z.object({
  // Enabled targets - default to ALL enabled simultaneously
  enabled: z
    .array(TargetPlatformEnum)
    .default(["android", "browser", "desktop"]),
  defaultPlatform: TargetPlatformEnum.default("android"),
  type: TargetPlatformEnum.default("android"),
  android: AndroidTargetConfigSchema.default({}),
  browser: BrowserTargetConfigSchema.default({}),
  desktop: DesktopTargetConfigSchema.default({}),
  // Top-level aliases for backward compatibility
  deviceId: z.string().optional(),
  adbPath: z.string().optional(),
  scrcpyPath: z.string().optional(),
});

export const PerceptionConfigSchema = z.object({
  strategy: z
    .enum(["auto", "tree_first", "vision_only", "tree_only"])
    .default("auto"),
  confidenceThreshold: z.number().min(0).max(1).default(0.7),
  coordinateScale: z.number().int().default(1000),
});

export const LogsConfigSchema = z.object({
  ringBufferSize: z.number().int().positive().default(2000),
  filterNoise: z.boolean().default(true),
  watchdog: z.boolean().default(true),
  maxAnomalyLines: z.number().int().positive().default(10),
});

export const PeepConfigSchema = z.object({
  provider: InferenceProviderConfigSchema.default({}),
  target: TargetConfigSchema.default({}),
  perception: PerceptionConfigSchema.default({}),
  logs: LogsConfigSchema.default({}),
  logLevel: z
    .enum(["debug", "info", "warn", "error", "silent"])
    .default("info"),
});

export type PeepConfig = z.infer<typeof PeepConfigSchema>;
export type InferenceProviderConfig = z.infer<
  typeof InferenceProviderConfigSchema
>;
export type TargetConfig = z.infer<typeof TargetConfigSchema>;
export type AndroidTargetConfig = z.infer<typeof AndroidTargetConfigSchema>;
export type BrowserTargetConfig = z.infer<typeof BrowserTargetConfigSchema>;
export type DesktopTargetConfig = z.infer<typeof DesktopTargetConfigSchema>;
export type PerceptionConfig = z.infer<typeof PerceptionConfigSchema>;
export type LogsConfig = z.infer<typeof LogsConfigSchema>;
